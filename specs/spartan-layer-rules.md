# Spartan Framework Layer Architecture Specification

## Overview

The Spartan Framework uses a fixed 8-layer architecture for all games created with the system. This opinionated structure provides a consistent mental model that works across multiple game genres while remaining simple enough for non-programmers to understand.

## Design Principles

1. **Fixed Layer Count**: Exactly 8 layers, always present, numbered 0-7
2. **Semantic Meaning**: Each layer has a specific game design purpose
3. **Entity Exclusivity**: Each entity occupies exactly one layer at a time
4. **Visual Stacking**: Higher layer numbers render on top of lower layers
5. **Multi-Entity Cells**: Multiple entities can occupy the same cell on different layers
6. **Genre Agnostic**: The same 8 layers work for roguelikes, puzzle games, shooters, adventure games, etc.

## The 8 Layers

### Layer 0: BACKGROUND
**Purpose**: Static background visual elements with no gameplay effect

**Typical Contents**:
- Background textures (static, tiled)
- Ambient visual details
- Decorative patterns
- Visual representation of voids (pits, deep water, outer space)

**Data Storage**:
- `values[0]`: Background tile type/ID
- `items[0]`: Rarely used

**Gameplay Impact**: None - purely cosmetic

**Rendering Note**: This layer stores static background tiles aligned to the grid. Parallax scrolling is not supported in the Spartan Framework.

**Design Pattern**: Use BACKGROUND to visually represent hazards/voids (stars, water, lava) while using the "Empty floor tiles block" game setting to make those cells impassable.

**Example Uses**:
- Roguelike: Dungeon void (shows through missing floor)
- Space game: Starfield (shows where there's no floor)
- Platformer: Sky/clouds background
- Water level: Deep water texture (cells without floor are impassable)

---

### Layer 1: FLOOR
**Purpose**: Walkable terrain that may have gameplay effects

**Typical Contents**:
- Ground tiles (grass, stone, sand)
- Interactive terrain (lava, water, ice, teleport pads)
- Surface effects

**Data Storage**:
- `values[1]`: Floor type (determines behavior)
- `items[1]`: Rarely used (terrain is typically in values)

**Gameplay Impact**: 
- Floor tiles are walkable by default
- May trigger effects (damage from lava, slipping on ice)
- Does not block vision
- **Game Setting**: "Empty floor tiles block" - when enabled, cells with no floor value are impassable (see Movement Blocking section)

**Example Uses**:
- Roguelike: Stone floor, lava (damages player)
- Side-scroller: Ground/platform surface
- Adventure: Different terrain types with movement costs
- Space game: Empty floor = void of space (impassable when setting enabled)

---

### Layer 2: LOGIC
**Purpose**: Invisible AI and editor helpers

**Typical Contents**:
- Spawn points
- Waypoints for AI pathfinding
- Tagged regions (shop zone, danger area)
- Trigger volumes
- Level transitions

**Data Storage**:
- `values[2]`: Region tags, zone types
- `items[2]`: Waypoint entities, spawn point entities

**Gameplay Impact**:
- Affects game logic but not visuals
- Never renders during gameplay
- Only visible in editor/debug mode

**Example Uses**:
- Roguelike: Monster spawn points, safe zones
- Shmup: Enemy wave spawn triggers
- Adventure: Room transition markers

---

### Layer 3: COLLECTIBLES
**Purpose**: Items that can be picked up by the player

**Typical Contents**:
- Coins, gems, points
- Keys, quest items
- Power-ups, health packs
- Weapons, upgrades

**Data Storage**:
- `values[3]`: Rarely used
- `items[3]`: Collectible entity IDs

**Gameplay Impact**:
- Does not block movement
- Triggers collection logic when player overlaps
- Typically removed from grid after collection

**Example Uses**:
- Roguelike: Gold, potions, scrolls
- Platformer: Coins, power stars
- Puzzle: Keys needed to unlock doors

---

### Layer 4: WALLS
**Purpose**: Static blocking elements

**Typical Contents**:
- Walls, barriers
- Locked doors
- Destructible obstacles
- Immovable terrain

**Data Storage**:
- `values[4]`: Wall type (stone, glass, metal)
- `items[4]`: Door entities, destructible wall entities

**Gameplay Impact**:
- Blocks character movement
- Typically blocks vision/line-of-sight
- Renders below actors (layer 5)

**Example Uses**:
- Roguelike: Dungeon walls, closed doors
- Puzzle: Immovable walls
- Shmup: Asteroids, barriers

---

### Layer 5: ACTORS
**Purpose**: Dynamic moving entities

**Typical Contents**:
- Player character(s)
- Enemies, monsters
- NPCs (non-player characters)
- Moving platforms
- Vehicles

**Data Storage**:
- `values[5]`: Rarely used
- `items[5]`: Actor entity IDs

**Gameplay Impact**:
- Typically blocks movement (only one actor per cell)
- Subject to AI/player control
- Renders above walls (layer 4)

**Example Uses**:
- Roguelike: Player, goblins, dragons
- Platformer: Mario, Goombas, Koopas
- Puzzle: Player, movable boxes

---

### Layer 6: EPHEMERALS
**Purpose**: Temporary visual effects, projectiles, and permanent decals

**Typical Contents**:
- **Temporary**: Projectiles (bullets, arrows, fireballs)
- **Temporary**: Explosions, particle effects
- **Temporary**: Energy beams, animation overlays
- **Permanent**: Blood splatters, scorch marks, decals

**Data Storage**:
- `values[6]`: Rarely used
- `items[6]`: Ephemeral entity IDs

**Gameplay Impact**:
- Temporary effects have short lifespan (frames to seconds)
- Permanent decals persist but don't affect gameplay
- May or may not block movement (depends on game)
- Entity exclusivity applies (one ephemeral per cell)

**Lifetime Management**:
```typescript
// Temporary effect
spatial.spawn('explosion', x, y, GameLayers.EPHEMERALS, {
  lifetime: 30  // Removed after 30 frames
});

// Permanent decal
spatial.spawn('bloodstain', x, y, GameLayers.EPHEMERALS, {
  lifetime: Infinity  // Never removed automatically
});
```

**Example Uses**:
- Roguelike: Magic missile, explosion sprites, blood pools
- Shmup: Bullet trails, laser beams, explosion marks
- Platformer: Jump dust, coin sparkle, footprints

---

### Layer 7: TEXT
**Purpose**: UI elements and text overlays

**Typical Contents**:
- HUD elements (health bars, score)
- Menus (pause, inventory, game over)
- Dialog boxes
- Floating combat text
- Tutorial messages
- Debug overlays

**Data Storage**:
- `values[7]`: Character codes for cell-based text rendering
- `items[7]`: Text/UI entity IDs

**Gameplay Impact**:
- Always renders on top of everything
- Does not affect walkability, vision, or collision
- Can be screen-space (HUD) or world-space (nameplates)
- Frequently cleared/rewritten

**Example Uses**:
- All games: Score, health, lives
- RPG: Dialog boxes, quest text
- Any genre: "Game Over", "Paused"

---

## Rendering Order

Layers render from lowest to highest (back to front):

```
Layer 0 (BACKGROUND)    ← Furthest back
Layer 1 (FLOOR)
Layer 2 (LOGIC)         ← Invisible during gameplay
Layer 3 (COLLECTIBLES)
Layer 4 (WALLS)
Layer 5 (ACTORS)
Layer 6 (EPHEMERALS)
Layer 7 (TEXT)          ← Topmost
```

**Special Case**: Layer 2 (LOGIC) renders only in editor/debug mode.

---

## Cell Data Arrays

Each `LinkedCell` contains four parallel arrays for different data types:

### `items[layer]`: Entity Occupancy
- Stores entity IDs (numbers)
- Managed by `SpatialSystem`
- One entity ID per layer
- `undefined` means layer is empty

**Example**:
```typescript
cell.values[GameLayers.WALLS] = undefined;       // No wall
cell.values[GameLayers.ACTORS] = 42;            // Player (entity ID 42)
cell.values[GameLayers.COLLECTIBLES] = 108;     // Coin (entity ID 108)
```

### `values[layer]`: Terrain/Tile Types
- Stores tile type IDs (numbers)
- Set by game logic
- Used by spatial algorithms (blockFn, passFn)

**Example**:
```typescript
cell.values[GameLayers.BACKGROUND] = TILE_DIRT_PATTERN;
cell.values[GameLayers.FLOOR] = FLOOR_LAVA;
cell.values[GameLayers.WALLS] = WALL_STONE;
```

### `masks[layer]`: Boolean Properties
- Stores boolean flags
- Game-specific properties
- Examples: explored, revealed, highlighted

**Example**:
```typescript
cell.masks[0] = true;   // Cell explored (fog of war)
cell.masks[1] = false;  // Cell not currently visible
cell.masks[2] = true;   // Cell highlighted (pathfinding preview)
```

### `distances[layer]`: Computed Fields
- Stores numeric calculations (numbers)
- Written by algorithms (Dijkstra maps, lighting, influence)
- Read for AI movement, rendering

**Example**:
```typescript
cell.distances[0] = 8;    // Distance to player (for AI)
cell.distances[1] = 255;  // Light intensity
cell.distances[2] = 3;    // Distance to nearest exit
```

---

## Blocking and Vision

### Movement Blocking
Movement can be blocked by:
- Static walls in `values[WALLS]`
- Dynamic entities in `items[WALLS]` (doors)
- Actors in `items[ACTORS]`
- Certain floor types (pits, deep water)

```typescript
function isBlocked(cell: LinkedCell): boolean {
  // Check floor blocking (pits, deep water)
  const floorType = cell.values[GameLayers.FLOOR];
  if (floorType === FLOOR_PIT || floorType === FLOOR_DEEP_WATER) {
    return true;
  }
  
  // Check walls (static terrain or dynamic entities)
  if (cell.values[GameLayers.WALLS] !== undefined ||
      cell.values[GameLayers.WALLS] !== undefined) {
    return true;
  }
  
  // Check actors
  if (cell.values[GameLayers.ACTORS] !== undefined) {
    return true;
  }
  
  return false;
}
```

**Note on Floor Blocking**: While Layer 1 (FLOOR) is generally walkable, specific floor types can block movement. This allows pits, chasms, and deep water to be represented as floor tiles that prevent passage.

### Vision Blocking
Vision can be blocked by:
- Static walls in `values[WALLS]`
- Dynamic entities in `items[WALLS]`

```typescript
function blocksVision(cell: LinkedCell): boolean {
  return cell.values[GameLayers.WALLS] !== undefined ||
         cell.values[GameLayers.WALLS] !== undefined;
}
```

**Note**: Typically only WALLS layer blocks vision. Actors and floor don't block line-of-sight in most games.

---

## Layer Usage Across Game Genres

### 1. Roguelike
```
BACKGROUND:    Dungeon floor variations
FLOOR:         Terrain effects (lava, water)
LOGIC:         Spawn points, safe zones
COLLECTIBLES:  Gold, potions, keys
WALLS:         Dungeon walls, doors
ACTORS:        Player, monsters
EPHEMERALS:    Fireballs, explosions
TEXT:          HP, inventory UI
```

### 2. Puzzle Game (Sokoban-style)
```
BACKGROUND:    Background pattern
FLOOR:         Floor tiles
LOGIC:         Win condition zones
COLLECTIBLES:  Optional gems
WALLS:         Immovable walls
ACTORS:        Player, movable boxes
EPHEMERALS:    Push animations
TEXT:          Move counter, level name
```

### 3. Side Scroller (Flyer)
```
BACKGROUND:    Parallax clouds/sky
FLOOR:         Scrolling ground/water
LOGIC:         Enemy spawn triggers
COLLECTIBLES:  Power-ups, coins
WALLS:         Obstacles, platforms
ACTORS:        Player ship, enemies
EPHEMERALS:    Bullets, explosions
TEXT:          Score, lives
```

### 4. Vertical Scroller (Shmup/Driving)
```
BACKGROUND:    Starfield / road edges
FLOOR:         Space / road surface
LOGIC:         Wave triggers
COLLECTIBLES:  Fuel, weapons
WALLS:         Barriers, asteroids
ACTORS:        Player vehicle, enemies
EPHEMERALS:    Lasers, debris
TEXT:          Speed, score
```

### 5. Adventure Game (Zelda-like)
```
BACKGROUND:    Grass pattern
FLOOR:         Different terrain types
LOGIC:         Room transitions
COLLECTIBLES:  Keys, hearts, rupees
WALLS:         Dungeon walls, locked doors
ACTORS:        Link, enemies, NPCs
EPHEMERALS:    Sword slashes, magic
TEXT:          Dialog, item messages
```

### 6. Linked Scenes
```
BACKGROUND:    Scene background
FLOOR:         Scene terrain
LOGIC:         Teleport/exit zones
COLLECTIBLES:  Scene-specific items
WALLS:         Scene boundaries
ACTORS:        Player, scene NPCs
EPHEMERALS:    Transition effects
TEXT:          Scene name, dialog
```

---

## TypeScript Implementation

### Layer Constants
```typescript
/**
 * Spartan Framework Layer Constants
 * 
 * All games use these 8 semantic layers.
 * Each layer has a specific purpose in game design.
 */
export const GameLayers = {
  BACKGROUND: 0,
  FLOOR: 1,
  LOGIC: 2,
  COLLECTIBLES: 3,
  WALLS: 4,
  ACTORS: 5,
  EPHEMERALS: 6,
  TEXT: 7,
} as const;

export type GameLayer = typeof GameLayers[keyof typeof GameLayers];
```

### Helper Constants
```typescript
/**
 * Layers that typically block movement.
 */
export const BLOCKING_LAYERS = [
  GameLayers.WALLS,
  GameLayers.ACTORS,
] as const;

/**
 * Layers that typically block vision.
 */
export const VISION_BLOCKING_LAYERS = [
  GameLayers.WALLS,
] as const;

/**
 * Layers visible during gameplay.
 * LOGIC layer excluded (only visible in editor/debug mode).
 */
export const GAMEPLAY_VISIBLE_LAYERS = [
  GameLayers.BACKGROUND,
  GameLayers.FLOOR,
  GameLayers.COLLECTIBLES,
  GameLayers.WALLS,
  GameLayers.ACTORS,
  GameLayers.EPHEMERALS,
  GameLayers.TEXT,
] as const;

/**
 * All layers (for editor mode).
 */
export const ALL_LAYERS = [
  GameLayers.BACKGROUND,
  GameLayers.FLOOR,
  GameLayers.LOGIC,
  GameLayers.COLLECTIBLES,
  GameLayers.WALLS,
  GameLayers.ACTORS,
  GameLayers.EPHEMERALS,
  GameLayers.TEXT,
] as const;
```

### Utility Functions
```typescript
/**
 * Check if a cell blocks movement.
 * Considers empty floor blocking (game setting), walls, and actors.
 * 
 * @param emptyFloorsBlock - Game setting: cells without floor are impassable
 */
export function isBlocked(cell: LinkedCell | null, emptyFloorsBlock = false): boolean {
  if (!cell) return true;
  
  // Check empty floor blocking (game setting)
  if (emptyFloorsBlock && cell.values[GameLayers.FLOOR] === undefined) {
    return true;
  }
  
  // Check wall terrain (static tilemap)
  if (cell.values[GameLayers.WALLS] !== undefined) {
    return true;
  }
  
  // Check wall entities (doors, destructibles)
  if (cell.values[GameLayers.WALLS] !== undefined) {
    return true;
  }
  
  // Check actors
  if (cell.values[GameLayers.ACTORS] !== undefined) {
    return true;
  }
  
  return false;
}

/**
 * Check if a cell blocks vision.
 */
export function blocksVision(cell: LinkedCell | null): boolean {
  if (!cell) return true;
  return VISION_BLOCKING_LAYERS.some(layer => 
    cell.values[layer] !== undefined || cell.values[layer] !== undefined
  );
}

/**
 * Check if a cell is walkable.
 */
export function isWalkable(cell: LinkedCell | null): boolean {
  return !isBlocked(cell);
}

/**
 * Get the topmost visible entity in a cell (for rendering).
 */
export function getTopmostEntity(
  cell: LinkedCell,
  visibleLayers = GAMEPLAY_VISIBLE_LAYERS
): number | undefined {
  // Check from top to bottom
  for (let i = visibleLayers.length - 1; i >= 0; i--) {
    const layer = visibleLayers[i];
    const entityId = cell.values[layer];
    if (entityId !== undefined) {
      return entityId;
    }
  }
  return undefined;
}
```



## Known Limitations & Workarounds

The fixed 8-layer architecture provides simplicity and consistency, but creates certain design constraints. This section documents known limitations and recommended workarounds.

### 1. No Overhead/Foreground Elements

**Limitation**: WALLS (layer 4) render below ACTORS (layer 5). The framework does not support "overhead" elements like archways or tree canopies that obscure the player.

**Design Constraint**: Games must use a flat 2.5D perspective. Actors cannot walk "under" foreground elements.

**This is a fundamental constraint of the 8-layer system and will not be changed.**

### 2. No Actor Stacking

**Limitation**: Only one entity per layer. A flying bird and ground soldier cannot occupy the same cell (both are ACTORS).

**Impact**: 
- Flying units cannot pass over ground units
- Party members cannot stack on one tile
- Ghosts cannot pass through walls if walls are entities

**Design Constraint**: Plan levels and mechanics around single-actor-per-cell rule.

**This is a fundamental constraint of the 8-layer system and will not be changed.**

**Workaround for "Ghosting"**: Use collision masks on entities:
```typescript
const ghost = spatial.spawn('ghost', x, y, GameLayers.ACTORS, {
  ignoresWalls: true  // Game logic allows movement through walls
});

// Modified movement check:
function canMove(entity, cell) {
  if (entity.ignoresWalls) {
    return cell.values[GameLayers.ACTORS] === undefined;  // Only check actors
  }
  return !isBlocked(cell);  // Normal blocking
}
```

### 3. Multiple Collectibles Per Cell

**Limitation**: `items[layer]` stores a single entity ID. Cannot have two collectibles (coin + key) in one cell.

**Impact**: Level designers must spread collectibles across adjacent cells or use container entities.

**Workarounds**:
- **Container entities**: Create a "LootPile" entity that contains multiple items
  ```typescript
  spatial.spawn('lootpile', x, y, GameLayers.COLLECTIBLES, {
    contains: [ITEM_COIN, ITEM_KEY, ITEM_POTION]
  });
  ```
- **Adjacent placement**: Force collectibles into neighboring cells
- **Accept the constraint**: Design levels with sufficient space between items

### 4. No Parallax Scrolling

**Limitation**: The framework does not support parallax background scrolling (multiple background layers moving at different speeds).

**Design Constraint**: Background layer is static and grid-aligned.

**Rationale**: Parallax typically requires procedural generation and camera-relative positioning, which is beyond the scope of the Spartan Framework's grid-based design.

**This is a fundamental constraint and will not be changed.**

---

## Rendering Architecture (Out of Scope)

The 8-layer system is designed at the game logic level and is agnostic to rendering implementation. However, for reference, the layer architecture naturally maps to two rendering strategies:

**Grid-Aligned Layers (0-5, 7)**: 
- Typically rendered using static geometry with data textures
- Content is cell-aligned
- Efficient for large grids with mostly static content
- Single draw call per layer possible

**Dynamic Layer (6 - EPHEMERALS)**:
- Typically rendered using dynamic sprite pool with free quads
- Supports per-entity transforms (rotation, scale, fade)
- Can have sub-grid positioning during interpolation
- Optimized for frequent spawning/despawning

This separation is a rendering optimization detail and does not affect the game logic layer system described in this specification.

---

## Best Practices

### DO:
- ✓ Use `GameLayers` constants instead of magic numbers
- ✓ Check blocking layers before movement
- ✓ Clean up ephemerals regularly (remove when animation ends)
- ✓ Use LOGIC layer for invisible game mechanics
- ✓ Keep TEXT layer free from gameplay logic
- ✓ Store terrain types in `values[]`, entities in `items[]`

### DON'T:
- ✗ Create custom layers beyond the 8 defined
- ✗ Store entities in `values[]` or terrain in `items[]`
- ✗ Make LOGIC layer visible during gameplay
- ✗ Block movement with COLLECTIBLES layer
- ✗ Put gameplay-affecting elements in BACKGROUND layer
- ✗ Forget to remove collected items from the grid

---

## Migration from Abstract to Concrete

If migrating from an abstract layer system:

**Before** (abstract):
```typescript
const PLAYER_LAYER = 5;
const WALL_LAYER = 3;
cell.values[PLAYER_LAYER] = playerId;
```

**After** (concrete):
```typescript
import { GameLayers } from './layers';
cell.values[GameLayers.ACTORS] = playerId;
cell.values[GameLayers.WALLS] = wallId;
```

The semantic names make code self-documenting and prevent mistakes.

---

## Advanced Usage

### Entity Sprite System

All entities support up to 5 sprite states with 5 animation frames each (25 total variations):

```typescript
// Create entity with sprite configuration
spatial.spawn('player', x, y, GameLayers.ACTORS, {
  // Current sprite state (0-4)
  spriteState: 0,  // 0=idle, 1=walk, 2=attack, 3=hurt, 4=dead
  
  // Current animation frame (0-4)
  spriteFrame: 0,
  
  // Animation speed (frames between sprite updates)
  animSpeed: 6
});

// Game loop updates animation
function updateAnimation(entity) {
  entity.frameCounter = (entity.frameCounter || 0) + 1;
  
  if (entity.frameCounter >= entity.animSpeed) {
    entity.frameCounter = 0;
    entity.spriteFrame = (entity.spriteFrame + 1) % 5;
  }
}

// Change state based on action
function attackEnemy(entity) {
  entity.spriteState = 2;  // Switch to attack state
  entity.spriteFrame = 0;  // Reset to first frame
}
```

**Sprite Editor**: The sprite editor allows creators to define all 25 sprite variations visually (5 states × 5 frames).

### Floor Type Effects

Using floor values to trigger gameplay effects without blocking movement:

```typescript
// Define floor effect types
const FLOOR_GRASS = 0;      // Normal
const FLOOR_LAVA = 1;       // Damages player
const FLOOR_ICE = 2;        // Slippery movement
const FLOOR_TELEPORT = 3;   // Instant transport

const FLOOR_EFFECTS = {
  [FLOOR_LAVA]: (entity) => damageEntity(entity, 5),
  [FLOOR_ICE]: (entity) => applySlippery(entity),
  [FLOOR_TELEPORT]: (entity) => teleportEntity(entity),
};

// Game loop checks floor effects
function updateActorOnFloor(actorId: number, cell: LinkedCell) {
  const floorType = cell.values[GameLayers.FLOOR];
  const effectFn = FLOOR_EFFECTS[floorType];
  if (effectFn) {
    effectFn(actorId);
  }
}
```

**Note**: Floor effects are separate from blocking. All floor types are walkable unless the "Empty floor tiles block" setting is enabled and the cell has no floor value.

### Fog of War with Masks

Using cell masks for visibility state:

```typescript
const MASK_EXPLORED = 0;
const MASK_VISIBLE = 1;

// Mark cells as explored but not visible
cell.applyFogOfWar(
  visionRadius,
  c => c.values[GameLayers.WALLS] !== undefined,
  MASK_VISIBLE,    // Currently visible
  MASK_EXPLORED    // Previously explored
);

// Renderer checks masks
if (cell.masks[MASK_VISIBLE]) {
  renderCell(cell, 'full');
} else if (cell.masks[MASK_EXPLORED]) {
  renderCell(cell, 'dimmed');
} else {
  renderCell(cell, 'hidden');
}
```

### Entity State Transitions Between Layers

Entities can change layers when entering special states. This is the recommended pattern for mechanics like "ghosting", "returning to base", or temporary invulnerability.

**Pattern: Remove from one layer, spawn on another**

```typescript
// Example: Pacman ghost eaten, returns to base
class GhostSystem {
  eatGhost(ghostId: number, x: number, y: number) {
    const ghost = spatial.getEntityData(ghostId);
    
    // Remove from ACTORS layer
    spatial.remove(x, y, GameLayers.ACTORS);
    
    // Spawn on EPHEMERALS layer with new state
    spatial.spawn('ghost_returning', x, y, GameLayers.EPHEMERALS, {
      originalType: ghost.type,
      state: 'returning',
      targetX: BASE_X,
      targetY: BASE_Y,
      lifetime: Infinity
    });
  }
  
  updateReturningGhosts() {
    // Find all returning ghosts on EPHEMERALS layer
    const returning = this.findEntitiesByState('returning');
    
    for (const ghost of returning) {
      // Move toward base (can pass through walls and actors)
      const pos = this.getEntityPosition(ghost.id);
      const next = this.getNextCellToward(pos, ghost.targetX, ghost.targetY);
      
      spatial.move(pos.x, pos.y, next.x, next.y, GameLayers.EPHEMERALS);
      
      // Reached base?
      if (next.x === ghost.targetX && next.y === ghost.targetY) {
        spatial.remove(next.x, next.y, GameLayers.EPHEMERALS);
        spatial.spawn(ghost.originalType, BASE_X, BASE_Y, GameLayers.ACTORS);
      }
    }
    
    spatial.commit();
  }
}
```

**Why this works:**
- ACTORS layer: Normal collision and blocking
- EPHEMERALS layer: Can pass through walls and overlap other actors
- Layer switch = behavior change
- One entity per layer maintained

**Common use cases:**
- Ghost returning to base (ACTORS → EPHEMERALS → ACTORS)
- Player death animation (ACTORS → EPHEMERALS, then respawn)
- Teleportation effects (ACTORS → EPHEMERALS for flash, then ACTORS at new location)
- Temporary invulnerability (ACTORS → EPHEMERALS briefly)

### Special Movement Abilities

Using entity properties to override normal blocking:

```typescript
// Ghost that passes through walls
const ghost = spatial.spawn('ghost', x, y, GameLayers.ACTORS, {
  ignoresWalls: true,
  spriteState: 0
});

// Modified movement validation
function canEntityMove(entityId: number, cell: LinkedCell, emptyFloorsBlock = false): boolean {
  const entity = spatial.getEntityData(entityId);
  
  // Check empty floor blocking (applies to all entities unless they ignore it)
  if (emptyFloorsBlock && cell.values[GameLayers.FLOOR] === undefined) {
    return false;
  }
  
  // Check walls (can be ignored by special entities)
  if (!entity.ignoresWalls) {
    if (cell.values[GameLayers.WALLS] !== undefined ||
        cell.values[GameLayers.WALLS] !== undefined) {
      return false;
    }
  }
  
  // Check actors (always blocked)
  if (cell.values[GameLayers.ACTORS] !== undefined) {
    return false;
  }
  
  return true;
}
```

**Note**: This allows phasing through walls but NOT through other actors. For full overlap capability, use layer transitions instead.

---

## Future Considerations

### Advanced Features (Optional)
- **Layer Renaming**: Allow users to rename layers (e.g., "ACTORS" → "CARS") while keeping the underlying index
- **Layer Visibility Groups**: Preset visibility configurations for different editing modes
- **Layer Locking**: Prevent accidental edits to specific layers
- **Layer Templates**: Pre-configured layer setups for different game genres

### Potential Extensions
- **Sub-layers**: If needed, use entity properties rather than adding more layers
- **Composite Rendering**: Allow entities to render sprites from multiple layers
- **Custom Block Functions**: Per-layer blocking behavior customization

---

## Version History

- **v1.1** (2026-01-25): Added floor blocking mechanics, clarified parallax, added limitations section, fixed `isBlocked` implementation
- **v1.0** (2026-01-25): Initial specification with 8-layer architecture

---

## Summary

The Spartan Framework's 8-layer architecture provides:
- **Consistency**: Same structure for all game types
- **Clarity**: Each layer has a clear purpose
- **Simplicity**: Fixed count reduces decision fatigue
- **Power**: Sufficient for diverse game genres
- **Learnability**: Semantic names are self-documenting

**Known Limitations**:
- No overhead/foreground elements (flat 2.5D only)
- No actor stacking (single actor per cell)
- Single collectible per cell (use container entities for multiple)
- No parallax scrolling
- All entities limited to 5 sprite states × 5 animation frames

**Key Implementation Details**:
- Check BOTH `values[]` AND `items[]` for blocking
- Empty floor cells can block movement (game setting: "Empty floor tiles block")
- BACKGROUND layer shows through empty floor cells (for pits, voids, space)
- EPHEMERALS layer handles both temporary effects and permanent decals
- Entity sprite system provides 25 visual variations per entity type
- Entity properties provide extension points for special abilities (ghosting, etc.)

This specification should be treated as the authoritative reference for all Spartan Framework implementations and game creator tools.