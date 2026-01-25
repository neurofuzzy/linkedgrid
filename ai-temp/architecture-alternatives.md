# Spartan Game Framework - Architecture Alternatives

This document explores three architectural approaches for building a game framework on top of LinkedGrid, addressing the core questions from `spartan-game-rules.md`.

## Core Design Questions

1. **Entity Storage**: Where do entities live? In cells? Separate registry?
2. **Entity IDs**: What do the numeric values in `cell.values[layer]` represent?
3. **Layer Assignment**: Static layers vs dynamic layer allocation?
4. **Lookup Performance**: How to quickly find entities by ID or by cell?
5. **Movement Operations**: How to cleanly move entities between cells?

---

## Architecture A: Registry-Based with Cell References

**Concept**: Entities live in a central registry. Cell layers store entity IDs. Bidirectional references allow fast lookups both ways.

```typescript
// Cell usage
cell.values[ENTITY_LAYER] = entityId;  // Numeric ID
cell.masks[BLOCKING_LAYER] = true;     // Collision flag

// Entity storage
class Entity {
  id: number;
  type: string;
  currentCell: LinkedCell;
  layer: number;
}

class EntityRegistry {
  private entities: Map<number, Entity> = new Map();
  private nextId = 1;
  
  spawn(type: string, cell: LinkedCell, layer: number): Entity {
    const entity = new Entity(this.nextId++, type, cell, layer);
    this.entities.set(entity.id, entity);
    cell.values[layer] = entity.id;
    return entity;
  }
  
  move(entity: Entity, toCell: LinkedCell): boolean {
    if (toCell.values[entity.layer] !== undefined) return false; // Occupied
    
    // Clean up old cell
    entity.currentCell.values[entity.layer] = undefined;
    
    // Move to new cell
    entity.id = toCell.values[entity.layer];
    entity.currentCell = toCell;
    return true;
  }
  
  getEntity(id: number): Entity | undefined {
    return this.entities.get(id);
  }
  
  getEntitiesInCell(cell: LinkedCell): Entity[] {
    return cell.values
      .map(id => id !== undefined ? this.entities.get(id) : undefined)
      .filter(e => e !== undefined);
  }
}
```

### Pros
- **Fast ID lookup**: O(1) via Map
- **Fast cell → entities**: Iterate cell.values array, lookup each ID
- **Clean separation**: Entities are game objects, cells are spatial data
- **Simple movement**: Clear ownership, easy to cleanup old cell
- **Multiple entities per cell**: Natural - different layers have different IDs

### Cons
- **Bidirectional references**: Must maintain cell ↔ entity sync
- **Memory overhead**: Map storage + cell storage
- **Deletion complexity**: Must remove from both registry and cell
- **Layer management**: Need conventions for which layers are for entities

### Best For
- Games with complex entity logic and behavior
- Need to iterate all entities frequently (AI, physics)
- Entities have many properties beyond position

---

## Architecture B: Cell-Centric with Sparse Entities

**Concept**: Entities are lightweight data objects stored ONLY in cells. No central registry. Use cell iteration for queries.

```typescript
// Cell usage
cell.items[PLAYER_LAYER] = entityId;    // Lightweight ID reference
cell.values[TERRAIN_LAYER] = WALL;      // Static terrain
cell.masks[WALKABLE_LAYER] = false;

// Minimal entity data stored externally
type EntityData = {
  id: number;
  type: string;
  hp?: number;
  // ... game-specific props
};

class SparseEntityStore {
  private data: Map<number, EntityData> = new Map();
  private nextId = 1;
  
  createId(type: string): number {
    const id = this.nextId++;
    this.data.set(id, { id, type });
    return id;
  }
  
  getData(id: number): EntityData | undefined {
    return this.data.get(id);
  }
}

class SpatialSystem {
  constructor(private grid: LinkedGrid, private store: SparseEntityStore) {}
  
  spawn(type: string, cell: LinkedCell, layer: number): number {
    if (cell.items[layer] !== undefined) {
      throw new Error('Layer occupied');
    }
    const id = this.store.createId(type);
    cell.items[layer] = id;
    return id;
  }
  
  move(fromCell: LinkedCell, toCell: LinkedCell, layer: number): boolean {
    const entityId = fromCell.items[layer];
    if (entityId === undefined) return false;
    if (toCell.items[layer] !== undefined) return false; // Blocked
    
    toCell.items[layer] = entityId;
    fromCell.items[layer] = undefined;
    return true;
  }
  
  // Spatial queries are natural
  getEntitiesInRadius(cell: LinkedCell, radius: number): number[] {
    const cells = cell.getCircle(radius);
    const ids: number[] = [];
    for (const c of cells) {
      for (const id of c.items) {
        if (id !== undefined) ids.push(id);
      }
    }
    return ids;
  }
}
 ```

### Pros
- **Simple mental model**: Spatial position IS the primary data
- **Cache-friendly**: Entities near each other in space are near in memory
- **No sync issues**: Single source of truth (the cell)
- **Natural spatial queries**: Just iterate cells
- **Minimal bookkeeping**: No bidirectional links to maintain

### Cons
- **No fast "get all entities"**: Must iterate entire grid
- **Awkward for non-spatial entities**: UI elements, global managers
- **Entity → cell lookup**: Must search grid (slow) or maintain reverse map anyway
- **Deletion**: Must know which cell entity is in

### Best For
- Highly spatial games (RTS, tower defense, cellular automata)
- Entities primarily defined by position
- Frequent spatial queries (neighbors, area effects)

---

## Architecture C: Hybrid Layer System

**Concept**: Combine both approaches with clear layer semantics. Some layers are IDs (entities), some are values (terrain, state).

```typescript
// Define layer semantics
enum LayerType {
  TERRAIN = 0,      // values[] - static terrain type
  PLAYER = 1,       // items[] - player entity ID
  ENEMY = 2,        // items[] - enemy entity ID  
  PROJECTILE = 3,   // items[] - projectile entity ID
  ITEM = 4,         // items[] - pickup item ID
}

enum MaskType {
  WALKABLE = 0,
  VISION_BLOCKING = 1,
  FLYOVER = 2,
}

// Entities stored in registry, but spatial operations use grid
class GameWorld {
  grid: LinkedGrid;
  entities: Map<number, Entity> = new Map();
  
  // Fast reverse lookup: entityId → cell
  private entityCells: Map<number, { cell: LinkedCell, layer: number }> = new Map();
  
  spawn(type: string, cell: LinkedCell, layer: LayerType): Entity {
    // Validate layer is unoccupied
    if (cell.items[layer] !== undefined) {
      throw new Error(`Layer ${layer} occupied at (${cell.x}, ${cell.y})`);
    }
    
    const entity = new Entity(this.nextId++, type);
    
    // Store in registry
    this.entities.set(entity.id, entity);
    
    // Write to cell
    cell.items[layer] = entity.id;
    
    // Cache position for fast lookup
    this.entityCells.set(entity.id, { cell, layer });
    
    return entity;
  }
  
  move(entityId: number, toCell: LinkedCell): boolean {
    const pos = this.entityCells.get(entityId);
    if (!pos) return false;
    
    const { cell: fromCell, layer } = pos;
    
    // Check destination
    if (toCell.items[layer] !== undefined) {
      return false; // Occupied
    }
    
    // Atomic move
    fromCell.items[layer] = undefined;
    toCell.items[layer] = entityId;
    
    // Update cache
    this.entityCells.set(entityId, { cell: toCell, layer });
    
    return true;
  }
  
  // Check overlap at specific layer
  getEntityAtLayer(cell: LinkedCell, layer: LayerType): Entity | undefined {
    const id = cell.items[layer];
    return id !== undefined ? this.entities.get(id) : undefined;
  }
  
  // Get all entities in cell (all layers)
  getEntitiesInCell(cell: LinkedCell): Entity[] {
    return cell.items
      .filter(id => id !== undefined)
      .map(id => this.entities.get(id))
      .filter(e => e !== undefined) as Entity[];
  }
  
  // Overlap detection (Rule 7: "overlap" not "collision")
  detectOverlaps(cell: LinkedCell): Array<{ layer: number, entity: Entity }> {
    const overlaps = [];
    for (let layer = 0; layer < cell.items.length; layer++) {
      const id = cell.items[layer];
      if (id !== undefined) {
        const entity = this.entities.get(id);
        if (entity) overlaps.push({ layer, entity });
      }
    }
    return overlaps;
  }
}
```

### Pros
- **Best of both worlds**: Fast registry lookup + spatial queries
- **Explicit layer semantics**: Clear conventions prevent bugs
- **Fast reverse lookup**: entityCells Map gives O(1) entity → cell
- **Clean overlap resolution**: Can query all entities in a cell
- **Scales well**: Works for 100s or 1000s of entities

### Cons
- **Triple bookkeeping**: Registry + cell + reverse map
- **More code**: Most complex of the three
- **Cache invalidation**: Must update reverse map on move
- **Memory overhead**: Three data structures per entity

### Best For
- Production-quality game framework
- Need both entity-centric and spatial queries
- Multiple entity types with different behaviors
- Performance matters

---

## Comparison Matrix

| Aspect | Architecture A | Architecture B | Architecture C |
|--------|---------------|---------------|---------------|
| **Complexity** | Medium | Low | High |
| **Entity lookup** | O(1) Map | O(grid size) | O(1) Map |
| **Spatial queries** | Medium (iterate + lookup) | Fast (iterate cells) | Fast (iterate cells) |
| **Memory usage** | Medium | Low | High |
| **Move operation** | Simple | Simplest | Medium |
| **Bookkeeping** | Bidirectional | Unidirectional | Triple |
| **Best entity count** | 100-1000 | <500 | 1000+ |

---

## Recommendation for Spartan Framework

Given the Spartan rules emphasize:
- Spatial queries (line-of-sight, area effects)
- Layer-based occupation
- Overlap detection

I recommend starting with **Architecture B** (Cell-Centric) for prototyping, then evolving to **Architecture C** (Hybrid) if performance or complexity demands it.

### Phased Approach

**Phase 1**: Implement Architecture B
- Simple, aligns with grid-centric philosophy
- Easy to build movement mechanics
- Validates layer semantics

**Phase 2**: Add reverse lookup cache (moving toward C)
- When "get entity by ID" becomes a bottleneck
- Still keeps cell as source of truth

**Phase 3**: Full hybrid if needed
- When entity count grows
- When entity logic becomes complex

---

## Open Questions to Resolve

1. **Layer allocation strategy**:
   - Fixed enum (PLAYER=1, ENEMY=2)? 
   - Dynamic allocation per entity type?
   - Single "entity" layer with multi-value?

2. **Entity lifecycle**:
   - Who owns entity destruction?
   - How to handle entity death/removal?
   - Pooling for projectiles?

3. **Movement validation**:
   - Separate collision layer vs entity presence?
   - Use `masks[]` for walkability?
   - How to handle flying entities?

4. **Values vs Items vs Distances**:
   - `values[]` for what? (terrain, health?)
   - `items[]` for entities?
   - `distances[]` for pathfinding?
   - Need naming conventions

5. **Event system**:
   - Overlap events (Rule 9: propagate down layers)
   - Movement events?
   - How to notify systems?
