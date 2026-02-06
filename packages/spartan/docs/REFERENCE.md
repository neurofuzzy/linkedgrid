# Spartan Framework Reference

A comprehensive, LLM-friendly reference for the Spartan grid-based game framework.

---

## Table of Contents

**I. Basics**
- [Core Concepts and Conventions](#core-concepts-and-conventions)
- [Architecture Overview](#architecture-overview)
- [Game Configuration](#game-configuration)
- [Game Data Format](#game-data-format)
- [Game Systems at a Glance](#game-systems-at-a-glance)
- [Entities and Data](#entities-and-data)

**II. Getting Started**
- [Setting Up a Game](#setting-up-a-game)
- [Embedding a Game (Web)](#embedding-a-game-web)
- [User Input](#user-input)
- [Customizing Entities](#customizing-entities)
- [Adding Your Own Renderer](#adding-your-own-renderer)
- [Displaying Your Own HUD](#displaying-your-own-hud)

**III. Advanced Concepts**
- [Spatial Queries](#spatial-queries)
- [Layers](#layers)
- [Entity Lifecycle](#entity-lifecycle)
- [Intents and the Transaction Model](#intents-and-the-transaction-model)
- [Signals](#signals)

**IV. Composing Traits**
- [Trait System Philosophy](#trait-system-philosophy)
- [Built-in Traits Reference](#built-in-traits-reference)
- [Creating Custom Traits](#creating-custom-traits)
- [Character Personas](#character-personas)

**V. Systems in Detail**
- [System Base Classes](#system-base-classes)
- [System Execution Order](#system-execution-order)
- [System Configuration](#system-configuration)
- [All Systems Reference](#all-systems-reference)

**VI. Visual and Automated Tests**
- [Dual Execution Model](#dual-execution-model)
- [Writing Visual Tests](#writing-visual-tests)
- [Test Timing and Tick Mechanics](#test-timing-and-tick-mechanics)
- [Test Fixtures and Helpers](#test-fixtures-and-helpers)

**VII. How-tos**
- [Add a New Entity Type](#add-a-new-entity-type)
- [Add a New System](#add-a-new-system)
- [Handle Floor Hazards](#handle-floor-hazards)
- [Implement Scene Transitions](#implement-scene-transitions)
- [Set Up Objectives and Scoring](#set-up-objectives-and-scoring)
- [Use NPC Personas](#use-npc-personas)
- [Implement Push Puzzles](#implement-push-puzzles)

---

# I. Basics

## Core Concepts and Conventions

Spartan is a **cell-centric sparse entity system** for grid-based games. Its design follows five principles:

1. **Minimal** -- Only what is necessary. No abstractions without clear payoff.
2. **Explicit** -- No magic. Clear intent in code structure, naming, and flow.
3. **Testable** -- Every feature verifiable in both headless (CI) and visual runners.
4. **Visual** -- Show, don't just tell. Visual tests demonstrate behavior.
5. **Deterministic** -- Same input over same ticks = same output. Ticks, not deltaTime.

### Key Conventions

- **Entities are dumb data**. No methods. All logic lives in Systems.
- **All writes are deferred**. `spawn()`, `move()`, `remove()` stage intents. `commit()` executes.
- **Systems react to intents**. Input systems stage moves; game systems inspect pending ops.
- **Ticks, not milliseconds**. All timing is discrete. Fire spreads on tick N, not at 10.45 ms.
- **Traits over inheritance**. Entities are composed of trait interfaces via TypeScript intersection types.

### Naming Conventions

| Artifact | Pattern | Example |
| :--- | :--- | :--- |
| System file | `[name].system.ts` | `fire.system.ts` |
| Entity file | `[name].entity.ts` | `player.entity.ts` |
| Trait file | `[name].trait.ts` | `health.trait.ts` |
| Config file | `[domain].config.ts` | `systems.config.ts` |
| Test file | `[name].test.ts` or `[name].visual.test.ts` | `melee.test.ts` |

**Source**: [config/](../config/), [specs/spartan-dev-rules.md](../../../specs/spartan-dev-rules.md)

---

## Architecture Overview

```
GameRuntime (real-time execution)
    +-> GameManager (cross-scene coordinator)
    |   +-> GameState (global: score, lives, playerEntityId, objectives)
    |   |   +-> EntityStore (entity metadata by ID)
    |   +-> SceneManager (multi-scene bookkeeping)
    |       +-> Scene (isolated game area)
    |           +-> LinkedGrid (topology + cells)
    |           +-> SpatialSystem (positions + deferred ops)
    |           +-> EntityStore (scene entities)
    +-> GameLoop (tick: detect -> systems -> commit)
        +-> Systems[] (game logic in execution order)
```

### Responsibility Summary

| Component | One Job |
| :--- | :--- |
| **LinkedGrid** | 2D grid topology and cell access |
| **LinkedCell** | Storage per layer (values, masks, distances) |
| **SpatialSystem** | Entity positions, deferred ops, validation, queries |
| **Scene** | Isolated game area container (grid + spatial + store) |
| **SceneManager** | Multi-scene bookkeeping |
| **GameManager** | Cross-scene coordinator, global state |
| **GameLoop** | Tick orchestration for one scene |
| **GameRuntime** | Real-time execution environment |

Scenes are **hermetically sealed**. Entity in Scene A cannot interact with Entity in Scene B without explicit cross-scene operations via `GameManager`.

**Source**: [core/game-runtime.ts](../core/game-runtime.ts), [core/game-manager.ts](../core/game-manager.ts), [core/spatial-system.ts](../core/spatial-system.ts), [specs/spartan-responsibilities.md](../../../specs/spartan-responsibilities.md)

---

## Game Configuration

Games are defined via JSON configuration loaded by `GameRuntime.fromConfig()`.

```typescript
interface GameConfig {
  description?: string;         // Shown in playground
  initialScene: string;         // Starting scene ID
  systems?: string[];           // System names (auto-resolved)
  tickRate?: number;            // Ticks per second (default: 10)
  input?: {
    type: 'keyboard' | 'headless' | 'none';
    preset?: 'classic' | 'twin-stick' | 'separated';
    options?: Record<string, unknown>;
  };
  scenes: SceneDefinition[];    // Scene definitions
  objectives?: ObjectiveConfig[];  // Game objectives
}
```

**Initialization is five-phase**:
1. **Structure** -- Create all scenes (empty grids)
2. **Hydration** -- Spawn all entities across all scenes
3. **Global Indexing** -- Register scene connections (teleporters)
4. **Objectives** -- Load objectives into GameState
5. **System Initialization** -- Create all systems via registry

All game systems are automatically created by the built-in [system registry](../core/system-registry.ts). No manual system instantiation required when using `fromConfig()`.

**Source**: [core/game-runtime.ts](../core/game-runtime.ts)

---

## Game Data Format

Scenes contain entity definitions in JSON:

```json
{
  "initialScene": "level-1",
  "input": { "type": "keyboard", "preset": "twin-stick" },
  "objectives": [
    { "id": "kill-all", "type": "kill-all", "sceneId": "level-1" },
    { "id": "reach-exit", "type": "reach-exit", "sceneId": "level-1" }
  ],
  "scenes": [
    {
      "id": "level-1",
      "name": "Arena",
      "width": 15,
      "height": 15,
      "entities": [
        {
          "type": "player",
          "x": 7, "y": 7, "layer": 6,
          "data": {
            "hp": 100, "maxHp": 100,
            "damage": 10, "healthState": "alive",
            "inventory": [], "team": "player",
            "equippedWeapon": "pistol",
            "ammo": { "pistol": 30 },
            "meleeDamage": 25, "meleeCooldown": 3, "meleeRange": 1
          }
        },
        {
          "type": "enemy",
          "x": 3, "y": 3, "layer": 6,
          "data": {
            "hp": 30, "maxHp": 30, "healthState": "alive",
            "damage": 5, "team": "enemy",
            "scoreValue": 10, "color": "#ff4444"
          }
        },
        {
          "type": "wall",
          "x": 0, "y": 0, "layer": 5,
          "data": { "color": "#666" }
        },
        {
          "type": "coin",
          "x": 5, "y": 5, "layer": 4,
          "data": { "scoreValue": 5, "collectible": true }
        }
      ]
    }
  ]
}
```

**Key rules**:
- `type` identifies the entity archetype (string)
- `x`, `y` are 0-indexed grid coordinates
- `layer` is the semantic layer number (see [Layers](#layers))
- `data` contains all trait properties for the entity
- Comment objects `{ "_comment": "..." }` are silently skipped

**Source**: [dev/games/](../../../dev/games/) for examples

---

## Game Systems at a Glance

All 25 built-in systems, grouped by execution phase:

| Phase | System | Tick Rate | Description |
| :--- | :--- | :--- | :--- |
| **input** | PlayerInputSystem | 1 | Translates player input into movement intents |
| **pre-commit** | PushSystem | 1 | Resolves push interactions from movement intents |
| **pre-commit** | DoorSystem | 1 | Unlocks doors when player has matching key |
| **pre-commit** | NPCBrainSystem | 1 | AI Controller: threat scan, posture, attack/movement intent |
| **main** | MeleeSystem | 1 | Close-range combat (player and NPC) |
| **main** | PlayerWeaponSystem | 1 | Ranged weapon firing with ammo tracking |
| **main** | NPCMovementSystem | 2 | Autonomous NPC movement (pursue, patrol, guard, etc.) |
| **main** | FireSystem | 1 | Temperature-based fire spread and burning |
| **main** | ExplosionSystem | 1 | Area-of-effect explosions |
| **main** | LiquidSystem | 1 | Volumetric liquid flow |
| **main** | PoisonSystem | 1 | Density-based gas dispersion and damage |
| **main** | ChainReactionSystem | 1 | Domino-like chain reactions |
| **main** | FloorEffectSystem | 1 | Floor hazards (lava, ice, mud) and healing |
| **main** | ProjectileSystem | 1 | Autonomous projectiles along Bresenham paths |
| **main** | TurretSystem | 1 | Stationary shooters targeting entities |
| **main** | SignalSystem | 1 | Signal propagation (switches, conductors, gates, range sensors) |
| **main** | GateSystem | 1 | Signal-controlled gate open/close |
| **main** | SpawningSystem | 1 | Entity spawning with wave mode and boundary recycling |
| **post-commit** | HealthSystem | 1 | Intent-based damage/heal, death states, removal |
| **post-commit** | CollectionSystem | 1 | Item pickup and inventory |
| **post-commit** | TeleporterSystem | 1 | Cross-scene teleportation |
| **post-commit** | PowerupSystem | 1 | Powerup collection, buffs, health-regen (heal-over-time) |
| **post-commit** | RespawnSystem | 1 | Player death and respawn at checkpoints |
| **post-commit** | ScoreSystem | 1 | Score tracking from kills and coins |
| **post-commit** | ObjectiveSystem | 1 | Objective tracking (collect-flag, kill-all, reach-exit, wave-clear) |

**Source**: [config/systems.config.ts](../config/systems.config.ts), [core/system-registry.ts](../core/system-registry.ts)

---

## Entities and Data

Entities are **dumb data containers** composed of **traits**.

```
Trait (data contract)  ->  Entity Type (composition)  ->  System (logic)
interface HasHealth     |  type PlayerData =           |  class HealthSystem
  { hp, maxHp }        |    EntityData & HasHealth     |    if (hasHealth(e))
                        |    & HasWeapon & HasMelee     |      e.hp -= damage
```

### Entity Categories

| Category | Types | Layer |
| :--- | :--- | :--- |
| **Player** | `player` | ACTORS (6) |
| **Enemies** | `enemy`, `guard` | ACTORS (6) |
| **Structures** | `wall`, `door`, `open-door`, `torch`, `destructible-wall`, `spawner` | WALLS (5) |
| **Collectibles** | `item`, `key`, `gasoline`, `fuse` | COLLECTIBLES (4) |
| **Hazards** | `lava`, `acid`, `medbay`, `ice`, `mud`, `barrel` | FLOOR (1) |
| **Elementals** | `fire-visual`, `poison-gas`, `water`, `ash`, `grass`, `explosion-visual`, `projectile`, `ray-effect` | Various |
| **Objectives** | `coin`, `flag`, `exit` | COLLECTIBLES (4) |
| **Powerups** | `health-pack`, `health-potion`, `shield-pack`, `speed-boost`, `damage-boost`, `invincibility`, `ammo-pack`, `weapon-pickup` | COLLECTIBLES (4) |
| **Spawning** | `player-start`, `checkpoint` | FLOOR (1) |
| **Signals** | `oscillator`, `pressure-switch`, `inverter`, `conductive-floor`, `gate`, `transceiver`, `range-sensor` | FLOOR/WALLS |
| **Logic** | `chain-link`, `path-node`, `sleep-wake` | LOGIC (3) |
| **Teleporters** | `teleporter` | FLOOR (1) |

**Source**: [entities/](../entities/), [traits/trait-guards.ts](../traits/trait-guards.ts)

---

# II. Getting Started

## Setting Up a Game

### Option A: JSON Configuration (Recommended)

Create a JSON file defining scenes, entities, and objectives, then load it:

```typescript
import { GameRuntime } from '@spartan/core';

const config = await fetch('/games/my-level.json').then(r => r.json());
const runtime = GameRuntime.fromConfig(config, inputProvider);
runtime.start();
```

All systems are automatically initialized. The `inputProvider` enables player-controlled systems (movement, melee, weapons).

### Option B: Programmatic Setup

```typescript
import { GameRuntime, GameLayers } from '@spartan';

const runtime = GameRuntime.new({
  initialScene: { id: 'level-1', width: 20, height: 20 },
  systems: [],
  tickRate: 10,
});

// Spawn entities
const playerId = runtime.spatial.spawn('player', 10, 10, GameLayers.ACTORS, {
  hp: 100, maxHp: 100, damage: 10, healthState: 'alive',
  inventory: [], team: 'player',
});
runtime.game.gameState.playerEntityId = playerId;
runtime.spatial.commit();

runtime.start();
```

### Headless / Test Setup

```typescript
import { GameRuntime } from '@spartan/core';
import { TestInputProvider } from '@spartan/test/test-input-provider';

const input = new TestInputProvider();
const runtime = GameRuntime.fromConfig(config, input);

// Programmatic control
input.setMoveDirection(Direction.RIGHT);
runtime.tick();
input.reset();
```

**Source**: [core/game-runtime.ts](../core/game-runtime.ts), [test/test-input-provider.ts](../test/test-input-provider.ts)

---

## Embedding a Game (Web)

The `spartan-web` package provides `GameEmbed` for browser integration:

```typescript
import { GameEmbed } from '@spartan-web';

const embed = new GameEmbed(document.getElementById('game'));

const config = await fetch('/games/level.json').then(r => r.json());
embed.load(config);
embed.start();

// Access runtime for custom rendering
const runtime = embed.getRuntime();
const spatial = runtime.spatial;

// Cleanup
embed.destroy();
```

`GameEmbed` handles:
- Input manager creation (keyboard, gamepad, mouse)
- Input preset configuration (classic, twin-stick, separated)
- System initialization via the built-in registry
- Game lifecycle (start, stop, tick, destroy)

**Source**: [spartan-web/game-embed.ts](../../spartan-web/game-embed.ts)

---

## User Input

### InputProvider Interface

All input flows through the `InputProvider` interface, decoupling game logic from input devices:

```typescript
interface InputProvider {
  getMoveDirection(): Direction;      // Arrow keys / left stick
  getAimDirection(): Direction;       // WASD / right stick
  getPrimaryAction(): boolean;        // Space / A button (melee)
  getSecondaryAction(): boolean;      // Shift / B button (ranged)
  getStart(): boolean;                // Pause
  getRestart(): boolean;              // Restart
  isAiming(): boolean;                // True when aim direction set
  beginFrame?(): void;                // Cache input state per tick
}
```

### Input Presets

| Preset | Movement | Aiming | Firing |
| :--- | :--- | :--- | :--- |
| `classic` | Arrows + WASD | Last move direction | Action buttons |
| `twin-stick` | Arrows / L-stick | WASD / R-stick | Auto-fires when aiming |
| `separated` | Arrows | WASD (attack direction) | Action buttons |

### Input Types

| Type | Use Case | Implementation |
| :--- | :--- | :--- |
| `keyboard` | Browser games | `WebInputProvider` wrapping `InputManager` |
| `headless` | Tests | `HeadlessInputManager.asInputProvider()` |
| `none` | AI-only games | No input provider |

**Source**: [core/input-provider.ts](../core/input-provider.ts), [spartan-web/input/](../../spartan-web/input/)

---

## Customizing Entities

Entities are purely data. Customize by adding properties in the `data` field:

```json
{
  "type": "enemy",
  "x": 5, "y": 5, "layer": 6,
  "data": {
    "hp": 200, "maxHp": 200,
    "armor": 10, "hardness": 5,
    "damage": 25, "healthState": "alive",
    "team": "enemy", "scoreValue": 100,
    "shield": 50, "maxShield": 50,
    "movementMode": "guard", "guardRadius": 3,
    "color": "#ff0000"
  }
}
```

Any properties placed in `data` become part of the entity's metadata. Systems use **trait guards** to check for capabilities at runtime:

```typescript
if (hasArmor(entity)) {
  // TypeScript knows entity.armor exists
  damage = Math.max(0, damage - entity.armor);
}
```

---

## Adding Your Own Renderer

Spartan is **renderer-agnostic**. The framework manages game state; you read it to render.

```typescript
function render(spatial: SpatialSystem, grid: LinkedGrid) {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cell(x, y);
      if (!cell) continue;

      // Read entities from each layer
      for (const layer of GAMEPLAY_VISIBLE_LAYERS) {
        const entityId = spatial.getEntityIdAt(x, y, layer);
        if (entityId === undefined) continue;

        const data = spatial.getEntityData(entityId);
        if (!data) continue;

        drawEntity(x, y, layer, data);
      }
    }
  }
}
```

Call your render function after each tick:

```typescript
runtime.start();
// In your render loop:
// 1. runtime.tick() advances game state (handled by runtime.start())
// 2. Read spatial state to render
```

---

## Displaying Your Own HUD

Read game state directly for HUD display:

```typescript
const gameState = runtime.game.gameState;

// Player stats
const playerId = gameState.playerEntityId;
const playerData = runtime.spatial.getEntityData(playerId);
const hp = playerData?.hp;
const maxHp = playerData?.maxHp;
const score = gameState.score;
const lives = gameState.lives;

// Weapon info
const equippedWeapon = playerData?.equippedWeapon;
const ammo = playerData?.ammo?.[equippedWeapon];

// Objectives
const objectives = gameState.objectives;
const completed = objectives?.filter(o => o.completed).length;
const total = objectives?.length;
```

---

# III. Advanced Concepts

## Spatial Queries

`SpatialSystem` provides efficient spatial queries:

### Point Queries

```typescript
// Single entity at specific layer
const actorId = spatial.getEntityIdAt(x, y, GameLayers.ACTORS);

// All entities in a cell (all layers)
const allIds = spatial.getEntityIdsInCell(x, y);
```

### Area Queries

```typescript
// Circular radius (Euclidean distance)
const nearbyIds = spatial.getEntityIdsInRadius(x, y, 3.5);

// Line of sight (Bresenham line)
const lineIds = spatial.getEntityIdsInLine(startX, startY, endX, endY);
```

### Grid Cell Algorithms (via LinkedCell)

```typescript
const cell = spatial.getGrid().cell(x, y);

// Raycast from cell in direction
const hitCells = cell.raycast(Direction.RIGHT, 10, c => spatial.isBlocked(c));

// Field of view (circle, blocked by walls)
const visibleCells = cell.fieldOfView(5, c => spatial.blocksVision(c));

// Cone field of view (for shotgun-style attacks)
const coneCells = cell.fieldOfViewCone(Direction.UP, 90, 5, c => spatial.blocksVision(c));

// Pathfinding (A*)
const path = cell.findPath(targetCell, c => spatial.isBlocked(c));

// Neighbors within range
const nearby = cell.getNeighborsWithinRange(3);
```

### Validation Queries

```typescript
spatial.isBlocked(cell);       // Walls or actors present?
spatial.blocksVision(cell);    // Walls present?
spatial.isWalkable(cell);      // Not blocked?
spatial.isAlive(entityId);     // Not pending removal?
```

**Source**: [core/spatial-system.ts](../core/spatial-system.ts), [core/grid/linked-cell.ts](../core/grid/linked-cell.ts), [core/grid/linked-cell-utils.ts](../core/grid/linked-cell-utils.ts)

---

## Layers

Spartan uses a fixed **8-layer architecture** with semantic meaning. Each cell stores one entity per layer.

| Index | Name | Purpose | Blocks Movement | Blocks Vision |
| :--- | :--- | :--- | :--- | :--- |
| 0 | BACKGROUND | Static backgrounds | No | No |
| 1 | FLOOR | Walkable terrain, effects | No | No |
| 2 | LOGIC | Invisible AI/editor helpers | No | No |
| 3 | FLOOR_EFFECTS | Ash, burn marks | No | No |
| 4 | COLLECTIBLES | Pickups, items | No | No |
| 5 | WALLS | Static obstacles, doors | Yes | Yes |
| 6 | ACTORS | Players, enemies, NPCs | Yes | No |
| 7 | EPHEMERALS | Projectiles, fire visuals | No | No |
| 8 | DEBUG | Debug overlays | No | No |

**Layer rules**:
- One entity per layer per cell
- Higher layers render on top
- `CellMasks.BLOCKING` and `CellMasks.VISION_BLOCKING` are managed automatically by `SpatialSystem`
- Always use `GameLayers` constants, never magic numbers

```typescript
import { GameLayers, CellMasks } from '@spartan';

spatial.spawn('wall', 5, 5, GameLayers.WALLS, { color: '#666' });
spatial.spawn('coin', 5, 6, GameLayers.COLLECTIBLES, { scoreValue: 5 });
```

**Source**: [config/layers.config.ts](../config/layers.config.ts), [specs/spartan-layer-rules.md](../../../specs/spartan-layer-rules.md)

---

## Entity Lifecycle

### Spawn -> Live -> Remove

All spatial operations are **deferred** (two-phase commit):

```
Stage intent:  spatial.spawn() / spatial.move() / spatial.remove()
   |           Nothing happens yet. Intent is queued.
   v
Commit:        spatial.commit()  (called automatically at end of tick)
               Validates and executes all queued operations atomically.
```

### Lifecycle Queries During a Tick

```typescript
// After staging removal:
spatial.remove(entityId);
spatial.isAlive(entityId);  // false (pending removal)
// Entity still on grid until commit!

// After staging spawn:
const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {...});
spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);  // undefined (not committed yet)
```

### Entity Lifecycle Callbacks

Systems can subscribe to spawn/remove events:

```typescript
const unsubSpawn = spatial.onSpawn((event) => {
  // event: { entityId, type, x, y, layer }
});

const unsubRemove = spatial.onRemove((event) => {
  // event: { entityId, type, x, y, layer }
});
```

### Health State Machine

Entities with `HasHealth` follow a state machine:

```
alive  ->  dying (animation period)  ->  dead (removed)
```

The `HealthSystem` manages this transition:
1. `damage()` intent reduces HP
2. When HP reaches 0, state transitions to `dying`
3. After `dyingDuration` ticks, state transitions to `dead`
4. `dead` entities are removed from the grid

**Source**: [core/spatial-system.ts](../core/spatial-system.ts), [systems/health.system.ts](../systems/health.system.ts)

---

## Intents and the Transaction Model

### The Core Pattern

```
1. PlayerInputSystem  ->  stages move intent (no validation)
2. DoorSystem         ->  sees intent, unlocks door if key present
3. spatial.commit()   ->  validates move, executes if valid
```

**Input systems are dumb**: They always stage intents, even into walls.
**Game systems are reactive**: They inspect `getPendingOps()` to react.
**Commit is the gatekeeper**: Validates blocking, occupancy, conflicts.

### Inspecting Intents

```typescript
class MySystem implements GameSystem {
  update({ spatial }: GameContext) {
    const pendingOps = spatial.getPendingOps();
    for (const op of pendingOps) {
      if (op.type === 'move' && op.entityId === playerId) {
        const destCell = spatial.getGrid().cell(op.toX!, op.toY!);
        // React: modify world state before commit validates
      }
    }
  }
}
```

### Operation Types

```typescript
interface PendingOperation {
  type: 'move' | 'remove' | 'spawn';
  entityId?: number;
  fromX?: number; fromY?: number;
  toX?: number; toY?: number;
  x?: number; y?: number;
  layer: number;
}
```

### Commit Execution Order

1. Execute removals (clears blocking masks)
2. Validate and execute moves (checks `isBlocked()`)
3. Execute spawns

This ordering means a door removed in step 1 unblocks a move validated in step 2.

**Source**: [core/spatial-system.ts](../core/spatial-system.ts), [specs/spartan-responsibilities.md](../../../specs/spartan-responsibilities.md)

---

## Signals

The signal system enables logic circuits: switches, conductors, gates.

### Signal Entities

| Entity | Role | Description |
| :--- | :--- | :--- |
| `oscillator` | Generator | Toggles on/off every N ticks |
| `pressure-switch` | Generator | Emits when entity stands on it |
| `conductive-floor` | Conductor | Carries signal to adjacent conductors |
| `inverter` | Logic | Emits inverted input signal |
| `transceiver` | Relay | Wireless signal relay by channel |
| `gate` | Receiver | Opens/closes based on signal state |
| `range-sensor` | Generator | Emits signal when player is within range (optional LOS) |
| `sleep-wake` | Receiver | Activates/deactivates NPCs in zone |

### How Signals Flow

1. **Generators** (oscillator, pressure-switch) produce signals
2. **Conductors** (conductive-floor) propagate signals to neighbors
3. **Logic** (inverter) transforms signals
4. **Receivers** (gate, sleep-wake) react to signal state

```json
{
  "type": "oscillator",
  "x": 2, "y": 2, "layer": 1,
  "data": { "signalChannel": "A", "period": 8, "phase": 0, "signalOn": true }
},
{
  "type": "conductive-floor",
  "x": 3, "y": 2, "layer": 1,
  "data": { "signalChannel": "A", "conductiveChannel": "A" }
},
{
  "type": "gate",
  "x": 4, "y": 2, "layer": 5,
  "data": { "signalChannel": "A", "isOpen": false, "color": "#886644" }
}
```

**Source**: [systems/signal.system.ts](../systems/signal.system.ts), [systems/gate.system.ts](../systems/gate.system.ts), [specs/signal-system-spec.md](../../../specs/signal-system-spec.md)

---

# IV. Composing Traits

## Trait System Philosophy

Traits are **passive data interfaces**. They describe *what data an entity has*, not *what it does*.

```typescript
// Trait: data contract
interface HasHealth {
  hp: number;
  maxHp: number;
  healthState: 'alive' | 'dying' | 'dead';
}

// Entity Type: composition of traits
type PlayerData = BaseEntityData
  & HasHealth & HasMelee & HasWeapon
  & HasInventory & HasBuff & HasTeam;

// Type Guard: runtime check
function hasHealth(e: unknown): e is EntityData & HasHealth {
  return typeof (e as any).hp === 'number';
}

// System: logic operating on traits
class HealthSystem {
  update({ spatial }: GameContext) {
    for (const [id, pos] of spatial.getAllPositions()) {
      const entity = spatial.getEntityData(id);
      if (hasHealth(entity) && entity.hp <= 0) {
        // Handle death
      }
    }
  }
}
```

**Best practices**:
- Systems should operate on **traits** (generic), not **entity types** (specific)
- Keep traits independent; traits should not depend on other traits
- Always use type guards before accessing trait properties
- Store transient state in systems, not entities

---

## Built-in Traits Reference

### Combat Traits

| Trait | Properties | Used By |
| :--- | :--- | :--- |
| `HasHealth` | `hp`, `maxHp`, `healthState` | HealthSystem |
| `CanDealDamage` | `damage` | Contact damage on overlap |
| `HasMelee` | `meleeDamage`, `meleeCooldown`, `meleeRange`, `lastAttackTick`, `meleeDirection` | MeleeSystem |
| `HasWeapon` | `equippedWeapon`, `ammo`, `lastFireTick` | PlayerWeaponSystem |
| `HasArmor` | `armor` | Flat damage reduction |
| `HasShield` | `shield`, `maxShield`, `shieldRegenRate`, `shieldRegenDelay` | Absorbs damage before HP |
| `HasResistance` | `resistance` | Percentage damage reduction (0-1) |
| `HasVulnerability` | `vulnerabilities` | Damage type multipliers |
| `HasBuff` | `activeBuffs` | PowerupSystem (health-regen, speed, damage, shield, invincibility) |

### Movement Traits

| Trait | Properties | Used By |
| :--- | :--- | :--- |
| `HasAI` | `aiState` | General AI state |
| `HasNPCMovement` | `movementMode`, `speed`, `followTarget`, `patrolPath`, `guardRadius` | NPCMovementSystem |
| `HasNPCBrain` | `posture`, `threatRange`, `attackRange`, `preferRanged`, `retreatHealthPct` | NPCBrainSystem (Controller/Executor pattern) |
| `HasPushable` | `pushable` | PushSystem (can be pushed) |
| `HasPusher` | `pushStrength` | PushSystem (can push) |
| `HasProjectile` | `projectileSpeed`, `projectileDamage`, `path`, `bounceCount`, `pierceCount` | ProjectileSystem |

### Spatial Traits

| Trait | Properties | Used By |
| :--- | :--- | :--- |
| `HasSceneLocation` | `sceneId` | Persisting across rooms |
| `HasTeleportTarget` | `targetX`, `targetY`, `targetSceneId` | TeleporterSystem |
| `HasSceneConnection` | `connectionKey` | Cross-scene portals |
| `HasFloorEffect` | `effectType`, `effectDamage`, `effectCadence` | FloorEffectSystem |
| `HasTemperature` | `temperature`, `flammable`, `flamePoint` | FireSystem |
| `HasExplosion` | `explosionRadius`, `explosionDamage` | ExplosionSystem |
| `HasPropagation` | `propagationType`, `spreadRate` | Legacy spreading |
| `HasDensity` | `density`, `maxDensity` | PoisonSystem |
| `HasLiquid` | `depth`, `maxDepth`, `flowRate` | LiquidSystem |

### Identity Traits

| Trait | Properties | Used By |
| :--- | :--- | :--- |
| `HasPlayerRole` | `isPlayer: true` | Player identification |
| `HasTeam` | `team: 'player' \| 'enemy' \| 'neutral'` | Team-based combat |
| `HasScoreValue` | `scoreValue` | ScoreSystem |
| `HasCheckpoint` | `lastCheckpointId`, `lastCheckpointSceneId` | RespawnSystem |
| `HasInventory` | `inventory` | CollectionSystem |
| `IsCollectible` | `collectible` | CollectionSystem |
| `IsLockable` | `lockId` | DoorSystem |
| `HasColor` | `color` | Visual rendering |

### Signal Traits

| Trait | Properties | Used By |
| :--- | :--- | :--- |
| `HasSignalEmitter` | `signalChannel`, `signalOn` | SignalSystem |
| `HasSignalReceiver` | `signalChannel` | SignalSystem |
| `HasConductive` | `conductiveChannel` | SignalSystem |

### Structure Traits

| Trait | Properties | Used By |
| :--- | :--- | :--- |
| `HasSpawner` | `spawnType`, `spawnLayer`, `spawnLimit`, `spawnCooldown`, `waveMode`, `waveSize`, `totalWaves`, `recycleAtBoundary` | SpawningSystem |
| `HasTurret` | `turretRange`, `turretCooldown`, `turretWeaponType`, `turretTargeting` | TurretSystem |

**Source**: [traits/](../traits/), [traits/trait-guards.ts](../traits/trait-guards.ts)

---

## Creating Custom Traits

Follow this 3-step pattern:

```typescript
// 1. Define Trait (data contract)
interface HasMana {
  mana: number;
  maxMana: number;
}

// 2. Create Type Guard (runtime check)
function hasMana(e: unknown): e is EntityData & HasMana {
  return typeof (e as any).mana === 'number';
}

// 3. Compose Entity (archetype)
type MageData = BaseEntityData & HasHealth & HasMana;
```

Then use in systems:

```typescript
class ManaSystem extends BaseReactiveSystem {
  update({ spatial }: GameContext) {
    for (const [id] of spatial.getAllPositions()) {
      const entity = spatial.getEntityData(id);
      if (hasMana(entity) && entity.mana < entity.maxMana) {
        entity.mana += 1; // Regenerate
      }
    }
  }
}
```

---

## Character Personas

Personas are preset stat templates for spawning NPCs. Four tiers of increasing difficulty:

| Persona | Tier | HP | Armor | Damage | Speed | Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `grunt` | 1 | 30 | 0 | 5 | 3 | 10 |
| `soldier` | 2 | 60 | 2 | 10 | 2 | 25 |
| `elite` | 3 | 100 | 5 | 15 | 2 | 50 |
| `boss` | 4 | 200 | 10 | 25 | 1 | 100 |

```typescript
import { spawnNPC } from '@spartan';

// Spawn a grunt at (5, 5) with default stats
const gruntId = spawnNPC(spatial, 'grunt', 5, 5);

// Spawn an elite with overrides
const eliteId = spawnNPC(spatial, 'elite', 10, 5, {
  movementMode: 'guard',
  guardRadius: 3,
});
```

**Source**: [config/personas.config.ts](../config/personas.config.ts), [entities/spawn-helpers.ts](../entities/spawn-helpers.ts)

---

# V. Systems in Detail

## System Base Classes

All systems extend one of three base classes from [core/base-system.ts](../core/base-system.ts):

### BaseReactiveSystem

Runs **every tick**. For systems that must react immediately to intents and overlaps.

```typescript
class DoorSystem extends BaseReactiveSystem {
  update({ spatial }: GameContext) {
    const pendingOps = spatial.getPendingOps();
    // React to player movement intents
  }
}
```

### BaseTickedSystem

Runs every **N ticks** (controlled by `tickRate`). For AI, physics, environmental effects.

```typescript
class NPCMovementSystem extends BaseTickedSystem {
  protected tickRate = SYSTEM_CONFIG.NPCMovement.tickRate; // 2

  protected onTick({ spatial }: GameContext) {
    // Runs every 2 ticks
  }
}
```

Provides automatic tick counting and `resetState()` for tick counter reset.

### BaseSystem

Abstract base with `resetState()` and `getDebugState()`. Use directly only for custom timing.

### Lifecycle Hooks (BaseTickedSystem)

```typescript
onEntitySpawn(event: EntityLifecycleEvent): void;  // Called on entity spawn
onEntityRemove(event: EntityLifecycleEvent): void;  // Called on entity removal
onSceneChange(): void;                              // Called on scene transition
onTick(context: GameContext): void;                 // Called every N ticks
resetState(): void;                                 // Clear all internal state
getDebugState(): Record<string, unknown>;           // Expose state for debug
```

---

## System Execution Order

System execution order is **critical**. Within a single tick:

```
1. Input Phase     - PlayerInputSystem stages movement intents
2. Pre-Commit      - PushSystem, DoorSystem react to intents
3. Main Phase      - All game logic (combat, fire, projectiles, signals, etc.)
4. --- commit() ---  Spatial validates and executes all operations
5. Post-Commit     - HealthSystem, CollectionSystem, TeleporterSystem, etc.
```

**Why order matters**: Reactive systems need to see intents *before* commit validates them. A DoorSystem must remove the door *before* commit checks if the player's move is blocked.

The system registry ([core/system-registry.ts](../core/system-registry.ts)) creates systems in the correct dependency order.

---

## System Configuration

All system timing and metadata is centralized in [config/systems.config.ts](../config/systems.config.ts):

```typescript
export const SYSTEM_CONFIG = {
  PlayerInput: {
    tickRate: 1,
    executionPhase: 'input',
    dependencies: [],
    description: 'Translates player input into movement intents',
  },
  Fire: {
    tickRate: 1,
    executionPhase: 'main',
    dependencies: ['SpatialSystem'],
    description: 'Spreads fire, applies temperature logic, and consumes fuel',
  },
  // ... etc
};
```

**Execution phases** (in order):
1. `input` -- Input translation
2. `pre-commit` -- React to intents before validation
3. `main` -- Core game logic
4. `post-commit` -- React to committed changes

---

## All Systems Reference

### PlayerInputSystem
**Phase**: input | **Tick Rate**: 1

Translates `InputProvider.getMoveDirection()` into `spatial.move()` intents. No validation -- always stages moves. Must run first.

**Source**: [systems/player-input.system.ts](../systems/player-input.system.ts)

### PushSystem
**Phase**: pre-commit | **Tick Rate**: 1

Detects pending moves into pushable entities. Stages chain push operations. Supports multi-entity push chains.

**Source**: [systems/push.system.ts](../systems/push.system.ts)

### DoorSystem
**Phase**: pre-commit | **Tick Rate**: 1

Inspects pending move ops. If player moves into a locked door and has the matching key, removes door and consumes key.

**Source**: [systems/door.system.ts](../systems/door.system.ts)

### NPCBrainSystem
**Phase**: pre-commit | **Tick Rate**: 1

AI Controller system using the Controller/Executor pattern. High-level brain makes decisions and writes intent fields onto entity data; low-level executor systems (NPCMovementSystem, MeleeSystem, ProjectileSystem) act on those intents. Per NPC each tick: 1) Threat scan (nearest opposing team within `threatRange`), 2) Posture evaluation (aggressive/defensive/retreating/idle based on HP and distance), 3) Attack execution (`meleeDirection` or projectile spawn), 4) Movement override (`movementMode` + `targetEntityId`). Requires `HasNPCBrain` trait.

**Source**: [systems/npc-brain.system.ts](../systems/npc-brain.system.ts)

### MeleeSystem
**Phase**: main | **Tick Rate**: 1

Processes melee attacks from `InputProvider.getPrimaryAction()`. Checks facing direction, range, cooldown. Applies damage via `HealthSystem.damage()`. NPCs with `HasMelee` attack adjacent player entities.

**Source**: [systems/melee.system.ts](../systems/melee.system.ts)

### PlayerWeaponSystem
**Phase**: main | **Tick Rate**: 1

Fires ranged weapons from `InputProvider.getSecondaryAction()` or twin-stick auto-fire. Tracks ammo, spawns projectiles via `ProjectileSystem`. Shotgun uses `fieldOfViewCone` for area damage. Falls back to melee when out of ammo.

Built-in weapons: `pistol` (ammo 12, cooldown 8), `machine-gun` (ammo 100, cooldown 2), `shotgun` (ammo 20, cooldown 16, cone-based).

**Source**: [systems/player-weapon.system.ts](../systems/player-weapon.system.ts)

### NPCMovementSystem
**Phase**: main | **Tick Rate**: 2

Six movement modes:
- `follow` -- Move toward a target entity
- `flee` -- Move away from a target entity
- `pursue` -- Chase the player (uses pathfinding)
- `wander` -- Random movement
- `patrol` -- Follow path nodes
- `guard` -- Stay within radius, pursue if player enters

**Source**: [systems/npc-movement.system.ts](../systems/npc-movement.system.ts)

### HealthSystem
**Phase**: post-commit | **Tick Rate**: 1

Intent-based health management. External systems call `healthSystem.damage()` or `healthSystem.heal()` to queue intents. Processes damage pipeline: vulnerability -> resistance -> armor -> shield -> HP. Manages alive -> dying -> dead state machine. Emits `DeathEvent` for ScoreSystem and ObjectiveSystem.

**Source**: [systems/health.system.ts](../systems/health.system.ts)

### FireSystem
**Phase**: main | **Tick Rate**: 1

Temperature-based fire spread. Entities with `temperature >= flamePoint` are burning. Each tick: detect ignitions, spread +50 temp to 4-directional neighbors, apply damage (5 HP every 2 ticks), clean up burned entities (spawn ash), decay cooling temperatures.

**Source**: [systems/fire.system.ts](../systems/fire.system.ts)

### ExplosionSystem
**Phase**: main | **Tick Rate**: 1

Triggered when explosive entities (`HasExplosion`) reach 0 HP. Applies area damage within `explosionRadius`. Ignites flammable entities. Spawns visual effect on EPHEMERALS layer.

**Source**: [systems/explosion.system.ts](../systems/explosion.system.ts)

### ProjectileSystem
**Phase**: main | **Tick Rate**: 1

Moves projectiles along Bresenham paths. Handles collision with entities (damage via HealthSystem), walls (bounce or destroy), and range limits. Supports piercing and bouncing projectiles.

**Source**: [systems/projectile.system.ts](../systems/projectile.system.ts)

### TurretSystem
**Phase**: main | **Tick Rate**: 1

Stationary shooters. Targeting modes: `nearest`, `player`, `fixed-direction`, `cardinal`. Weapon types: `projectile` (spawns via ProjectileSystem) or `ray` (instant hit with visual).

**Source**: [systems/turret.system.ts](../systems/turret.system.ts)

### FloorEffectSystem
**Phase**: main | **Tick Rate**: 1

Handles floor hazards and effects. Effect types: `damage` (lava, acid), `heal` (medbay), `slide` (ice), `slow` (mud). Supports continuous and on-entry trigger modes.

**Source**: [systems/floor-effect.system.ts](../systems/floor-effect.system.ts)

### SignalSystem
**Phase**: main | **Tick Rate**: 1

Queue-based signal propagation. Processes generators (oscillators, pressure switches, range sensors), propagates through conductors, handles inverters, and broadcasts via transceivers. Range sensors emit signals when the player is within a configurable range, with optional line-of-sight requirement.

**Source**: [systems/signal.system.ts](../systems/signal.system.ts)

### GateSystem
**Phase**: main | **Tick Rate**: 1

Opens/closes gates based on signal state. Open gates move from WALLS to FLOOR layer (non-blocking). Closed gates move back to WALLS layer (blocking).

**Source**: [systems/gate.system.ts](../systems/gate.system.ts)

### SpawningSystem
**Phase**: main | **Tick Rate**: 1

Manages entity spawning from spawner entities. Supports spawn limits, cooldowns, group coordination, player range detection, and sleep-wake zone activation. Wave mode (`waveMode: true`) spawns groups simultaneously with configurable `waveSize`, `totalWaves`, and `waveCooldown`. Contiguous spawners form groups that alternate spawn positions. Boundary recycling (`recycleAtBoundary: true`) removes spawned entities that reach the grid edge without counting them as kills.

**Source**: [systems/spawning.system.ts](../systems/spawning.system.ts)

### CollectionSystem
**Phase**: post-commit | **Tick Rate**: 1

Handles item pickup from overlaps. Adds collectibles to player inventory. Removes collected items from grid.

**Source**: [systems/collection.system.ts](../systems/collection.system.ts)

### TeleporterSystem
**Phase**: post-commit | **Tick Rate**: 1

Detects player overlap with teleporter entities. Uses `connectionKey` to find destination in another scene. Queues scene transition via `GameManager.movePlayerToScene()`.

**Source**: [systems/teleporter.system.ts](../systems/teleporter.system.ts)

### PowerupSystem
**Phase**: post-commit | **Tick Rate**: 1

Processes powerup collection from overlaps. Applies effects: health-pack (instant heal), health-potion (heal-over-time via `health-regen` buff), shield-pack (restore shield), speed-boost (timed), damage-boost (timed), invincibility (timed), ammo-pack (restore ammo), weapon-pickup (new weapon). Manages buff durations and expiration. Per-tick active buff effects (e.g., health-regen) are processed before expiration checks. Health gained from health-regen buffs is permanent and stays after the buff expires.

**Source**: [systems/powerup.system.ts](../systems/powerup.system.ts)

### RespawnSystem
**Phase**: post-commit | **Tick Rate**: 1

Detects player death (healthState === 'dead'). Finds last activated checkpoint. Respawns player at checkpoint (may be cross-scene). Decrements lives. Activates checkpoints when player overlaps.

**Source**: [systems/respawn.system.ts](../systems/respawn.system.ts)

### ScoreSystem
**Phase**: post-commit | **Tick Rate**: 1

Awards points from two sources: entity kills (reads `DeathEvent` from HealthSystem, uses `scoreValue`) and coin collection (detects player-coin overlaps).

**Source**: [systems/score.system.ts](../systems/score.system.ts)

### ObjectiveSystem
**Phase**: post-commit | **Tick Rate**: 1

Tracks four objective types: `collect-flag` (collect all flags with matching objectiveId), `kill-all` (eliminate all enemies in scene), `reach-exit` (player reaches exit after prerequisites met), `wave-clear` (all wave spawner groups complete and enemies eliminated, with optional `scoreThreshold`). Emits scene and game completion events via callbacks.

**Source**: [systems/objective.system.ts](../systems/objective.system.ts)

### LiquidSystem
**Phase**: main | **Tick Rate**: 1

Volumetric liquid flow. Liquids (water) spread to adjacent cells based on depth differences. Obeys gravity and blocking.

**Source**: [systems/liquid.system.ts](../systems/liquid.system.ts)

### PoisonSystem
**Phase**: main | **Tick Rate**: 1

Density-based gas dispersion. Poison gas spreads from high to low density cells. Applies damage to entities within gas clouds.

**Source**: [systems/poison.system.ts](../systems/poison.system.ts)

### ChainReactionSystem
**Phase**: main | **Tick Rate**: 1

Deterministic chain reaction spreading. Chain links ignite adjacent chain links with configurable delay.

**Source**: [systems/chain-reaction.system.ts](../systems/chain-reaction.system.ts)

---

# VI. Visual and Automated Tests

## Dual Execution Model

Every visual test runs in **two environments**:

1. **Vitest (CI)** -- Headless. Assertions throw on failure. Standard test runner.
2. **Visual Runner** -- Browser-based. Shows animated grid with entity rendering and assertion results.

The `visual()` helper registers tests for both environments automatically.

---

## Writing Visual Tests

Tests follow the **Arrange-Act-Assert (AAA)** pattern:

```typescript
import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';

visual('player moves right', {
  arrange: ({ spatial }) => {
    spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, healthState: 'alive',
    });
    spatial.commit();
  },
  act: ({ spatial }) => {
    spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
    spatial.commit();
    spatial.pause(); // Creates visual frame
  },
  assert: ({ spatial, expect }) => {
    expect('Player moved to (6,5)', () => {
      const id = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
      if (!id) throw new Error('Player not found at (6,5)');
    });
  },
});
```

### VisualTestContext

```typescript
interface VisualTestContext {
  grid: LinkedGrid;         // The grid instance
  spatial: SpatialSystem;   // Spatial operations
  store: SparseEntityStore; // Entity data store
  expect: (desc: string, fn: () => void) => void;  // Assertion helper
  data: Record<string, any>;  // Shared state between phases
  game?: GameManager;       // For multi-scene tests
  scene?: Scene;            // For scene-specific tests
}
```

### Multi-Scene Tests

```typescript
visual('player teleports between scenes', {
  arrange: ({ data }) => {
    const game = new GameManager();
    game.sceneManager.createScene('scene1', 10, 10);
    game.sceneManager.createScene('scene2', 10, 10);
    // ... spawn entities, set up connections
    data.game = game;
  },
  act: ({ data }) => {
    // ... trigger teleportation
  },
  assert: ({ data, expect }) => {
    expect('Player is in scene2', () => {
      // ... verify
    });
  },
});
```

**Source**: [test/visual-helpers.ts](../test/visual-helpers.ts)

---

## Test Timing and Tick Mechanics

### Key Rule: Reads are immediate, writes are deferred

```typescript
spatial.spawn('x', 5, 5, layer, {});
spatial.getEntityIdAt(5, 5, layer);  // undefined! (not committed)
spatial.commit();
spatial.getEntityIdAt(5, 5, layer);  // now defined
```

### Common Timing Patterns

```
Tick N:   spawn/move/remove  ->  Intent staged
Tick N:   commit()           ->  Changes applied
Tick N+1: Queries see new state
```

### Tick Advancement Helpers

```typescript
import { advanceUntilFireSpreads, advanceSpreadCycles } from '../helpers/test-helpers';

// Advance until fire spreads (based on FIRE_SPREAD_DELAY)
advanceUntilFireSpreads(gameLoop);

// Advance N fire spread cycles
advanceSpreadCycles(gameLoop, 3);
```

### Visual Pauses

`spatial.pause()` creates a visualization frame without advancing game logic. Use between ticks for animation:

```typescript
for (let i = 0; i < 5; i++) {
  gameLoop.tick();
  spatial.pause(); // Capture frame for visual runner
}
```

**Source**: [specs/visual-test-timing-guide.md](../../../specs/visual-test-timing-guide.md), [helpers/test-helpers.ts](../helpers/test-helpers.ts)

---

## Test Fixtures and Helpers

### TestInputProvider

Programmatic input control for tests:

```typescript
import { TestInputProvider } from '../test/test-input-provider';

const input = new TestInputProvider();
input.setMoveDirection(Direction.RIGHT);
runtime.tick();
input.reset(); // Clear all input

input.setAimDirection(Direction.UP);
input.setPrimaryAction(true); // Melee attack
runtime.tick();
```

### createRuntimeWithSystems

Quick runtime setup for tests:

```typescript
import { createRuntimeWithSystems } from '../test/test-helpers';

const { runtime, input } = createRuntimeWithSystems(config, ['HealthSystem', 'MeleeSystem']);
```

### TestSpatialFixture

Direct entity placement for unit tests:

```typescript
import { TestSpatialFixture } from '../test/test-fixtures';

const fixture = new TestSpatialFixture(20, 20);
fixture.placeEntity('wall', 5, 5, GameLayers.WALLS, { color: '#666' });
```

**Source**: [test/test-input-provider.ts](../test/test-input-provider.ts), [test/test-helpers.ts](../test/test-helpers.ts), [test/test-fixtures.ts](../test/test-fixtures.ts)

---

# VII. How-tos

## Add a New Entity Type

1. **Define the type** in a `[name].entity.ts` file under `entities/`:

```typescript
// entities/trap.entity.ts
import type { BaseEntityData } from './base.entity';
import type { HasHealth } from '../traits/health.trait';

export type TrapData = BaseEntityData & {
  type: 'trap';
  triggerRadius: number;
  trapDamage: number;
  armed: boolean;
} & HasHealth;
```

2. **Add to the union** in `entities/entity.types.ts`:

```typescript
export type EntityData = PlayerData | EnemyData | ... | TrapData;
```

3. **Add a type guard** in `traits/trait-guards.ts`:

```typescript
export function isTrap(e: unknown): e is TrapData {
  return (e as any)?.type === 'trap';
}
```

4. **Add a spawn helper** in `entities/spawn-helpers.ts`:

```typescript
export function spawnTrap(spatial: SpatialSystem, x: number, y: number, data?: Partial<TrapData>) {
  return spatial.spawn('trap', x, y, GameLayers.COLLECTIBLES, {
    triggerRadius: 2, trapDamage: 30, armed: true,
    hp: 10, maxHp: 10, healthState: 'alive',
    ...data,
  });
}
```

---

## Add a New System

1. **Create** `systems/[name].system.ts`:

```typescript
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';

export class TrapSystem extends BaseReactiveSystem {
  readonly executionPhase = 'main' as const;

  update({ spatial, overlaps }: GameContext) {
    for (const { entityIds, position } of overlaps) {
      // Find armed traps overlapping with actors
      const trap = entityIds.find(id => {
        const d = spatial.getEntityData(id);
        return d?.type === 'trap' && d.armed;
      });
      if (!trap) continue;

      // Apply effect...
    }
  }

  public override resetState(): void {
    super.resetState();
    // Clear any internal state
  }

  public override getDebugState() {
    return { ...super.getDebugState() };
  }
}
```

2. **Register** in `core/system-registry.ts`
3. **Add config** in `config/systems.config.ts`
4. **Write tests** following AAA pattern

---

## Handle Floor Hazards

Use `FloorEffectSystem` by placing entities with `HasFloorEffect`:

```json
{
  "type": "lava",
  "x": 5, "y": 5, "layer": 1,
  "data": {
    "effectType": "damage",
    "effectDamage": 10,
    "effectCadence": 3,
    "color": "#ff4400"
  }
}
```

Effect types: `damage`, `heal`, `slide`, `slow`.

---

## Implement Scene Transitions

Use teleporters with matching `connectionKey`:

```json
// Scene 1
{
  "type": "teleporter",
  "x": 9, "y": 5, "layer": 1,
  "data": { "connectionKey": "portal-A", "color": "#00ff00" }
}

// Scene 2
{
  "type": "teleporter",
  "x": 0, "y": 5, "layer": 1,
  "data": { "connectionKey": "portal-A", "color": "#00ff00" }
}
```

The `TeleporterSystem` detects player overlap with a teleporter, finds the matching endpoint via `GameState.connections`, and queues a scene transition via `GameManager.movePlayerToScene()`. Transitions execute at tick boundaries.

---

## Set Up Objectives and Scoring

Define objectives at the game config level:

```json
{
  "objectives": [
    { "id": "collect-flags", "type": "collect-flag", "sceneId": "arena", "targetId": "red-flag" },
    { "id": "kill-all", "type": "kill-all", "sceneId": "arena" },
    { "id": "reach-exit", "type": "reach-exit", "sceneId": "arena" }
  ]
}
```

Place corresponding entities in the scene:

```json
{ "type": "flag", "x": 3, "y": 3, "layer": 4, "data": { "objectiveId": "red-flag", "collectible": true } },
{ "type": "exit", "x": 14, "y": 14, "layer": 4, "data": {} },
{ "type": "coin", "x": 7, "y": 3, "layer": 4, "data": { "scoreValue": 10, "collectible": true } }
```

- `collect-flag`: Completes when all flags with matching `objectiveId` are collected
- `kill-all`: Completes when all enemies in the scene are dead
- `reach-exit`: Completes when player reaches exit AND all prerequisite objectives are done
- `wave-clear`: Completes when all wave spawner groups are done AND all spawned enemies are dead (optional `scoreThreshold`)

Enemies with `scoreValue` award points on kill. Coins award points on collection.

---

## Use NPC Personas

Spawn NPCs with preset stats using persona names:

```typescript
import { spawnNPC } from '@spartan';

// Tier 1: grunt (hp: 30, dmg: 5, speed: 3)
spawnNPC(spatial, 'grunt', 5, 5);

// Tier 2: soldier (hp: 60, armor: 2, dmg: 10, speed: 2)
spawnNPC(spatial, 'soldier', 10, 5, { movementMode: 'patrol' });

// Tier 3: elite (hp: 100, armor: 5, hardness: 3, dmg: 15)
spawnNPC(spatial, 'elite', 15, 5, { guardRadius: 3 });

// Tier 4: boss (hp: 200, armor: 10, shield: 50, dmg: 25)
spawnNPC(spatial, 'boss', 7, 10);
```

In JSON:

```json
{
  "type": "enemy", "x": 5, "y": 5, "layer": 6,
  "data": {
    "hp": 30, "maxHp": 30, "damage": 5, "healthState": "alive",
    "team": "enemy", "scoreValue": 10, "speed": 3,
    "movementMode": "pursue", "color": "#ff4444"
  }
}
```

---

## Implement Push Puzzles

Entities with `HasPushable` can be pushed by entities with `HasPusher`:

```json
{
  "type": "wall", "x": 5, "y": 5, "layer": 5,
  "data": { "pushable": true, "color": "#886644" }
}
```

Give the player push ability:

```json
{
  "type": "player", "x": 3, "y": 5, "layer": 6,
  "data": { "pushStrength": 1, "..." }
}
```

The `PushSystem` detects when a pusher moves into a pushable entity and chains the push. Multiple pushable entities can be pushed in sequence.

For signal-integrated puzzles, pushable entities on pressure switches activate signals:

```json
{ "type": "pressure-switch", "x": 7, "y": 5, "layer": 1, "data": { "signalChannel": "A" } },
{ "type": "gate", "x": 9, "y": 5, "layer": 5, "data": { "signalChannel": "A", "isOpen": false } }
```

Push the block onto the pressure switch to open the gate.

---

## Quick API Reference

### SpatialSystem (most-used methods)

| Method | Returns | Description |
| :--- | :--- | :--- |
| `spawn(type, x, y, layer, data?)` | `number` | Stage entity spawn, returns ID |
| `move(entityId, x, y)` | `void` | Stage entity movement |
| `remove(entityId)` | `void` | Stage entity removal |
| `commit()` | `void` | Execute all staged operations |
| `getEntityData(id)` | `EntityData?` | Get entity metadata |
| `getEntityPosition(id)` | `{x,y,layer}?` | Get entity position |
| `getEntityIdAt(x, y, layer)` | `number?` | Get entity at cell+layer |
| `getEntityIdsInCell(x, y)` | `number[]` | All entities at cell |
| `getEntityIdsInRadius(x, y, r)` | `number[]` | Entities within radius |
| `isAlive(id)` | `boolean` | Not pending removal? |
| `isBlocked(cell)` | `boolean` | Cell has blocking entity? |
| `getPendingOps()` | `PendingOperation[]` | Inspect staged intents |
| `getAllPositions()` | `Iterator` | All tracked entity positions |

### GameRuntime

| Method | Description |
| :--- | :--- |
| `GameRuntime.fromConfig(config, input?)` | Create from JSON config |
| `runtime.start()` | Begin real-time game loop |
| `runtime.stop()` | Pause game loop |
| `runtime.tick()` | Execute one tick manually |
| `runtime.save()` | Serialize game state |
| `runtime.restart()` | Reset to initial state |
| `runtime.spatial` | Active scene's SpatialSystem |
| `runtime.game` | GameManager (state, scenes) |

---

**Version**: Phase 3.5
**Last Updated**: 2026-02-06
