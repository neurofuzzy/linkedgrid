# Spartan Framework Implementation Plan

**Version**: 2.0  
**Date**: 2026-01-27  
**Status**: Active Development Roadmap

---

## Executive Summary

The Spartan Framework is **95% complete** architecturally. The remaining 5% is not additive features—it's **consolidation and clarification**. This document guides the next phase: making the core **more powerful by removing inconsistencies**, not by adding complexity.

### Core Philosophy

> "A game is a problem-space. Systems resolve interactions."

**This is the foundation. Everything else serves this.**

---

## Current State Assessment

### What Works ✅

1. **Spatial-first architecture** - Grid as ground truth
2. **8-layer system** - Semantic clarity for all game types
3. **Overlap detection** - Universal primitive for interactions
4. **Two-phase commit for moves** - Elegant convoy movement
5. **Scene isolation** - Clean multi-scene state management
6. **Clear responsibilities** - Each component has one job

### What Needs Fixing 🔧

1. **Transaction inconsistency** - Move deferred, remove/spawn immediate
2. **Scene transitions mid-tick** - Creates zombie scene states
3. **System ordering dependencies** - Implicit, undocumented
4. **Missing abstractions** - No `toSnapshot()`, no `transferEntity()`
5. **Documentation gaps** - GameSystem interface, EntityData structure

### What NOT to Add 🚫

- ❌ ECS library (wrong abstraction for spatial games)
- ❌ Component queries (spatial queries are sufficient)
- ❌ System priorities (explicit order is clearer)
- ❌ Entity hierarchies (flat is simpler)
- ❌ More layers (8 is enough)

---

## Priority 1: Transaction Consistency (CRITICAL)

### Problem

```typescript
// Current: Inconsistent execution timing
spatial.move(5, 5, 6, 5, 1);      // Staged (deferred)
spatial.remove(x, y, layer);       // Immediate (executes now)
spatial.spawn('enemy', x, y, 5);   // Immediate (executes now)
```

**Why this is bad:**
- System A can remove entity, System B sees it gone
- But System A moves entity, System B doesn't see new position
- Creates temporal coupling and ghost entities

### Solution: Unified Transaction Model

**Make all operations deferred:**

```typescript
class SpatialSystem {
  private pendingOps: Operation[] = [];
  
  // All operations just stage intents
  move(fromX, fromY, toX, toY, layer, blockFn?) {
    const entityId = this.grid.cell(fromX, fromY)?.getValue(layer);
    if (entityId === undefined) return;
    
    this.pendingOps.push({
      type: 'move',
      entityId,
      fromX, fromY,
      toX, toY,
      layer,
      blockFn
    });
  }
  
  remove(x: number, y: number, layer: Layer) {
    const entityId = this.grid.cell(x, y)?.getValue(layer);
    if (entityId === undefined) return;
    
    this.pendingOps.push({
      type: 'remove',
      entityId,
      x, y, layer
    });
  }
  
  spawn(type: string, x: number, y: number, layer: Layer, props?: object): number {
    // Generate ID but don't place yet
    const entityId = this.store.createId(type, props);
    
    this.pendingOps.push({
      type: 'spawn',
      entityId,
      x, y, layer
    });
    
    return entityId;
  }
  
  commit() {
    // Execute in order: removes → moves → spawns
    // This prevents ghost entities and ensures clean state
    
    // 1. Process removals
    const removals = this.pendingOps.filter(op => op.type === 'remove');
    for (const op of removals) {
      this.executeRemove(op);
    }
    
    // 2. Process moves (existing two-phase logic)
    const moves = this.pendingOps.filter(op => op.type === 'move');
    this.executeMoves(moves);
    
    // 3. Process spawns
    const spawns = this.pendingOps.filter(op => op.type === 'spawn');
    for (const op of spawns) {
      this.executeSpawn(op);
    }
    
    // 4. Clear all pending operations
    this.pendingOps = [];
  }
}
```

### Benefits

- ✅ All systems see **immutable grid state** during tick
- ✅ No temporal coupling between systems
- ✅ No ghost entities from remove + move conflicts
- ✅ Clear causality: "declare all intents, then execute atomically"

### Migration Guide

**Before:**
```typescript
// Systems could immediately check results
spatial.remove(x, y, layer);
if (spatial.getEntityIdAt(x, y, layer) === undefined) {
  // Entity is gone, do something
}
```

**After:**
```typescript
// Systems stage intents, can't check within same tick
spatial.remove(x, y, layer);
// Entity still visible to later systems this tick
// Removal happens at commit
```

**If systems need to react to removals:**
- Add `DeathReactionSystem` that runs NEXT tick
- Or split tick into phases (see Priority 2)

---

## Priority 2: Scene Transition Queuing (HIGH)

### Problem

```typescript
// TeleporterSystem changes scene mid-tick
gameManager.movePlayerToScene('dungeon', 5, 5, GameLayers.ACTORS);

// Later systems run in zombie scene
// GameLoop still points to old spatial system
// Commit happens in scene player already left
```

### Solution: Queue Transitions

```typescript
class GameManager {
  private pendingSceneTransition?: {
    sceneId: string;
    x: number;
    y: number;
    layer: Layer;
  };
  
  movePlayerToScene(sceneId: string, x: number, y: number, layer: Layer) {
    // Don't execute immediately - queue for after tick
    this.pendingSceneTransition = { sceneId, x, y, layer };
  }
  
  executePendingTransition(): boolean {
    if (!this.pendingSceneTransition) return false;
    
    const { sceneId, x, y, layer } = this.pendingSceneTransition;
    
    // Now execute the transition
    const success = this._movePlayerToSceneImmediate(sceneId, x, y, layer);
    
    this.pendingSceneTransition = undefined;
    return success;
  }
}

class GameRuntime {
  tick() {
    // 1. Run game loop (systems stage intents)
    this.gameLoop.tick();
    
    // 2. Check for queued scene transition
    const sceneChanged = this.game.executePendingTransition();
    
    // 3. If scene changed, rebuild game loop
    if (sceneChanged) {
      const newScene = this.game.sceneManager.getActiveScene();
      if (newScene) {
        this.gameLoop = new GameLoop(newScene.spatial);
        this.registerSystems();
      }
    }
  }
}
```

### Benefits

- ✅ No zombie scenes - transitions happen at tick boundaries
- ✅ All systems execute in consistent scene
- ✅ Clear execution model: tick → transition → next tick

---

## Priority 3: Extract Cross-Scene Operations (MEDIUM)

### Problem

`GameManager.movePlayerToScene()` is 77 lines with manual store manipulation:

```typescript
// Anti-pattern: bypassing encapsulation
const currentStore = currentScene.store as any;
const targetStore = targetScene.store as any;
targetStore.data.set(playerId, playerData);
```

### Solution: Add transferEntity() to SpatialSystem

```typescript
class SpatialSystem {
  /**
   * Transfer an entity to another spatial system.
   * Preserves entity ID and all metadata.
   * 
   * @returns true if successful, false if failed
   */
  transferEntity(
    entityId: number,
    targetSpatial: SpatialSystem,
    x: number,
    y: number,
    layer: Layer
  ): boolean {
    // Get current position
    const pos = this.getEntityPosition(entityId);
    if (!pos) return false;
    
    // Get entity data
    const data = this.store.getData(entityId);
    if (!data) return false;
    
    // Check target is valid
    const targetCell = targetSpatial.grid.cell(x, y);
    if (!targetCell) return false;
    if (targetCell.getValue(layer) !== undefined) return false;
    
    // Remove from source (stage if using unified transactions)
    this.remove(pos.x, pos.y, pos.layer);
    
    // Add to target with same ID
    // Need new method: spawnWithId()
    targetSpatial.spawnWithId(entityId, data, x, y, layer);
    
    return true;
  }
  
  /**
   * Spawn entity with specific ID (for transfers).
   * Internal use only - normal spawns use spawn().
   */
  private spawnWithId(
    entityId: number,
    data: EntityData,
    x: number,
    y: number,
    layer: Layer
  ) {
    const cell = this.grid.cell(x, y);
    if (!cell) throw new Error('Invalid coordinates');
    if (cell.getValue(layer) !== undefined) throw new Error('Layer occupied');
    
    // Add to store with existing ID
    this.store.data.set(entityId, data);
    
    // Place in grid
    cell.setValue(layer, entityId);
    
    // Track position
    this.positions.set(entityId, { x, y, layer });
  }
}

class GameManager {
  movePlayerToScene(sceneId: string, x: number, y: number, layer: Layer): void {
    const playerId = this.gameState.playerEntityId;
    if (playerId === 0) return;
    
    const currentScene = this.getPlayerScene();
    const targetScene = this.sceneManager.getScene(sceneId);
    
    if (!currentScene || !targetScene) return;
    
    // Use spatial system's transfer method
    const success = currentScene.spatial.transferEntity(
      playerId,
      targetScene.spatial,
      x, y, layer
    );
    
    if (success) {
      // Queue scene switch (Priority 2)
      this.pendingSceneTransition = { sceneId, x, y, layer };
    }
  }
}
```

### Benefits

- ✅ No manual store manipulation
- ✅ Encapsulation preserved
- ✅ Single responsibility (SpatialSystem handles transfers)
- ✅ Reusable for any entity transfer

---

## Priority 4: Add Missing Interfaces (MEDIUM)

### EntityData Interface

```typescript
// Add to types.ts

/**
 * Entity metadata stored in SparseEntityStore.
 * 
 * All entities must have id and type.
 * Additional properties are game-specific.
 */
export interface EntityData {
  /** Unique entity ID (auto-generated) */
  id: number;
  
  /** Entity type identifier */
  type: string;
  
  /** Additional game-specific properties */
  [key: string]: unknown;
}

// Example typed entities
export interface PlayerEntity extends EntityData {
  type: 'player';
  hp: number;
  maxHp: number;
  damage: number;
  sprite?: string;
}

export interface EnemyEntity extends EntityData {
  type: 'enemy';
  hp: number;
  damage: number;
  aiState: 'idle' | 'chasing' | 'attacking';
  target?: number;
}
```

### GameSystem Interface

```typescript
// Add to types.ts

/**
 * Context provided to systems each tick.
 */
export interface GameContext {
  /** Overlaps detected at start of tick (immutable) */
  overlaps: Array<{
    position: { x: number; y: number };
    entityIds: number[];
  }>;
  
  /** Spatial system for queries and staging operations */
  spatial: SpatialSystem;
}

/**
 * Game system that interprets spatial facts and stages responses.
 * 
 * Systems run in registration order each tick.
 * All operations (move, remove, spawn) are staged, not executed.
 * Commit happens after all systems complete.
 */
export interface GameSystem {
  /** System name (for debugging) */
  name?: string;
  
  /**
   * Update system logic for one tick.
   * 
   * Read from context.overlaps and context.spatial.
   * Stage operations via spatial.move(), spatial.remove(), spatial.spawn().
   * Mutate GameState directly if needed (lives, score, inventory).
   */
  update(context: GameContext): void;
}
```

### Snapshot Interfaces

```typescript
// Add to types.ts

/**
 * Entity snapshot for testing and visualization.
 */
export interface EntitySnapshot {
  id: number;
  type: string;
  x: number;
  y: number;
  layer: number;
  data?: Record<string, unknown>;
}

/**
 * Scene snapshot for testing and visualization.
 */
export interface SceneSnapshot {
  sceneId: string;
  sceneName?: string;
  grid: { w: number; h: number };
  entities: EntitySnapshot[];
}
```

### Add to Scene class

```typescript
class Scene {
  // ... existing code ...
  
  /**
   * Generate snapshot of current scene state.
   * Used for testing, visualization, and debugging.
   */
  toSnapshot(): SceneSnapshot {
    const entities: EntitySnapshot[] = [];
    
    for (const [id, pos] of this.spatial.getAllPositions()) {
      const data = this.store.getData(id);
      if (data) {
        entities.push({
          id,
          type: data.type,
          x: pos.x,
          y: pos.y,
          layer: pos.layer,
          data
        });
      }
    }
    
    return {
      sceneId: this.id,
      sceneName: this.metadata.name as string,
      grid: { w: this.grid.width, h: this.grid.height },
      entities
    };
  }
}
```

---

## Priority 5: Document System Contracts (HIGH)

### Add to spartan-responsibilities.md

```markdown
## GameSystem Contract

### Purpose
Systems interpret spatial facts and stage responses to resolve interactions.

### Execution Model
```
TICK N:
1. Detect overlaps → immutable snapshot
2. Run systems in order → each stages intents
3. Commit → execute all intents atomically
```

### What Systems Receive
- `overlaps`: Array of cells with 2+ entities (immutable for entire tick)
- `spatial`: Query interface for entity data and positions

### What Systems Can Do
✅ Read entity data: `spatial.getEntityData(id)`
✅ Query positions: `spatial.getEntityPosition(id)`, `spatial.getEntityIdsInRadius(x, y, r)`
✅ Stage moves: `spatial.move(x1, y1, x2, y2, layer)`
✅ Stage removals: `spatial.remove(x, y, layer)`
✅ Stage spawns: `spatial.spawn(type, x, y, layer, props)`
✅ Mutate GameState: `gameState.score += 10`, `gameState.inventory.set('key', 3)`

### What Systems CANNOT Do
❌ Call `spatial.commit()` - GameLoop's responsibility
❌ Modify grid directly - use SpatialSystem methods
❌ Assume operations executed immediately - all are staged
❌ Query "what will happen" - can only see current committed state

### Guarantees
- All systems see same overlap snapshot
- All systems see same grid state (pre-commit)
- Staged operations execute atomically after all systems run
- Systems run in registration order (deterministic)
- Scene transitions happen at tick boundaries (never mid-tick)

### System Ordering Best Practices
```typescript
// 1. REACT - Respond to overlaps
runtime.addSystem(new CoinCollectionSystem());
runtime.addSystem(new TeleporterSystem(gameManager));
runtime.addSystem(new CombatSystem());

// 2. DEATH - Stage removals for dead entities
runtime.addSystem(new DeathSystem());

// 3. AI - Make movement decisions
runtime.addSystem(new EnemyAISystem());

// 4. SPAWN - Create new entities
runtime.addSystem(new SpawnerSystem());
```

Order matters because later systems see staged intents (can't query final state).
```

---

## Priority 6: Example Systems (MEDIUM)

Create `examples/systems/` directory with documented examples:

### 1. CoinCollectionSystem

```typescript
/**
 * Collects coins when player overlaps them.
 * 
 * Pattern: Overlap detection → stage removal → update GameState
 */
export class CoinCollectionSystem implements GameSystem {
  name = 'CoinCollectionSystem';
  
  constructor(private gameState: GameState) {}
  
  update({ overlaps, spatial }: GameContext): void {
    for (const overlap of overlaps) {
      const entities = overlap.entityIds
        .map(id => ({ id, data: spatial.getEntityData(id) }))
        .filter(e => e.data !== undefined);
      
      const player = entities.find(e => e.data!.type === 'player');
      const coin = entities.find(e => e.data!.type === 'coin');
      
      if (player && coin) {
        // Stage coin removal
        const coinPos = spatial.getEntityPosition(coin.id);
        if (coinPos) {
          spatial.remove(coinPos.x, coinPos.y, coinPos.layer);
        }
        
        // Update score immediately (GameState is mutable)
        this.gameState.score += (coin.data as any).value || 1;
      }
    }
  }
}
```

### 2. TeleporterSystem

```typescript
/**
 * Teleports player between scenes when overlapping teleporter.
 * 
 * Pattern: Overlap detection → queue scene transition
 */
export class TeleporterSystem implements GameSystem {
  name = 'TeleporterSystem';
  
  constructor(private gameManager: GameManager) {}
  
  update({ overlaps, spatial }: GameContext): void {
    for (const overlap of overlaps) {
      const entities = overlap.entityIds
        .map(id => ({ id, data: spatial.getEntityData(id) }))
        .filter(e => e.data !== undefined);
      
      const player = entities.find(e => e.data!.type === 'player');
      const teleporter = entities.find(e => e.data!.type === 'teleporter');
      
      if (player && teleporter) {
        const tpData = teleporter.data as any;
        
        // Queue scene transition (happens after tick)
        this.gameManager.movePlayerToScene(
          tpData.targetScene,
          tpData.targetX,
          tpData.targetY,
          GameLayers.ACTORS
        );
      }
    }
  }
}
```

### 3. CombatSystem

```typescript
/**
 * Applies damage when player overlaps enemy.
 * 
 * Pattern: Overlap detection → modify entity data
 */
export class CombatSystem implements GameSystem {
  name = 'CombatSystem';
  
  update({ overlaps, spatial }: GameContext): void {
    for (const overlap of overlaps) {
      const entities = overlap.entityIds
        .map(id => ({ id, data: spatial.getEntityData(id) }))
        .filter(e => e.data !== undefined);
      
      const player = entities.find(e => e.data!.type === 'player');
      const enemy = entities.find(e => e.data!.type === 'enemy');
      
      if (player && enemy) {
        // Mutual damage
        (player.data as any).hp -= (enemy.data as any).damage || 10;
        (enemy.data as any).hp -= (player.data as any).damage || 10;
      }
    }
  }
}
```

### 4. DeathSystem

```typescript
/**
 * Removes entities with hp <= 0.
 * 
 * Pattern: Iterate all entities → check condition → stage removal
 */
export class DeathSystem implements GameSystem {
  name = 'DeathSystem';
  
  update({ spatial }: GameContext): void {
    for (const [id, pos] of spatial.getAllPositions()) {
      const data = spatial.getEntityData(id);
      if (!data) continue;
      
      const hp = (data as any).hp;
      if (hp !== undefined && hp <= 0) {
        // Stage removal
        spatial.remove(pos.x, pos.y, pos.layer);
      }
    }
  }
}
```

### 5. EnemyAISystem

```typescript
/**
 * Moves enemies toward player using simple pathfinding.
 * 
 * Pattern: Query spatial → compute path → stage move
 */
export class EnemyAISystem implements GameSystem {
  name = 'EnemyAISystem';
  
  constructor(private gameState: GameState) {}
  
  update({ spatial }: GameContext): void {
    const playerId = this.gameState.playerEntityId;
    const playerPos = spatial.getEntityPosition(playerId);
    if (!playerPos) return;
    
    // Find all enemies
    for (const [id, pos] of spatial.getAllPositions()) {
      const data = spatial.getEntityData(id);
      if (data?.type !== 'enemy') continue;
      
      // Simple chase: move one step toward player
      const dx = Math.sign(playerPos.x - pos.x);
      const dy = Math.sign(playerPos.y - pos.y);
      
      // Try horizontal movement first
      if (dx !== 0) {
        spatial.move(pos.x, pos.y, pos.x + dx, pos.y, pos.layer);
      } else if (dy !== 0) {
        spatial.move(pos.x, pos.y, pos.x, pos.y + dy, pos.layer);
      }
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

Test each component in isolation:

```typescript
describe('SpatialSystem transaction consistency', () => {
  it('defers all operations until commit', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);
    
    // Arrange
    const id = spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    spatial.commit();
    
    // Act - stage operations
    spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
    spatial.remove(6, 5, GameLayers.ACTORS);
    
    // Assert - nothing executed yet
    expect(spatial.getEntityPosition(id)).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });
    expect(spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)).toBeUndefined();
    
    // Act - commit
    spatial.commit();
    
    // Assert - operations executed
    expect(spatial.getEntityPosition(id)).toBeNull();
    expect(spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)).toBeUndefined();
    expect(spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)).toBeUndefined();
  });
});
```

### Integration Tests

Test system interactions:

```typescript
describe('CoinCollectionSystem + DeathSystem', () => {
  it('collects coin then removes it', () => {
    const runtime = GameRuntime.new({
      initialScene: { id: 'test', width: 10, height: 10 },
      systems: [
        new CoinCollectionSystem(runtime.game.gameState),
        new DeathSystem()
      ],
      tickRate: 10
    });
    
    // Arrange
    const coinId = runtime.spatial.spawn('coin', 5, 5, GameLayers.COLLECTIBLES, { value: 10 });
    const playerId = runtime.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    runtime.game.gameState.playerEntityId = playerId;
    runtime.spatial.commit();
    
    // Act
    runtime.tick();
    
    // Assert
    expect(runtime.game.gameState.score).toBe(10);
    expect(runtime.spatial.getEntityPosition(coinId)).toBeNull();
  });
});
```

---

## Documentation Updates

### Update spartan-scene-spec.md

Add EntityData and Snapshot interfaces (see Priority 4).

### Update spartan-responsibilities.md

Add GameSystem contract (see Priority 5).

### Update spartan-layer-rules.md

Add custom blocking example:

```markdown
### Custom Movement Blocking

```typescript
import { isBlocked } from './layer-utils';

// Game-specific blocking (empty floors block)
const emptyFloorsBlock = true;
spatial.move(x1, y1, x2, y2, GameLayers.ACTORS, 
  (cell) => isBlocked(cell, emptyFloorsBlock)
);
spatial.commit();
```

This allows:
- Game-specific blocking rules (lava, water, etc.)
- Settings like "empty floors block"
- Different blocking for different entity types
```

---

## Migration Path

### Phase 1: Fix Transactions (Week 1)

- Implement unified transaction model (Priority 1)
- Update all tests
- Verify no regressions

### Phase 2: Queue Transitions (Week 1)

- Implement scene transition queuing (Priority 2)
- Update GameManager and GameRuntime
- Test cross-scene teleportation

### Phase 3: Extract Operations (Week 2)

- Add transferEntity() to SpatialSystem (Priority 3)
- Refactor GameManager.movePlayerToScene()
- Add unit tests

### Phase 4: Add Interfaces (Week 2)

- Define EntityData, GameSystem, Snapshot interfaces (Priority 4)
- Add toSnapshot() to Scene
- Update TypeScript types

### Phase 5: Documentation (Week 3)

- Document system contracts (Priority 5)
- Write example systems (Priority 6)
- Update all spec files

---

## Success Criteria

### Code Quality

- ✅ All operations use consistent transaction model
- ✅ No `as any` bypassing encapsulation
- ✅ Scene transitions at tick boundaries only
- ✅ All interfaces documented with examples
- ✅ 90%+ test coverage

### Developer Experience

- ✅ Coding agents can implement systems without asking questions
- ✅ System execution model is obvious from documentation
- ✅ Transaction boundaries are clear
- ✅ Error messages are helpful

### Architecture

- ✅ No temporal coupling between systems
- ✅ No ghost entities from operation conflicts
- ✅ Clear causality (declare → commit → next tick)
- ✅ All responsibilities cleanly separated

---

## Non-Goals

What we're explicitly NOT doing:

- ❌ Adding ECS library
- ❌ Adding component query DSL
- ❌ Adding system priority system
- ❌ Adding entity hierarchies/parent-child
- ❌ Adding async system support (yet)
- ❌ Adding more than 8 layers
- ❌ Adding automatic system ordering

**Principle**: Make the core more powerful by removing inconsistencies, not by adding features.

---

## Appendix: Architecture Principles

### 1. Spatial-First

Grid is ground truth. Entities exist at positions. Systems query spatially.

**Good:**
```typescript
const nearby = spatial.getEntityIdsInRadius(x, y, 5);
```

**Bad:**
```typescript
const nearby = query([Position]).filter(e => distance(e, player) < 5);
```

### 2. Systems as Interpreters

Systems don't push state changes. They interpret spatial facts and stage responses.

**Good:**
```typescript
if (player overlaps teleporter) {
  stage move to destination
}
```

**Bad:**
```typescript
teleporter.onPlayerEnter = (player) => {
  player.x = dest.x;
  player.y = dest.y;
}
```

### 3. Overlap is Universal

All interactions reduce to "entities occupying same cell."

**Examples:**
- Combat: player + enemy
- Collection: player + coin
- Teleportation: player + teleporter
- Triggers: player + pressure plate

### 4. Declarative Staging

Operations declare intent, don't execute.

**Good:**
```typescript
spatial.move(x1, y1, x2, y2, layer);  // Staged
// ... systems continue ...
spatial.commit();  // Executed atomically
```

**Bad:**
```typescript
cell.setValue(layer, entityId);  // Immediate mutation
```

### 5. Clear Transaction Boundaries

Either everything is transactional, or nothing is. No mixing.

**Current (bad):** Move transactional, remove/spawn immediate  
**Fixed (good):** All operations transactional

---

## Conclusion

The Spartan Framework is **nearly complete**. The remaining work is:

1. **Fix transaction consistency** (1-2 days)
2. **Queue scene transitions** (4 hours)
3. **Extract cross-scene operations** (4 hours)
4. **Add missing interfaces** (4 hours)
5. **Document system contracts** (4 hours)
6. **Write example systems** (1 day)

**Total: ~1 week of focused work.**

After this, the framework will be **production-ready** with a clear, consistent, Spartan core that future coding agents can extend without adding complexity.

**The goal is not to add features. The goal is to make what we have more powerful.**

# Spartan Framework Implementation Plan - Dragon Mitigation

**Addendum to**: spartan-implementation-plan.md  
**Date**: 2026-01-27  
**Status**: Critical Pre-Implementation Analysis

---

## Executive Summary

The transaction unification plan (Priority 1) is **architecturally correct but operationally dangerous**. This document addresses three critical implementation dragons that will determine success or failure.

**Bottom line**: The plan is sound, but Phase 0 (safety infrastructure) is mandatory before touching any transaction logic.

---

## Dragon 1: Zombie Entity Problem

### The Trap

```typescript
// Tick N:
// 1. ProjectileSystem
const enemies = spatial.getEntityIdsInRadius(x, y, 5);
for (const id of enemies) {
  const data = spatial.getEntityData(id);
  if (data.hp > 0) {
    applyDamage(id, 50);
    if (data.hp <= 0) {
      spatial.remove(x, y, layer);  // Staged removal
    }
  }
}

// 2. ChainLightningSystem (runs after projectile)
const targets = spatial.getEntityIdsInRadius(x, y, 8);
// Finds the dead goblin because removal not committed yet!
for (const id of targets) {
  const data = spatial.getEntityData(id);
  // data.hp is -50, but entity is still in grid
  // Should we chain lightning to a corpse?
}
```

**Expected behavior**: Dead goblin shouldn't be targetable  
**Actual behavior**: Dead goblin found in radius query

### Why "Next Tick" Doesn't Work

The plan suggests:
> "If systems need to react to removals, add DeathReactionSystem that runs NEXT tick"

**This is wrong for real-time feel:**
- Projectile hits goblin
- Player sees goblin die
- Lightning arcs to dead body (this tick)
- Goblin disappears (next tick)

**Players perceive this as a bug**, even if it's technically correct.

### Solution: Lifecycle Queries

Add **pending-aware query methods** to SpatialSystem:

```typescript
class SpatialSystem {
  private pendingRemovals: Set<number> = new Set();
  private pendingSpawns: Map<number, {x, y, layer}> = new Map();
  
  // Stage removal (same as before)
  remove(x: number, y: number, layer: Layer) {
    const entityId = this.grid.cell(x, y)?.getValue(layer);
    if (entityId === undefined) return;
    
    this.pendingRemovals.add(entityId);  // Track pending removal
    
    this.pendingOps.push({
      type: 'remove',
      entityId,
      x, y, layer
    });
  }
  
  // NEW: Check if entity is alive (not pending removal)
  isAlive(entityId: number): boolean {
    return !this.pendingRemovals.has(entityId);
  }
  
  // NEW: Check if entity is valid for targeting
  isValidTarget(entityId: number): boolean {
    // Entity must exist in store and not be pending removal
    return this.store.getData(entityId) !== undefined && 
           !this.pendingRemovals.has(entityId);
  }
  
  // MODIFIED: Existing query filters out pending removals
  getEntityIdsInRadius(x: number, y: number, radius: number, options?: {
    includePendingRemovals?: boolean;
  }): number[] {
    const cell = this.grid.cell(x, y);
    if (!cell) return [];
    
    const cells = cell.getCircle(radius);
    const ids: number[] = [];
    
    for (const c of cells) {
      for (const id of c.values) {
        if (id !== undefined) {
          // By default, exclude pending removals
          if (options?.includePendingRemovals || !this.pendingRemovals.has(id)) {
            ids.push(id);
          }
        }
      }
    }
    
    return ids;
  }
  
  // MODIFIED: Same for other queries
  getEntityIdsInCell(x: number, y: number, options?: {
    includePendingRemovals?: boolean;
  }): number[] {
    const cell = this.grid.cell(x, y);
    if (!cell) return [];
    
    const ids: number[] = [];
    for (const id of cell.values) {
      if (id !== undefined) {
        if (options?.includePendingRemovals || !this.pendingRemovals.has(id)) {
          ids.push(id);
        }
      }
    }
    return ids;
  }
  
  commit() {
    // Execute operations...
    
    // Clear pending tracking
    this.pendingRemovals.clear();
    this.pendingSpawns.clear();
    this.pendingOps = [];
  }
}
```

### System Usage

```typescript
class ChainLightningSystem {
  update({ overlaps, spatial }: GameContext) {
    const targets = spatial.getEntityIdsInRadius(x, y, 8);
    // By default, this excludes pending removals
    
    for (const id of targets) {
      // Additional safety check
      if (!spatial.isAlive(id)) continue;
      
      const data = spatial.getEntityData(id);
      if (data.type === 'enemy') {
        applyDamage(id, 30);
      }
    }
  }
}
```

### Edge Case: What if system WANTS to target corpses?

```typescript
class NecromancySystem {
  update({ spatial }: GameContext) {
    // Explicitly include pending removals
    const corpses = spatial.getEntityIdsInRadius(x, y, 5, {
      includePendingRemovals: true
    }).filter(id => {
      const data = spatial.getEntityData(id);
      return data.hp <= 0 && !spatial.isAlive(id);
    });
    
    // Resurrect corpses before they're removed
    for (const id of corpses) {
      const data = spatial.getEntityData(id);
      data.hp = data.maxHp;
      // Now it won't be removed at commit
      // BUT we need to cancel the pending removal!
    }
  }
}
```

**Problem**: How to cancel a pending removal?

**Solution**: Add cancellation

```typescript
class SpatialSystem {
  // Cancel a pending removal (for resurrection, etc.)
  cancelRemoval(entityId: number): boolean {
    if (!this.pendingRemovals.has(entityId)) return false;
    
    this.pendingRemovals.delete(entityId);
    
    // Remove from pendingOps
    this.pendingOps = this.pendingOps.filter(op => 
      !(op.type === 'remove' && op.entityId === entityId)
    );
    
    return true;
  }
}
```

### Testing Strategy

```typescript
describe('Zombie Entity Problem', () => {
  it('excludes pending removals from queries by default', () => {
    const spatial = setupSpatial();
    
    // Arrange
    const goblinId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, { hp: 10 });
    spatial.commit();
    
    // Act - kill goblin (stage removal)
    spatial.remove(5, 5, GameLayers.ACTORS);
    
    // Assert - goblin not in queries
    expect(spatial.isAlive(goblinId)).toBe(false);
    expect(spatial.getEntityIdsInCell(5, 5)).toEqual([]);
    expect(spatial.getEntityIdsInRadius(5, 5, 3)).toEqual([]);
    
    // But still in grid until commit
    const cell = spatial.getGrid().cell(5, 5);
    expect(cell.getValue(GameLayers.ACTORS)).toBe(goblinId);
    
    // Commit removes it
    spatial.commit();
    expect(cell.getValue(GameLayers.ACTORS)).toBeUndefined();
  });
  
  it('allows targeting corpses when explicitly requested', () => {
    const spatial = setupSpatial();
    
    const goblinId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, { hp: 0 });
    spatial.commit();
    spatial.remove(5, 5, GameLayers.ACTORS);
    
    // Can find corpse with explicit flag
    const corpses = spatial.getEntityIdsInCell(5, 5, { 
      includePendingRemovals: true 
    });
    expect(corpses).toContain(goblinId);
  });
});
```

---

## Dragon 2: The Refactor Cliff

### The Trap

```typescript
// Old test (breaks with new API)
it('removes entity', () => {
  const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
  spatial.remove(5, 5, GameLayers.ACTORS);
  
  // This fails now - removal is deferred!
  expect(spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)).toBeUndefined();
});
```

**Estimated breakage**: 50-100 tests in visual-tests, unit tests, integration tests

### Solution 1: Two-Phase Migration

**Phase 1: Add new API alongside old**

```typescript
class SpatialSystem {
  // NEW: Deferred removal
  remove(x: number, y: number, layer: Layer) {
    // Stage removal (new behavior)
  }
  
  // OLD: Immediate removal (deprecated)
  removeImmediate(x: number, y: number, layer: Layer): boolean {
    const cell = this.grid.cell(x, y);
    if (!cell) return false;
    
    const entityId = cell.getValue(layer);
    if (entityId === undefined) return false;
    
    cell.clearValue(layer);
    this.store.remove(entityId);
    this.positions.delete(entityId);
    
    return true;
  }
}
```

**Phase 2: Migrate tests incrementally**

```typescript
// Tests that need immediate removal (test setup)
it('sets up initial state', () => {
  const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
  spatial.commit();
  
  // Clear for clean slate
  spatial.removeImmediate(5, 5, GameLayers.ACTORS);
  
  // Now test something else
});

// Tests of the remove behavior itself
it('stages removal until commit', () => {
  const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
  spatial.commit();
  
  spatial.remove(5, 5, GameLayers.ACTORS);
  
  // Still present until commit
  expect(spatial.getEntityIdAt(5, 5, GameLayers.ACTORS, {
    includePendingRemovals: true
  })).toBe(id);
  
  // Not present in normal queries
  expect(spatial.isAlive(id)).toBe(false);
  
  spatial.commit();
  
  // Now actually removed
  expect(spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)).toBeUndefined();
});
```

**Phase 3: Deprecate and remove**

After all tests migrated:
1. Mark `removeImmediate()` as `@deprecated`
2. Add console warning when called
3. Remove in next major version

### Solution 2: Test Fixture Helpers

```typescript
// test-helpers.ts

export class TestSpatialFixture {
  constructor(public spatial: SpatialSystem) {}
  
  /**
   * Setup helper: spawn and commit in one call.
   * For test fixtures only - not for testing spawn behavior.
   */
  placeEntity(type: string, x: number, y: number, layer: Layer, props?: object): number {
    const id = this.spatial.spawn(type, x, y, layer, props);
    this.spatial.commit();
    return id;
  }
  
  /**
   * Setup helper: remove and commit in one call.
   * For test fixtures only - not for testing remove behavior.
   */
  clearEntity(x: number, y: number, layer: Layer): void {
    this.spatial.remove(x, y, layer);
    this.spatial.commit();
  }
  
  /**
   * Setup helper: move and commit in one call.
   */
  moveEntity(fromX: number, fromY: number, toX: number, toY: number, layer: Layer): void {
    this.spatial.move(fromX, fromY, toX, toY, layer);
    this.spatial.commit();
  }
}

// Usage in tests
describe('CombatSystem', () => {
  it('applies damage when overlapping', () => {
    const fixture = new TestSpatialFixture(spatial);
    
    // Setup (uses helpers that auto-commit)
    const playerId = fixture.placeEntity('player', 5, 5, GameLayers.ACTORS, { hp: 100 });
    const enemyId = fixture.placeEntity('enemy', 5, 5, GameLayers.ACTORS, { hp: 50 });
    
    // Act (test actual system)
    const combatSystem = new CombatSystem();
    const overlaps = spatial.detectOverlaps();
    combatSystem.update({ overlaps, spatial });
    spatial.commit();
    
    // Assert
    const playerData = spatial.getEntityData(playerId);
    expect(playerData.hp).toBeLessThan(100);
  });
});
```

### Migration Checklist

- [ ] Inventory all tests that call `spatial.remove()` (~100 tests)
- [ ] Categorize: setup code vs. behavior tests
- [ ] Create `TestSpatialFixture` helper class
- [ ] Migrate setup code to use fixture helpers
- [ ] Migrate behavior tests to use deferred API correctly
- [ ] Add `removeImmediate()` deprecation warnings
- [ ] Run full test suite
- [ ] Remove `removeImmediate()` after 1 release cycle

**Estimated effort**: 1-2 days (not 5 days if we use fixtures)

---

## Dragon 3: Debuggability of Staged State

### The Trap

```typescript
// Debugging session:
> spatial.spawn('enemy', 10, 10, GameLayers.ACTORS)
13  // Returns entity ID

> spatial.getEntityIdAt(10, 10, GameLayers.ACTORS)
undefined  // Wait, what? Did it fail?

> spatial.commit()

> spatial.getEntityIdAt(10, 10, GameLayers.ACTORS)
13  // Oh, it was just staged...
```

**Developer experience**: Frustrating and confusing

### Solution: Visualize Pending Operations

#### 1. Add Inspection API

```typescript
class SpatialSystem {
  /**
   * Get all pending operations (for debugging/visualization).
   * 
   * @returns Array of pending operations
   */
  getPendingOps(): ReadonlyArray<Operation> {
    return [...this.pendingOps];
  }
  
  /**
   * Get summary of pending changes.
   * 
   * @returns Human-readable summary
   */
  getPendingSummary(): {
    moves: number;
    removals: number;
    spawns: number;
    total: number;
  } {
    const moves = this.pendingOps.filter(op => op.type === 'move').length;
    const removals = this.pendingOps.filter(op => op.type === 'remove').length;
    const spawns = this.pendingOps.filter(op => op.type === 'spawn').length;
    
    return { moves, removals, spawns, total: this.pendingOps.length };
  }
  
  /**
   * Check what will happen at this position after commit.
   * 
   * @returns Predicted state after commit
   */
  predictCommittedState(x: number, y: number, layer: Layer): {
    current: number | undefined;
    afterCommit: number | undefined;
    pendingOp?: 'remove' | 'spawn' | 'move-in' | 'move-out';
  } {
    const current = this.grid.cell(x, y)?.getValue(layer);
    
    // Check for operations affecting this cell
    const removal = this.pendingOps.find(op => 
      op.type === 'remove' && op.x === x && op.y === y && op.layer === layer
    );
    
    const spawn = this.pendingOps.find(op => 
      op.type === 'spawn' && op.x === x && op.y === y && op.layer === layer
    );
    
    const moveOut = this.pendingOps.find(op => 
      op.type === 'move' && op.fromX === x && op.fromY === y && op.layer === layer
    );
    
    const moveIn = this.pendingOps.find(op => 
      op.type === 'move' && op.toX === x && op.toY === y && op.layer === layer
    );
    
    let afterCommit = current;
    let pendingOp: any = undefined;
    
    if (removal) {
      afterCommit = undefined;
      pendingOp = 'remove';
    } else if (moveOut) {
      afterCommit = undefined;
      pendingOp = 'move-out';
    }
    
    if (spawn) {
      afterCommit = spawn.entityId;
      pendingOp = 'spawn';
    } else if (moveIn) {
      afterCommit = moveIn.entityId;
      pendingOp = 'move-in';
    }
    
    return { current, afterCommit, pendingOp };
  }
}
```

#### 2. Update Visual Test Runner

Modify `GridRenderer.tsx` to show pending operations:

```typescript
export function GridRenderer({ snapshot, previousSnapshot }: Props) {
  const grid = snapshot?.grid || DEFAULT_GRID_SIZE;
  
  // NEW: Get pending operations if available
  const pendingOps = snapshot?.pendingOps || [];
  
  const lines: string[] = [];
  for (let y = 0; y < grid.h; y++) {
    let line = '';
    for (let x = 0; x < grid.w; x++) {
      const entitiesHere = snapshot?.entities.filter(e => e.x === x && e.y === y) || [];
      
      // NEW: Check for pending ops at this cell
      const hasPendingOp = pendingOps.some(op => 
        (op.type === 'spawn' || op.type === 'remove') && op.x === x && op.y === y ||
        (op.type === 'move' && (op.fromX === x && op.fromY === y || op.toX === x && op.toY === y))
      );
      
      if (entitiesHere.length > 0) {
        const topEntity = entitiesHere.reduce((highest, current) => 
          current.layer > highest.layer ? current : highest
        );
        
        const char = topEntity.type[0].toUpperCase();
        const colorFn = ENTITY_COLORS[topEntity.type] || chalk.white;
        
        // NEW: Add visual indicator for pending ops
        if (hasPendingOp) {
          line += chalk.bgYellow(colorFn(char)) + ' ';  // Yellow background = pending
        } else {
          line += colorFn(char) + ' ';
        }
      } else {
        // NEW: Show ghost entities for pending spawns
        const pendingSpawn = pendingOps.find(op => 
          op.type === 'spawn' && op.x === x && op.y === y
        );
        
        if (pendingSpawn) {
          const ghostChar = pendingSpawn.entityType[0].toUpperCase();
          line += chalk.dim.cyan(ghostChar) + ' ';  // Dim cyan = ghost spawn
        } else {
          line += chalk.dim('·') + ' ';
        }
      }
    }
    lines.push(line);
  }
  
  return (
    <Box flexDirection="column">
      {/* Existing scene header */}
      
      {/* NEW: Pending operations summary */}
      {pendingOps.length > 0 && (
        <Box marginBottom={1} borderStyle="single" borderColor="yellow" paddingX={1}>
          <Text color="yellow">⏳ Pending: </Text>
          <Text>{pendingOps.filter(op => op.type === 'move').length} moves, </Text>
          <Text>{pendingOps.filter(op => op.type === 'remove').length} removals, </Text>
          <Text>{pendingOps.filter(op => op.type === 'spawn').length} spawns</Text>
        </Box>
      )}
      
      {/* Grid display */}
      <Box flexDirection="column" borderStyle="single" paddingX={2} paddingY={1}>
        {lines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
      
      {/* NEW: Legend */}
      <Box marginTop={1}>
        <Text dimColor>Legend: </Text>
        <Text color="yellow">█ </Text>
        <Text dimColor>= has pending op | </Text>
        <Text color="cyan" dimColor>G </Text>
        <Text dimColor>= ghost (will spawn)</Text>
      </Box>
    </Box>
  );
}
```

#### 3. Update Snapshot Interface

```typescript
interface SceneSnapshot {
  sceneId: string;
  sceneName?: string;
  grid: { w: number; h: number };
  entities: EntitySnapshot[];
  
  // NEW: Include pending operations
  pendingOps?: Array<{
    type: 'move' | 'remove' | 'spawn';
    entityId?: number;
    entityType?: string;
    x?: number;
    y?: number;
    layer?: number;
    fromX?: number;
    fromY?: number;
    toX?: number;
    toY?: number;
  }>;
}
```

#### 4. Update Scene.toSnapshot()

```typescript
class Scene {
  toSnapshot(): SceneSnapshot {
    const entities: EntitySnapshot[] = [];
    
    for (const [id, pos] of this.spatial.getAllPositions()) {
      const data = this.store.getData(id);
      if (data) {
        entities.push({
          id,
          type: data.type,
          x: pos.x,
          y: pos.y,
          layer: pos.layer,
          data
        });
      }
    }
    
    // NEW: Include pending operations
    const pendingOps = this.spatial.getPendingOps().map(op => ({
      type: op.type,
      entityId: op.entityId,
      entityType: op.type === 'spawn' ? this.store.getData(op.entityId)?.type : undefined,
      x: op.x,
      y: op.y,
      layer: op.layer,
      fromX: op.type === 'move' ? op.fromX : undefined,
      fromY: op.type === 'move' ? op.fromY : undefined,
      toX: op.type === 'move' ? op.toX : undefined,
      toY: op.type === 'move' ? op.toY : undefined,
    }));
    
    return {
      sceneId: this.id,
      sceneName: this.metadata.name as string,
      grid: { w: this.grid.width, h: this.grid.height },
      entities,
      pendingOps
    };
  }
}
```

#### 5. REPL/Debug Helpers

```typescript
// Add to SpatialSystem for manual debugging
class SpatialSystem {
  /**
   * Debug helper: print current state.
   */
  debug(): void {
    const summary = this.getPendingSummary();
    console.log('\n=== SpatialSystem Debug ===');
    console.log(`Entities: ${this.positions.size}`);
    console.log(`Pending ops: ${summary.total}`);
    console.log(`  - Moves: ${summary.moves}`);
    console.log(`  - Removals: ${summary.removals}`);
    console.log(`  - Spawns: ${summary.spawns}`);
    
    if (summary.total > 0) {
      console.log('\nPending operations:');
      for (const op of this.pendingOps) {
        if (op.type === 'move') {
          console.log(`  MOVE: entity ${op.entityId} from (${op.fromX},${op.fromY}) to (${op.toX},${op.toY}) layer ${op.layer}`);
        } else if (op.type === 'remove') {
          console.log(`  REMOVE: entity ${op.entityId} at (${op.x},${op.y}) layer ${op.layer}`);
        } else if (op.type === 'spawn') {
          const type = this.store.getData(op.entityId)?.type || 'unknown';
          console.log(`  SPAWN: entity ${op.entityId} (${type}) at (${op.x},${op.y}) layer ${op.layer}`);
        }
      }
    }
    console.log('========================\n');
  }
}

// Usage in REPL:
> spatial.spawn('enemy', 10, 10, GameLayers.ACTORS)
13

> spatial.debug()
=== SpatialSystem Debug ===
Entities: 1
Pending ops: 1
  - Moves: 0
  - Removals: 0
  - Spawns: 1

Pending operations:
  SPAWN: entity 13 (enemy) at (10,10) layer 5
========================
```

---

## Modified Implementation Plan

### Phase 0: Safety Infrastructure (2 days) ⚠️ MANDATORY

**Before changing ANY transaction logic:**

1. **Add lifecycle queries** (4 hours)
   - `isAlive(id)` - checks pending removals
   - `isValidTarget(id)` - checks store + pending
   - Modify all query methods with `includePendingRemovals` option
   - Default: exclude pending removals from queries

2. **Add inspection API** (2 hours)
   - `getPendingOps()` - expose pending operations
   - `getPendingSummary()` - counts by type
   - `predictCommittedState(x, y, layer)` - predict after commit
   - `debug()` - REPL helper

3. **Update Visual Test Runner** (4 hours)
   - Render pending ops with visual indicators
   - Yellow background = has pending op
   - Dim cyan ghost = will spawn
   - Add pending ops legend

4. **Create test fixtures** (2 hours)
   - `TestSpatialFixture` class
   - `placeEntity()` - spawn + commit
   - `clearEntity()` - remove + commit
   - `moveEntity()` - move + commit

**Deliverable**: Can visualize and query pending state before changing transaction model

### Phase 1: Transaction Unification (2 days)

**Now safe to proceed:**

1. **Implement deferred operations** (4 hours)
   - Add `pendingRemovals: Set<number>`
   - Add `pendingSpawns: Map<number, Position>`
   - Update `remove()` to stage
   - Update `spawn()` to stage
   - Update `commit()` to execute in order (remove → move → spawn)

2. **Add cancellation** (2 hours)
   - `cancelRemoval(id)` - for resurrection
   - `cancelSpawn(id)` - for conditional spawns

3. **Migrate core tests** (4 hours)
   - Inventory tests calling remove/spawn
   - Migrate setup code to use `TestSpatialFixture`
   - Update behavior tests to test deferred semantics

4. **Run test suite** (2 hours)
   - Fix remaining breaks
   - Verify visual runner shows pending ops
   - Manual smoke testing

**Deliverable**: All operations deferred, tests passing, debuggable

### Phase 2: System Updates (1 day)

**Update systems to use lifecycle queries:**

1. **Update example systems** (2 hours)
   - ChainLightningSystem: use `isAlive()`
   - EnemyAISystem: use `isValidTarget()`
   - NecromancySystem: use `includePendingRemovals: true`

2. **Document patterns** (2 hours)
   - When to use `isAlive()`
   - When to use `isValidTarget()`
   - When to explicitly include pending removals
   - Add to system contract docs

3. **Integration tests** (2 hours)
   - Test zombie entity scenarios
   - Test resurrection mechanics
   - Test multi-system interactions

**Deliverable**: Systems correctly handle staged state

### Phase 3-6: Continue as planned

Scene transition queuing, cross-scene operations, interfaces, documentation.

---

## Success Criteria (Updated)

### Phase 0 Must Pass

- [ ] Visual test runner shows pending ops with visual indicators
- [ ] `spatial.debug()` prints readable pending operation summary
- [ ] Query methods have `includePendingRemovals` option
- [ ] `isAlive()` correctly excludes pending removals
- [ ] `TestSpatialFixture` helpers work in tests

### Phase 1 Must Pass

- [ ] All operations are deferred (remove, spawn, move)
- [ ] Commit executes in order: remove → move → spawn
- [ ] No ghost entities (staged move after remove = invalid)
- [ ] No zombie targeting (queries exclude pending removals by default)
- [ ] All tests pass
- [ ] Visual runner shows ghosts correctly

### Phase 2 Must Pass

- [ ] Systems use lifecycle queries consistently
- [ ] Chain lightning doesn't target corpses
- [ ] Resurrection can cancel pending removals
- [ ] Integration tests cover edge cases

---

## Risk Assessment

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Zombie entities targeted by AI | HIGH | Lifecycle queries (Phase 0) | MITIGATED |
| 100+ broken tests | HIGH | TestSpatialFixture (Phase 0) | MITIGATED |
| Can't debug staged state | MEDIUM | Inspection API + Visual updates (Phase 0) | MITIGATED |
| Performance regression | MEDIUM | Profile before/after | NOT ADDRESSED |
| Resurrection edge cases | LOW | Cancellation API | MITIGATED |

**Unmitigated risk**: Performance regression from query filtering

**Mitigation needed**: Benchmark `getEntityIdsInRadius()` before/after. If >10% slower, optimize Set lookups.

---

## Conclusion

The original plan is **sound but incomplete**. Phase 0 is **mandatory** before touching transaction logic.

**Effort estimate updated**:
- Phase 0: 2 days (new)
- Phase 1: 2 days (same)
- Phase 2: 1 day (same)
- **Total: 5 days** (was 2 days)

**This is acceptable**. The infrastructure built in Phase 0 will pay dividends in debuggability and system reliability.

**Do not skip Phase 0.** The dragons are real.