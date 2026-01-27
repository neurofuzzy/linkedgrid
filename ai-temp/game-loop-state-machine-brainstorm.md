# Game Loop State Machine Brainstorm

## Core Insight

By detecting overlaps **before** processing game logic, we get the 1-tick delay naturally without needing a dedicated timed-action system!

## Proposed Game Loop

Each tick follows this sequence:

```
Tick N:
  1. Detect Overlaps (read current state)
  2. Collect User Input (future)
  3. Process Game Logic (responds to overlaps from step 1)
  4. Gather Intents (change-set)
  5. Validate Intents
  6. Apply Changes (commit)
  
Tick N+1:
  (overlap detection now sees results of previous commit)
```

## How This Integrates with Two-Phase Movement

### Current System
- `move()` - records intent in `pendingMoves` array
- `commit()` - validates and executes all intents atomically

### Enhanced System
- **Step 4** (Gather Intents) - game logic calls `move()` to stage intents
- **Step 5** (Validate) - happens inside `commit()`
- **Step 6** (Apply) - happens inside `commit()`

The two-phase commit **already handles steps 5-6**, we just need to add steps 1-3!

## Teleporter Problem Solved

### 1-Tick Delay

**Tick N** (Player moves onto pad):
```
1. Detect Overlaps: none yet (player hasn't committed move)
2. Input: player presses right
3. Logic: normal movement
4. Intents: spatial.move(5,5 → 6,5)  // onto teleporter pad
5-6. Commit: player moves onto pad at (6,5)
```

**Tick N+1** (Overlap detected, teleport scheduled):
```
1. Detect Overlaps: player at (6,5), teleporter at (6,5) → OVERLAP!
2. Input: none
3. Logic: teleporterSystem.onOverlap() → schedules teleport intent
4. Intents: gameManager.movePlayerToScene('room2', 3, 3)
5-6. Commit: player teleports to room2
```

The overlap from Tick N is **detected at the start of Tick N+1**, giving us the natural 1-tick delay!

### Two-Way with Reset

**State tracking per teleporter pad**:
```typescript
type TeleporterState = 'ready' | 'inactive';
```

**Scenario: Player teleports from room1 to room2**

**Tick N** (Arrival in room2):
```
1. Detect Overlaps: player just arrived, overlaps destination pad
2. Logic: pad is marked 'inactive' (by the teleport logic)
3. Result: no teleport triggered (pad inactive)
```

**Tick N+1** (Player still on pad):
```
1. Detect Overlaps: player still at (3,3), pad at (3,3)
2. Logic: pad still 'inactive', no action
3. Result: no teleport
```

**Tick N+2** (Player moves off pad):
```
1. Detect Overlaps: player no longer overlaps pad
2. Logic: teleporterSystem.onLeave() → pad state: 'inactive' → 'ready'
3. Result: pad re-enabled
```

**Tick N+3** (Player moves back onto pad):
```
1. Detect Overlaps: player overlaps pad again
2. Logic: pad is 'ready' → trigger teleport intent
3. Result: player teleports back to room1
```

## Implementation Structure

### 1. Overlap Detection System

```typescript
class OverlapDetector {
  detectOverlaps(spatial: SpatialSystem): Overlap[] {
    const overlaps: Overlap[] = [];
    
    // For each entity, check what else occupies its cell
    for (const [entityId, pos] of spatial.getAllPositions()) {
      const cell = spatial.grid.cell(pos.x, pos.y);
      const entities = spatial.getEntityIdsAtPosition(pos.x, pos.y);
      
      // If multiple entities at this position, record overlaps
      if (entities.length > 1) {
        overlaps.push({
          position: { x: pos.x, y: pos.y },
          entities: entities
        });
      }
    }
    
    return overlaps;
  }
}
```

### 2. Game Loop Orchestrator

```typescript
class GameLoop {
  constructor(
    private overlapDetector: OverlapDetector,
    private systems: GameSystem[],
    private spatial: SpatialSystem
  ) {}
  
  tick(): void {
    // 1. Detect overlaps from previous tick's committed state
    const overlaps = this.overlapDetector.detectOverlaps(this.spatial);
    
    // 2. Collect user input (future)
    const input = this.collectInput();
    
    // 3. Process game logic (systems respond to overlaps & input)
    const context = { overlaps, input, spatial: this.spatial };
    for (const system of this.systems) {
      system.update(context);
    }
    
    // 4-6. Commit all intents gathered during system updates
    this.spatial.commit();
  }
}
```

### 3. Teleporter System

```typescript
class TeleporterSystem implements GameSystem {
  private states = new Map<number, TeleporterState>();
  
  update(context: GameContext): void {
    const { overlaps, spatial } = context;
    const playerId = this.getPlayerId();
    
    for (const overlap of overlaps) {
      const entities = overlap.entities;
      const hasPlayer = entities.includes(playerId);
      const teleporter = entities.find(id => 
        spatial.store.get(id)?.type === 'teleporter'
      );
      
      if (hasPlayer && teleporter) {
        this.handlePlayerTeleporterOverlap(playerId, teleporter, spatial);
      }
    }
    
    // Check for leaving teleporter pads
    this.checkForLeavingPads(playerId, overlaps, spatial);
  }
  
  private handlePlayerTeleporterOverlap(
    playerId: number, 
    teleporterId: number,
    spatial: SpatialSystem
  ): void {
    const state = this.states.get(teleporterId) || 'ready';
    
    if (state === 'ready') {
      // Trigger teleport!
      const teleporter = spatial.store.get(teleporterId);
      const dest = teleporter.destination;
      
      // This calls movePlayerToScene which will:
      // 1. Remove player from current scene
      // 2. Add player to destination scene at dest position
      this.gameManager.movePlayerToScene(
        dest.sceneId,
        dest.x,
        dest.y,
        dest.layer
      );
      
      // Mark destination pad as inactive
      this.states.set(dest.teleporterId, 'inactive');
    }
  }
  
  private checkForLeavingPads(
    playerId: number,
    currentOverlaps: Overlap[],
    spatial: SpatialSystem
  ): void {
    // Find all inactive teleporters
    for (const [teleporterId, state] of this.states) {
      if (state === 'inactive') {
        // Check if player is still on this pad
        const pos = spatial.getEntityPosition(teleporterId);
        const playerPos = spatial.getEntityPosition(playerId);
        
        if (!pos || !playerPos || 
            pos.x !== playerPos.x || 
            pos.y !== playerPos.y) {
          // Player left the pad, re-enable it
          this.states.set(teleporterId, 'ready');
        }
      }
    }
  }
}
```

## Benefits of This Approach

1. **No timed-action system needed** - the tick-based loop naturally creates delays
2. **Clean separation** - overlap detection is separate from logic processing
3. **Deterministic** - same inputs = same outputs, easier to test and debug
4. **Extensible** - easy to add more systems (collision, puzzles, AI)
5. **Fits existing architecture** - builds on top of two-phase commit

## Integration with Visual Tests

Visual tests would call `gameLoop.tick()` instead of manually calling `spatial.move()` and `spatial.commit()`:

```typescript
visual('player teleports between rooms', {
  arrange: (ctx) => {
    const game = new GameManager();
    const gameLoop = new GameLoop(game);
    
    // Setup scenes and teleporters
    const room1 = game.sceneManager.createScene('room1', 10, 10);
    const room2 = game.sceneManager.createScene('room2', 8, 8);
    
    // Spawn player
    const playerId = room1.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    
    // Spawn teleporters
    room1.spatial.spawn('teleporter', 6, 5, GameLayers.FLOOR, {
      destination: { sceneId: 'room2', x: 3, y: 3 }
    });
    
    ctx.game = game;
    ctx.gameLoop = gameLoop;
  },
  act: (ctx) => {
    // Tick 1: Move player onto teleporter pad
    ctx.spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
    ctx.gameLoop.tick(); // Commit + advance
    
    // Tick 2: Overlap detected, teleport happens
    ctx.gameLoop.tick();
  },
  assert: (ctx) => {
    const pos = ctx.game.getPlayerPosition();
    expect('player in room2', () => {
      assert(pos?.sceneId === 'room2');
      assert(pos?.x === 3 && pos?.y === 3);
    });
  }
});
```

## Open Questions

1. **Who drives the loop?**
   - In a real game: input handler calls `gameLoop.tick()` on each action
   - In visual tests: explicit `tick()` calls
   - In turn-based game: one tick per player action
   - In real-time game: one tick per frame

2. **How do systems gather intents?**
   - Direct calls to `spatial.move()`?
   - Return intent objects that loop collects?
   - Hybrid approach?

3. **Do we need an event bus?**
   - Overlap detection might be enough for many cases
   - Could add events later if needed
   - Keep it simple initially

4. **Input handling timing?**
   - Step 2 happens before logic
   - Input could influence teleporter behavior (hold button to teleport?)
   - Or input is consumed by movement system only

## Next Steps

1. Create `GameLoop` class with basic tick() structure
2. Create `OverlapDetector` for step 1
3. Create `GameSystem` interface for extensible systems
4. Implement `TeleporterSystem` as first concrete system
5. Update visual tests to use `gameLoop.tick()`
6. Test with existing scene transition tests

## Notes

- This design naturally supports turn-based games (one tick per action)
- Could adapt for real-time by calling tick() on a timer
- Overlap detection is essentially collision detection without the physics
- Systems can maintain their own state between ticks (like teleporter states)
- No breaking changes - existing spatial operations still work
