# GameRuntime Specification (Real-Time)

## Overview

`GameRuntime` is a high-level orchestrator that manages the real-time execution of a game using the GameLoop + Scene architecture. It handles initialization, frame timing, scene transitions, and provides a clean interface for game execution.

## Design Principles

1. **Real-time only** - Fixed timestep with variable rendering
2. **Encapsulates complexity** - Hides GameLoop management from game code
3. **Automatic scene transitions** - Detects and handles scene changes
4. **Frame-independent logic** - Game ticks run at fixed rate regardless of FPS
5. **Spartan** - Minimal API, maximum clarity

---

## Responsibilities

**GameRuntime does:**
- Initialize GameManager with scenes
- Create and manage GameLoop for active scene
- Run fixed-timestep game ticks
- Handle scene transitions automatically
- Provide lifecycle hooks (start, stop, pause)
- Manage systems registration

**GameRuntime does NOT:**
- Render graphics (that's external)
- Handle input directly (that's external, passed via methods)
- Know about specific game rules
- Manage assets or resources

---

## Architecture

```
GameRuntime
├── GameManager (owns game state + scenes)
├── GameLoop (for active scene)
├── Systems[] (registered once, applied to each scene)
└── FrameTimer (fixed timestep logic)
```

---

## API Design

### Constructor

```typescript
interface GameRuntimeConfig {
  /** Initial scene configuration */
  initialScene: {
    id: string;
    width: number;
    height: number;
    metadata?: Record<string, unknown>;
  };
  
  /** Game systems to run each tick */
  systems: GameSystem[];
  
  /** Ticks per second (default: 10) */
  tickRate?: number;
}

class GameRuntime {
  constructor(config: GameRuntimeConfig);
  
  /** Load from saved game data */
  static load(
    saveData: SaveData, 
    systems: GameSystem[], 
    tickRate?: number
  ): GameRuntime;
}
```

**Example (New Game):**
```typescript
const runtime = new GameRuntime({
  initialScene: {
    id: 'level-1',
    width: 50,
    height: 50,
    metadata: { name: 'Starting Area' }
  },
  systems: [
    new TeleporterSystem(),
    new EnemyAISystem(),
    new ProjectileSystem()
  ],
  tickRate: 10 // 10 ticks per second = 100ms per tick
});
```

**Example (Load Game):**
```typescript
const saveData = JSON.parse(localStorage.getItem('save'));
const runtime = GameRuntime.load(saveData, [
  new TeleporterSystem(),
  new EnemyAISystem(),
  new ProjectileSystem()
], 10);
```

---

### Core Methods

#### start()
Begin the game loop.

```typescript
start(): void
```

**Behavior:**
- Initializes timer
- Begins requestAnimationFrame loop
- Emits 'start' event (if we add events)

**Example:**
```typescript
runtime.start();
// Game is now running
```

---

#### stop()
Stop the game loop.

```typescript
stop(): void
```

**Behavior:**
- Cancels requestAnimationFrame
- Stops all ticking
- Does NOT destroy game state (can be resumed)

**Example:**
```typescript
runtime.stop();
// Game paused, state preserved
runtime.start(); // Resume
```

---

#### tick()
Manually execute one game tick. Useful for testing.

```typescript
tick(): void
```

**Behavior:**
- Runs detectOverlaps → systems → commit
- Checks for scene transitions
- Reinitializes loop if scene changed

**Example:**
```typescript
// In tests or step-through debugging
runtime.tick(); // Execute one frame
```

---

#### save()
Save the current game state to a plain object.

```typescript
save(): SaveData
```

**Returns:** SaveData object that can be serialized to JSON

**Behavior:**
- Stops the game loop (if running)
- Calls `game.save()` to serialize all state
- Returns SaveData with version, timestamp, scenes, etc.

**Example:**
```typescript
const saveData = runtime.save();
localStorage.setItem('save-slot-1', JSON.stringify(saveData));
console.log('Game saved!');
```

---

#### load()
Load game state and reinitialize.

```typescript
static load(saveData: SaveData, systems: GameSystem[], tickRate?: number): GameRuntime
```

**Returns:** New GameRuntime instance with loaded state

**Behavior:**
- Creates new GameRuntime instance
- Loads GameManager state from saveData
- Initializes loop for active scene
- Re-registers provided systems
- Does NOT start the loop (call `start()` when ready)

**Example:**
```typescript
const savedJson = localStorage.getItem('save-slot-1');
if (savedJson) {
  const saveData = JSON.parse(savedJson);
  const runtime = GameRuntime.load(saveData, [
    new TeleporterSystem(),
    new EnemyAISystem()
  ]);
  runtime.start();
  console.log('Game loaded!');
}
```

---

#### restart()
Reset game to initial state and optionally start.

```typescript
restart(autoStart = false): void
```

**Behavior:**
- Stops current loop
- Resets GameManager to initial configuration
- Recreates initial scene
- Reinitializes loop for initial scene
- Resets tick count
- Optionally starts the loop

**Example:**
```typescript
// Player died, restart from beginning
runtime.restart(true); // Auto-start

// Or for manual control
runtime.restart(); // Set up new game
// ... configure initial state ...
runtime.start(); // Begin when ready
```

---

### Access Properties

```typescript
class GameRuntime {
  /** Access to full game state */
  readonly game: GameManager;
  
  /** Convenience: active scene's spatial system */
  get spatial(): SpatialSystem;
  
  /** Convenience: active scene */
  get activeScene(): Scene;
  
  /** Is the runtime currently running? */
  get isRunning(): boolean;
  
  /** Current tick count since start */
  get tickCount(): number;
}
```

**Examples:**
```typescript
// Spawn player in active scene
const playerId = runtime.spatial.spawn('player', 25, 25, GameLayers.ACTORS);

// Access global state
runtime.game.gameState.playerEntityId = playerId;
runtime.game.gameState.lives = 3;

// Create additional scenes
runtime.game.sceneManager.createScene('level-2', 60, 60);

// Check status
if (runtime.isRunning) {
  console.log(`Game running, tick ${runtime.tickCount}`);
}
```

---

## Save/Load Implementation

### Save Data Structure

```typescript
interface SaveData {
  version: number;
  timestamp: number;
  gameState: {
    playerEntityId: number;
    lives: number;
    score: number;
    inventory: [string, number][];
    buffs: [string, number][];
    upgrades: string[];
    flags: [string, boolean][];
    data: [string, unknown][];
    connections: [string, unknown[]][];
    nextEntityId: number;
  };
  scenes: Array<{
    id: string;
    width: number;
    height: number;
    metadata: Record<string, unknown>;
    cells: Array<{x: number, y: number, values: (number | undefined)[], masks: number[], distances: number[]}>;
    entities: EntityData[];
  }>;
  activeSceneId: string | null;
  
  // Runtime-specific (optional)
  tickCount?: number;
  tickRate?: number;
}
```

**Note:** GameManager already handles the core serialization. GameRuntime just needs to wrap it and add runtime-specific data.

### Save Implementation

```typescript
save(): SaveData {
  // Stop loop if running
  const wasRunning = this._isRunning;
  if (wasRunning) {
    this.stop();
  }
  
  // Get core save data from GameManager
  const coreData = this.game.save();
  
  // Add runtime-specific data
  const saveData: SaveData = {
    ...coreData,
    tickCount: this._tickCount,
    tickRate: 1000 / this.tickInterval // Convert ms back to TPS
  };
  
  // Optionally resume
  if (wasRunning) {
    this.start();
  }
  
  return saveData;
}
```

### Load Implementation

```typescript
static load(saveData: SaveData, systems: GameSystem[], tickRate = 10): GameRuntime {
  // Create minimal config for construction
  const config: GameRuntimeConfig = {
    initialScene: {
      id: 'temp', // Will be replaced
      width: 10,
      height: 10
    },
    systems,
    tickRate
  };
  
  // Create instance
  const runtime = new GameRuntime(config);
  
  // Replace game with loaded state
  runtime.game = GameManager.load(saveData);
  
  // Restore tick count if present
  if (saveData.tickCount !== undefined) {
    runtime._tickCount = saveData.tickCount;
  }
  
  // Initialize loop for loaded active scene
  runtime.initializeLoop();
  
  return runtime;
}
```

**Alternative: Private constructor pattern**

```typescript
class GameRuntime {
  private constructor(
    game: GameManager,
    systems: GameSystem[],
    tickRate: number,
    initialTickCount = 0
  ) {
    // Internal constructor used by both new() and load()
  }
  
  static new(config: GameRuntimeConfig): GameRuntime {
    const game = new GameManager();
    game.sceneManager.createScene(/* ... */);
    return new GameRuntime(game, config.systems, config.tickRate || 10);
  }
  
  static load(saveData: SaveData, systems: GameSystem[], tickRate = 10): GameRuntime {
    const game = GameManager.load(saveData);
    return new GameRuntime(game, systems, tickRate, saveData.tickCount || 0);
  }
}
```

This is cleaner - keeps construction logic unified.

### Restart Implementation

```typescript
restart(autoStart = false): void {
  // Stop if running
  this.stop();
  
  // Save initial config
  const config = this.initialConfig;
  
  // Create new GameManager
  this.game = new GameManager();
  
  // Recreate initial scene
  this.game.sceneManager.createScene(
    config.initialScene.id,
    config.initialScene.width,
    config.initialScene.height,
    config.initialScene.metadata
  );
  
  // Reset tick count
  this._tickCount = 0;
  this.accumulator = 0;
  
  // Reinitialize loop
  this.initializeLoop();
  
  // Optionally start
  if (autoStart) {
    this.start();
  }
}
```

**Note:** Need to store `initialConfig` in constructor for restart to work.

---

## Internal Architecture

### Frame Loop Structure

```typescript
class GameRuntime {
  private animationFrameId?: number;
  private lastTickTime = 0;
  private tickInterval: number; // ms per tick (e.g., 100ms for 10 TPS)
  private accumulator = 0;
  private _tickCount = 0;
  private _isRunning = false;
  
  start(): void {
    if (this._isRunning) return;
    
    this._isRunning = true;
    this.lastTickTime = performance.now();
    this.loop();
  }
  
  private loop = (): void => {
    if (!this._isRunning) return;
    
    const now = performance.now();
    const deltaTime = now - this.lastTickTime;
    this.lastTickTime = now;
    
    // Accumulate time
    this.accumulator += deltaTime;
    
    // Fixed timestep: run ticks for accumulated time
    while (this.accumulator >= this.tickInterval) {
      this.tick();
      this.accumulator -= this.tickInterval;
      this._tickCount++;
    }
    
    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.loop);
  }
  
  stop(): void {
    this._isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }
}
```

**Why fixed timestep with accumulator?**
- Game logic runs at consistent rate (e.g., 10 TPS)
- Works correctly even if frame rate drops
- Catches up if a frame takes too long
- Decouples game logic from rendering

---

### Scene Transition Handling

```typescript
tick(): void {
  const sceneBefore = this.game.sceneManager.getActiveScene();
  
  // Run game tick
  this.gameLoop.tick();
  
  // Check if scene changed (e.g., via teleporter)
  const sceneAfter = this.game.sceneManager.getActiveScene();
  
  if (sceneAfter && sceneAfter !== sceneBefore) {
    this.onSceneTransition(sceneBefore, sceneAfter);
  }
}

private onSceneTransition(from: Scene | null, to: Scene): void {
  // Recreate game loop for new scene
  this.gameLoop = new GameLoop(to.spatial);
  
  // Re-register all systems
  for (const system of this.systems) {
    this.gameLoop.addSystem(system);
  }
}
```

**Key insight:** Systems are stateless with respect to scenes. Same TeleporterSystem instance works across all scenes.

---

## Input Handling Pattern

GameRuntime doesn't handle input directly. Instead, game code stages intents before ticks.

```typescript
// External input handler
document.addEventListener('keydown', (e) => {
  const playerPos = runtime.game.getPlayerPosition();
  if (!playerPos) return;
  
  const scene = runtime.activeScene;
  
  let dx = 0, dy = 0;
  if (e.key === 'ArrowUp') dy = -1;
  if (e.key === 'ArrowDown') dy = 1;
  if (e.key === 'ArrowLeft') dx = -1;
  if (e.key === 'ArrowRight') dx = 1;
  
  if (dx || dy) {
    // Stage player movement intent
    scene.spatial.move(
      playerPos.x, playerPos.y,
      playerPos.x + dx, playerPos.y + dy,
      playerPos.layer
    );
    // Intent will be committed on next tick
  }
});

runtime.start();
```

**Alternative: Input Queue Pattern**

```typescript
class GameRuntime {
  private inputQueue: Action[] = [];
  
  queueAction(action: Action): void {
    this.inputQueue.push(action);
  }
  
  tick(): void {
    // Process queued inputs before systems run
    while (this.inputQueue.length > 0) {
      const action = this.inputQueue.shift()!;
      this.processAction(action);
    }
    
    // Then run normal tick
    this.gameLoop.tick();
    
    // Handle scene transitions
    // ...
  }
  
  private processAction(action: Action): void {
    // Convert action to spatial.move() calls
  }
}
```

---

## Rendering Integration

GameRuntime doesn't render. Rendering happens externally, reading from runtime state.

```typescript
// Rendering loop (separate from game logic)
function render() {
  const scene = runtime.activeScene;
  const entities = scene.spatial.getAllPositions();
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid
  drawGrid(scene.grid);
  
  // Draw entities
  for (const [entityId, pos] of entities) {
    const data = scene.store.getData(entityId);
    drawEntity(data.type, pos.x, pos.y);
  }
  
  requestAnimationFrame(render);
}

// Start both loops
runtime.start();  // Game logic (10 TPS)
render();         // Rendering (60 FPS)
```

**Key insight:** Game ticks and render frames are decoupled. Render can interpolate between ticks for smooth animation if desired.

---

## Complete Example with Save/Load

```typescript
// 1. Define systems
class EnemyAISystem implements GameSystem {
  update(context: GameContext): void {
    const entities = Array.from(context.spatial.getAllPositions());
    
    for (const [entityId, pos] of entities) {
      const data = context.spatial.getEntityData(entityId);
      if (data?.type === 'enemy') {
        // Simple AI: move toward player
        const playerPos = /* get player position */;
        const [dx, dy] = this.calculateMove(pos, playerPos);
        
        context.spatial.move(
          pos.x, pos.y,
          pos.x + dx, pos.y + dy,
          pos.layer
        );
      }
    }
  }
}

// 2. Initialize runtime
const runtime = new GameRuntime({
  initialScene: {
    id: 'dungeon',
    width: 40,
    height: 30
  },
  systems: [
    new TeleporterSystem(),
    new EnemyAISystem(),
    new ProjectileSystem()
  ],
  tickRate: 10 // 10 TPS
});

// 3. Setup initial state
const playerId = runtime.spatial.spawn('player', 20, 15, GameLayers.ACTORS);
runtime.game.gameState.playerEntityId = playerId;

// Spawn some enemies
runtime.spatial.spawn('enemy', 10, 10, GameLayers.ACTORS);
runtime.spatial.spawn('enemy', 30, 20, GameLayers.ACTORS);

// Create additional scenes
runtime.game.sceneManager.createScene('boss-room', 20, 20);

// 4. Setup input
document.addEventListener('keydown', (e) => {
  const pos = runtime.game.getPlayerPosition();
  if (!pos) return;
  
  const scene = runtime.game.sceneManager.getScene(pos.sceneId);
  if (!scene) return;
  
  const [dx, dy] = keyToDirection(e.key);
  if (dx || dy) {
    scene.spatial.move(
      pos.x, pos.y,
      pos.x + dx, pos.y + dy,
      pos.layer
    );
  }
});

// 5. Setup rendering
function renderLoop() {
  const scene = runtime.activeScene;
  renderScene(scene);
  requestAnimationFrame(renderLoop);
}

// 6. Start!
runtime.start();
renderLoop();

// 7. Save game (e.g., on command or interval)
document.addEventListener('keydown', (e) => {
  if (e.key === 's' && e.ctrlKey) {
    const saveData = runtime.save();
    localStorage.setItem('autosave', JSON.stringify(saveData));
    console.log('Game saved!');
  }
});

// 8. Load game (e.g., on startup)
function loadOrCreateGame() {
  const savedJson = localStorage.getItem('autosave');
  
  if (savedJson) {
    try {
      const saveData = JSON.parse(savedJson);
      const runtime = GameRuntime.load(saveData, [
        new TeleporterSystem(),
        new EnemyAISystem(),
        new ProjectileSystem()
      ], 10);
      return runtime;
    } catch (e) {
      console.error('Failed to load save', e);
      // Fall through to create new game
    }
  }
  
  // Create new game if no save or load failed
  return new GameRuntime({
    initialScene: { id: 'dungeon', width: 40, height: 30 },
    systems: [
      new TeleporterSystem(),
      new EnemyAISystem(),
      new ProjectileSystem()
    ],
    tickRate: 10
  });
}

const runtime = loadOrCreateGame();
setupGame(runtime);
runtime.start();

// 9. Restart game (e.g., player dies)
function onPlayerDeath() {
  runtime.stop();
  showGameOver();
  
  // Wait for player input
  waitForInput().then(() => {
    runtime.restart(true); // Auto-start new game
    setupGame(runtime); // Spawn player, enemies, etc.
  });
}
```

---

## Testing

GameRuntime makes testing easy - just call `tick()` manually:

```typescript
describe('GameRuntime', () => {
  it('should handle player movement', () => {
    const runtime = new GameRuntime({
      initialScene: { id: 'test', width: 10, height: 10 },
      systems: []
    });
    
    const playerId = runtime.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    
    // Stage movement
    runtime.spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
    
    // Execute tick
    runtime.tick();
    
    // Verify
    const pos = runtime.spatial.getEntityPosition(playerId);
    expect(pos).toEqual({ x: 6, y: 5, layer: GameLayers.ACTORS });
  });
});
```

---

## Implementation Checklist

**Core:**
- [ ] GameRuntimeConfig interface
- [ ] GameRuntime private constructor (unified construction)
- [ ] GameRuntime.new() static method (new game)
- [ ] GameRuntime.load() static method (load game)
- [ ] start() method with requestAnimationFrame loop
- [ ] stop() method
- [ ] Fixed timestep logic with accumulator
- [ ] tick() method (public, for testing and internal use)

**Save/Load:**
- [ ] save() method (wraps GameManager.save())
- [ ] restart() method (reset to initial state)
- [ ] Store initialConfig for restart support

**Scene Management:**
- [ ] Scene transition detection and handling
- [ ] System re-registration on scene transition
- [ ] initializeLoop() helper (called on start and transitions)

**Access:**
- [ ] Access properties (game, spatial, activeScene, isRunning, tickCount)

**Estimated size:** ~200 lines (with save/load)

---

## Files to Create

1. **`packages/spartan/game-runtime.ts`** - Main GameRuntime class
2. **`packages/spartan/test/game-runtime.test.ts`** - Unit tests
3. Update **`packages/spartan/index.ts`** - Export GameRuntime

---

## Future Enhancements (Out of Scope)

- Event system (onTick, onSceneChange, etc.)
- Pause/resume with state preservation
- Slow motion / time dilation
- Replay recording
- Performance metrics
- Input buffering/rollback
- Network synchronization

Keep it Spartan for now!
