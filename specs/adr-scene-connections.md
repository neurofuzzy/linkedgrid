# ADR: Implement Scene Connection Registry for Color-Coded Portals

## Status
Proposed

## Context

### Current Architecture
LinkedGrid **already has** infrastructure for cross-scene connections:
- `GameState` has `addConnection()`, `getConnections()`, `removeConnection()` methods ✅
- `GameState.connections` is a `Map<string, Array<{sceneId, x, y, layer}>>` ✅
- Teleporters currently use direct `destination` objects in JSON configs
- **The connection registry exists but is never populated during initialization** ❌

### Use Case: Visual Level Editor
We're building a drag-and-drop level editor where creators can:
1. Place teleporters in multiple scenes
2. Assign color keys to teleporters (e.g., "red", "blue", "green")
3. Have teleporters automatically connect to their matching-color partner
4. Support many-to-many connections (multiple "red" portals across scenes)

### Current Problem
**Bug:** When transitioning between scenes via teleporter, the player respawns at their initial spawn position instead of at the destination teleporter's location.

**Root Cause Analysis:**
1. ✅ `GameState.connections` infrastructure exists
2. ✅ `GameManager.executePendingTransition()` correctly handles transitions
3. ❌ **No initialization phase populates `GameState.connections`**
4. ❌ **JSON configs use hardcoded `destination` objects instead of `connectionKey`**
5. ❌ **TeleporterSystem doesn't check the connection registry**
6. ❌ **GameRuntime has no loading/initialization logic** - it only creates empty scenes

Looking at `GameRuntime.new()`:
```typescript
static new(config: GameRuntimeConfig): GameRuntime {
    const game = new GameManager();
    
    // Only creates EMPTY scenes - no entity spawning!
    game.sceneManager.createScene(
      config.initialScene.id,
      config.initialScene.width,
      config.initialScene.height,
      config.initialScene.metadata
    );
    
    return new GameRuntime(game, config.systems, config.tickRate || 10, config);
}
```

**The loader logic is entirely missing from the package.** All entity spawning and connection registration happens in `dev/scene-loader.ts`, which isn't part of `@linkedgrid/spartan`.

## Problem Statement

We need to:
1. **Move scene loading into the package** - `GameRuntime.fromConfig()` should load full game configs
2. **Populate `GameState.connections`** during initialization, before first tick
3. **Support color-coded portals** via `connectionKey` (while maintaining backward compatibility)
4. **Update TeleporterSystem** to use the connection registry
5. **Keep platform-specific code separate** - DOM/input handling stays in dev harness

## Decision

### 1. Add the HasSceneConnection Trait

**NEW FILE:** `packages/spartan/traits/scene-connection.trait.ts`

```typescript
/**
 * HasSceneConnection - Cross-scene portal/connection trait
 * 
 * Entities with this trait are registered in GameState.connections
 * during initialization, enabling color-coded multi-scene connections.
 */
export interface HasSceneConnection {
    /**
     * Connection key for cross-scene portals.
     * Entities with matching keys are connected endpoints.
     * Example: "red", "blue", "green", "portal-alpha"
     */
    connectionKey: string;
}
```

**UPDATE:** `packages/spartan/traits/trait-guards.ts`

```typescript
export function hasSceneConnection(
    entity: EntityData
): entity is EntityData & HasSceneConnection {
    return typeof (entity as any).connectionKey === 'string';
}
```

### 2. GameState Already Has the Right Methods ✅

**No changes needed** - the existing implementation is perfect:

```typescript
// EXISTING CODE IN game-state.ts - already correct!
addConnection(
    key: string,
    sceneId: string,
    x: number,
    y: number,
    layer: number
): void {
    const existing = this.connections.get(key) || [];
    existing.push({ sceneId, x, y, layer });
    this.connections.set(key, existing);
}

getConnections(
    key: string
): Array<{ sceneId: string; x: number; y: number; layer: number }> {
    return this.connections.get(key) || [];
}
```

**Optional Enhancement:** Add `getAllConnections()` for debugging:

```typescript
/**
 * Get all connection keys and their endpoints.
 * Used for debugging and editor visualization.
 */
getAllConnections(): Map<string, Array<{ sceneId: string; x: number; y: number; layer: number }>> {
    return new Map(this.connections);
}
```

### 3. Add GameRuntime.fromConfig() - The Critical Missing Piece

**UPDATE:** `packages/spartan/core/game-runtime.ts`

Add new interface for full game configuration:

```typescript
/**
 * Complete game configuration with scenes, entities, and systems.
 * Used by GameRuntime.fromConfig() to load JSON-based games.
 */
export interface GameConfig {
    description?: string;
    initialScene: string;
    systems: string[]; // System names, will be instantiated
    tickRate?: number;
    input?: {
        type: 'keyboard' | 'headless' | 'none';
        options?: Record<string, unknown>;
    };
    scenes: Array<{
        id: string;
        name?: string;
        width: number;
        height: number;
        metadata?: Record<string, unknown>;
        entities: Array<{
            type: string;
            x: number;
            y: number;
            layer: number;
            data?: Record<string, unknown>;
        }>;
    }>;
}
```

Add the static factory method:

```typescript
/**
 * Create a game from complete JSON configuration.
 * 
 * Three-phase initialization:
 * 1. STRUCTURE - Create all scenes (empty grids)
 * 2. HYDRATION - Spawn all entities across all scenes
 * 3. GLOBAL INDEXING - Register scene connections (teleporters, etc.)
 * 
 * This ensures GameState.connections is populated before first tick.
 * 
 * @param config - Complete game configuration
 * @param systemFactory - Function to create systems by name
 * @param inputProvider - Optional input provider (platform-specific)
 * @returns GameRuntime ready to start
 * 
 * @example
 * ```typescript
 * const config = JSON.parse(fs.readFileSync('level.json'));
 * const runtime = GameRuntime.fromConfig(
 *     config,
 *     createSystemByName,  // Your system factory
 *     keyboardInput        // Platform-specific input
 * );
 * runtime.start();
 * ```
 */
static fromConfig(
    config: GameConfig,
    systemFactory: (name: string, game: GameManager) => GameSystem | null,
    inputProvider?: InputProvider
): GameRuntime {
    const game = new GameManager();

    // === PHASE 1: STRUCTURE ===
    // Create all scenes (empty grids)
    console.log('[GameRuntime.fromConfig] Phase 1: Creating scenes...');
    for (const sceneDef of config.scenes) {
        game.sceneManager.createScene(
            sceneDef.id,
            sceneDef.width,
            sceneDef.height,
            sceneDef.metadata
        );
        console.log(`  Created scene "${sceneDef.id}" (${sceneDef.width}x${sceneDef.height})`);
    }

    // === PHASE 2: HYDRATION ===
    // Spawn all entities across all scenes
    console.log('[GameRuntime.fromConfig] Phase 2: Spawning entities...');
    for (const sceneDef of config.scenes) {
        const scene = game.sceneManager.getScene(sceneDef.id);
        if (!scene) {
            throw new Error(`Scene "${sceneDef.id}" not found after creation`);
        }

        for (const entityDef of sceneDef.entities) {
            const entityData = entityDef.data || {};
            
            // CRITICAL: Set sceneId on entity data
            entityData.sceneId = sceneDef.id;

            const entityId = scene.spatial.spawn(
                entityDef.type,
                entityDef.x,
                entityDef.y,
                entityDef.layer,
                entityData
            );

            console.log(
                `  Spawned ${entityDef.type}#${entityId} at ` +
                `${sceneDef.id}(${entityDef.x},${entityDef.y}) layer=${entityDef.layer}`
            );
        }

        // Commit all spawns for this scene
        scene.spatial.commit();
    }

    // === PHASE 3: GLOBAL INDEXING ===
    // Register scene connections (teleporters, linked switches, etc.)
    console.log('[GameRuntime.fromConfig] Phase 3: Registering connections...');
    
    let connectionCount = 0;
    for (const sceneDef of config.scenes) {
        const scene = game.sceneManager.getScene(sceneDef.id);
        if (!scene) continue;

        for (const entityDef of sceneDef.entities) {
            // Find the spawned entity
            const entityId = scene.spatial.getEntityIdAt(
                entityDef.x,
                entityDef.y,
                entityDef.layer
            );
            
            if (entityId === null) continue;
            
            const entityData = scene.spatial.getEntityData(entityId);
            if (!entityData) continue;

            // Check for scene connection trait
            if (hasSceneConnection(entityData)) {
                game.gameState.addConnection(
                    entityData.connectionKey,
                    sceneDef.id,
                    entityDef.x,
                    entityDef.y,
                    entityDef.layer
                );
                
                console.log(
                    `  Registered connection: key="${entityData.connectionKey}" ` +
                    `entity=${entityDef.type}#${entityId} at ` +
                    `${sceneDef.id}(${entityDef.x},${entityDef.y})`
                );
                
                connectionCount++;
            }
        }
    }

    // Log connection summary
    if (connectionCount > 0) {
        console.log(`[GameRuntime.fromConfig] Connection Registry Summary:`);
        const allConnections = game.gameState.connections;
        for (const [key, endpoints] of allConnections) {
            console.log(`  "${key}": ${endpoints.length} endpoint(s)`);
            for (const ep of endpoints) {
                console.log(`    - ${ep.sceneId}(${ep.x},${ep.y}) layer=${ep.layer}`);
            }
        }
        
        // Validation: warn about orphaned connections
        for (const [key, endpoints] of allConnections) {
            if (endpoints.length === 1) {
                console.warn(
                    `⚠️  Connection "${key}" has only 1 endpoint - ` +
                    `portal at ${endpoints[0].sceneId}(${endpoints[0].x},${endpoints[0].y}) has no destination!`
                );
            }
        }
    } else {
        console.log('[GameRuntime.fromConfig] No scene connections registered');
    }

    // === PHASE 4: SYSTEM INITIALIZATION ===
    console.log('[GameRuntime.fromConfig] Phase 4: Initializing systems...');
    const systems: GameSystem[] = [];

    // Input system (platform-specific, optional)
    if (inputProvider) {
        systems.push(new PlayerInputSystem(
            game.gameState.playerEntityId,
            inputProvider
        ));
        console.log('  Registered PlayerInputSystem');
    }

    // Game systems from config
    for (const systemName of config.systems) {
        const system = systemFactory(systemName, game);
        if (system) {
            systems.push(system);
            console.log(`  Registered ${systemName}`);
        } else {
            console.warn(`  Failed to create system: ${systemName}`);
        }
    }

    // Set initial/active scene
    if (!game.sceneManager.setActiveScene(config.initialScene)) {
        throw new Error(`Initial scene "${config.initialScene}" not found`);
    }
    console.log(`[GameRuntime.fromConfig] Set active scene: ${config.initialScene}`);

    // Create minimal config for GameRuntime constructor
    const runtimeConfig: GameRuntimeConfig = {
        initialScene: {
            id: config.initialScene,
            width: 10, // Unused, scenes already created
            height: 10,
        },
        systems,
        tickRate: config.tickRate || 10,
    };

    console.log('[GameRuntime.fromConfig] ✅ Initialization complete');
    return new GameRuntime(game, systems, config.tickRate || 10, runtimeConfig);
}
```

### 4. Update JSON Config Format

**NEW FORMAT: Color-coded portals (preferred)**
```json
{
    "type": "teleporter",
    "x": 18,
    "y": 18,
    "layer": 1,
    "data": {
        "connectionKey": "red",
        "color": "#ff0000"
    }
}
```

**OLD FORMAT: Direct destinations (deprecated but supported)**
```json
{
    "type": "teleporter", 
    "x": 18,
    "y": 18,
    "layer": 1,
    "data": {
        "destination": {
            "sceneId": "room2",
            "x": 2,
            "y": 10,
            "layer": 6
        },
        "color": "#ff0000"
    }
}
```

### 5. Update TeleporterSystem

**UPDATE:** `packages/spartan/systems/teleporter-system.ts`

```typescript
export class TeleporterSystem extends BaseReactiveSystem {
    update(context: GameContext): void {
        const { overlaps, gameManager } = context;

        for (const overlap of overlaps) {
            const playerId = gameManager.gameState.playerEntityId;
            
            if (!overlap.entityIds.includes(playerId)) {
                continue; // Not the player
            }

            // Find the teleporter in the overlap
            const teleporterId = overlap.entityIds.find(id => {
                const data = context.spatial.getEntityData(id);
                return isTeleporter(data);
            });

            if (!teleporterId) continue;

            const teleporterData = context.spatial.getEntityData(teleporterId);
            const currentScene = gameManager.sceneManager.getActiveScene();
            const playerPos = context.spatial.getPosition(playerId);
            
            if (!currentScene || !playerPos) continue;
            
            // === PRIORITY 1: Use connection key (new format) ===
            if (hasSceneConnection(teleporterData)) {
                const endpoints = gameManager.gameState.getConnections(
                    teleporterData.connectionKey
                );

                // Find destination (first endpoint that's not current location)
                const destination = endpoints.find(ep => 
                    ep.sceneId !== currentScene.id ||
                    ep.x !== playerPos.x ||
                    ep.y !== playerPos.y
                );

                if (destination) {
                    console.log(
                        `[TeleporterSystem] Using connection key "${teleporterData.connectionKey}" ` +
                        `to ${destination.sceneId}(${destination.x},${destination.y})`
                    );
                    
                    gameManager.movePlayerToScene(
                        destination.sceneId,
                        destination.x,
                        destination.y,
                        destination.layer
                    );
                    return;
                }
                
                console.warn(
                    `[TeleporterSystem] No valid destination for connection key "${teleporterData.connectionKey}"`
                );
            }
            
            // === PRIORITY 2: Fall back to direct destination (old format) ===
            if (hasTeleportTarget(teleporterData)) {
                const dest = teleporterData.destination;
                
                console.log(
                    `[TeleporterSystem] Using direct destination to ` +
                    `${dest.sceneId}(${dest.x},${dest.y})`
                );
                
                gameManager.movePlayerToScene(
                    dest.sceneId,
                    dest.x,
                    dest.y,
                    dest.layer
                );
                return;
            }

            console.warn(
                `[TeleporterSystem] Teleporter has no connectionKey or destination`,
                teleporterData
            );
        }
    }
}
```

### 6. Update Entity Type Definitions

**UPDATE:** `packages/spartan/entities/teleporter.entity.ts`

```typescript
import { HasSceneConnection } from '../traits/scene-connection.trait';
import { HasTeleportTarget } from '../traits/navigation.trait';
import { HasColor } from '../traits/visual.trait';
import { BaseEntityData } from './base.entity';

// New format: Connection key (preferred)
export type TeleporterData = BaseEntityData & HasSceneConnection & HasColor;

// Old format: Direct destination (deprecated, backward compatibility)
export type LegacyTeleporterData = BaseEntityData & HasTeleportTarget & HasColor;

// Union type for backward compatibility
export type AnyTeleporterData = TeleporterData | LegacyTeleporterData;
```

### 7. Update dev/scene-loader.ts - Platform Adapter Pattern

**REFACTOR:** `dev/scene-loader.ts`

```typescript
import { GameRuntime, type GameConfig } from '@linkedgrid/spartan';
import { createSystemByName } from './system-factory'; // Your system factory
import { KeyboardInputProvider } from './input/keyboard-input-provider';
import { HeadlessInputProvider } from './input/headless-input-provider';

/**
 * Platform adapter for web-based playground.
 * 
 * Responsibilities:
 * - Create platform-specific input providers (DOM-dependent)
 * - Delegate core game loading to GameRuntime.fromConfig()
 * - Setup rendering loop (if separate from game loop)
 * 
 * This keeps @linkedgrid/spartan platform-agnostic while
 * handling web-specific concerns in the dev harness.
 */
export function loadGameForWeb(config: GameConfig): GameRuntime {
    console.log('[SceneLoader] Loading game for web platform...');
    
    // Create platform-specific input provider
    let inputProvider;
    
    if (config.input?.type === 'keyboard') {
        inputProvider = new KeyboardInputProvider(
            config.input.options?.directionMode || 'instant'
        );
        console.log('[SceneLoader] Created KeyboardInputProvider');
    } else if (config.input?.type === 'headless') {
        inputProvider = new HeadlessInputProvider();
        console.log('[SceneLoader] Created HeadlessInputProvider');
    }
    
    // Delegate to package-native loader
    const runtime = GameRuntime.fromConfig(
        config,
        createSystemByName, // System factory function
        inputProvider
    );

    // Store input provider for cleanup
    if (inputProvider && typeof (inputProvider as any).cleanup === 'function') {
        runtime.inputCleanup = () => (inputProvider as any).cleanup();
    }
    
    console.log('[SceneLoader] ✅ Game loaded successfully for web');
    return runtime;
}

/**
 * System factory - maps system names to instances.
 * This is application-specific, not part of the core package.
 */
function createSystemByName(
    name: string,
    game: GameManager
): GameSystem | null {
    switch (name) {
        case 'TeleporterSystem':
            return new TeleporterSystem();
        case 'DoorSystem':
            return new DoorSystem();
        case 'CollectionSystem':
            return new CollectionSystem();
        case 'SpawningSystem':
            return new SpawningSystem();
        case 'HealthSystem':
            return new HealthSystem();
        case 'NPCMovementSystem':
            return new NPCMovementSystem();
        case 'ProjectileSystem':
            return new ProjectileSystem();
        case 'PushSystem':
            return new PushSystem();
        case 'SignalSystem':
            return new SignalSystem();
        case 'GateSystem':
            return new GateSystem();
        // Add more systems as needed
        default:
            console.warn(`Unknown system: ${name}`);
            return null;
    }
}
```

## Migration Path

### For spawners-and-signals.json

**Current format (hardcoded destinations):**
```json
{
    "type": "teleporter",
    "x": 18,
    "y": 18,
    "layer": 1,
    "data": {
        "destination": {
            "sceneId": "room2",
            "x": 2,
            "y": 10,
            "layer": 6
        }
    }
}
```

**New format (connection keys):**
```json
{
    "type": "teleporter",
    "x": 18,
    "y": 18,
    "layer": 1,
    "data": {
        "connectionKey": "portal-room1-to-room2",
        "color": "#ff0000"
    }
}
```

And in room2:
```json
{
    "type": "teleporter",
    "x": 2,
    "y": 10,
    "layer": 1,
    "data": {
        "connectionKey": "portal-room1-to-room2",
        "color": "#ff0000"
    }
}
```

### Migration Script (Optional)

```typescript
function migrateToConnectionKeys(config: GameConfig): GameConfig {
    const colorMap = new Map<string, string>();
    let colorIndex = 0;
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

    // First pass: build destination → color mapping
    for (const scene of config.scenes) {
        for (const entity of scene.entities) {
            if (entity.type === 'teleporter' && entity.data?.destination) {
                const dest = entity.data.destination;
                const hash = `${dest.sceneId}-${dest.x}-${dest.y}`;
                
                if (!colorMap.has(hash)) {
                    const color = colors[colorIndex % colors.length];
                    colorMap.set(hash, `portal-${color}-${colorIndex}`);
                    colorIndex++;
                }
            }
        }
    }

    // Second pass: replace destinations with connection keys
    for (const scene of config.scenes) {
        for (const entity of scene.entities) {
            if (entity.type === 'teleporter' && entity.data?.destination) {
                const dest = entity.data.destination;
                const hash = `${dest.sceneId}-${dest.x}-${dest.y}`;
                const connectionKey = colorMap.get(hash)!;
                
                delete entity.data.destination;
                entity.data.connectionKey = connectionKey;
            }
        }
    }
    
    return config;
}
```

## Consequences

### Positive
1. ✅ **Package completeness** - Loading logic now in `@linkedgrid/spartan`, not dev harness
2. ✅ **Editor-friendly** - Creators assign colors, connections are automatic
3. ✅ **Reliable** - Connections populated before first tick (no more race conditions)
4. ✅ **Debuggable** - Console logs show connection registration
5. ✅ **Backward compatible** - Old `destination` format still works
6. ✅ **Validation** - Warns about orphaned portals (single endpoints)
7. ✅ **Platform-agnostic** - Core package has no DOM dependencies

### Negative
1. ⚠️ **Breaking API change** - GameRuntime.fromConfig() is new, requires system factory
2. ⚠️ **More verbose config** - Both portals need `connectionKey` instead of one having `destination`
3. ⚠️ **Portal selection** - Multiple destinations for one key uses "first non-current" logic

### Edge Cases Handled
- ✅ **Orphaned portals** - Validation warning if connection has only 1 endpoint
- ✅ **Same-location portals** - Filters out current location when selecting destination
- ✅ **Missing destinations** - Falls back to direct destination, then warns
- ✅ **Empty scenes** - Phase 1 creates grids before spawning entities

## Verification

### Unit Tests

```typescript
describe('GameRuntime.fromConfig', () => {
    it('should create all scenes from config', () => {
        const config: GameConfig = {
            initialScene: 'room1',
            systems: [],
            scenes: [
                { id: 'room1', width: 20, height: 20, entities: [] },
                { id: 'room2', width: 30, height: 30, entities: [] }
            ]
        };

        const runtime = GameRuntime.fromConfig(config, () => null);

        expect(runtime.game.sceneManager.getScene('room1')).toBeDefined();
        expect(runtime.game.sceneManager.getScene('room2')).toBeDefined();
        expect(runtime.game.sceneManager.activeId).toBe('room1');
    });

    it('should register scene connections', () => {
        const config: GameConfig = {
            initialScene: 'room1',
            systems: [],
            scenes: [
                { 
                    id: 'room1', 
                    width: 20, 
                    height: 20, 
                    entities: [
                        { 
                            type: 'teleporter', 
                            x: 5, 
                            y: 5, 
                            layer: 1, 
                            data: { connectionKey: 'red' }
                        }
                    ]
                },
                { 
                    id: 'room2', 
                    width: 20, 
                    height: 20, 
                    entities: [
                        { 
                            type: 'teleporter', 
                            x: 10, 
                            y: 10, 
                            layer: 1,
                            data: { connectionKey: 'red' }
                        }
                    ]
                }
            ]
        };

        const runtime = GameRuntime.fromConfig(config, () => null);
        const connections = runtime.game.gameState.getConnections('red');

        expect(connections).toHaveLength(2);
        expect(connections[0]).toMatchObject({ sceneId: 'room1', x: 5, y: 5 });
        expect(connections[1]).toMatchObject({ sceneId: 'room2', x: 10, y: 10 });
    });

    it('should warn about orphaned connections', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn');
        
        const config: GameConfig = {
            initialScene: 'room1',
            systems: [],
            scenes: [
                { 
                    id: 'room1', 
                    width: 20, 
                    height: 20, 
                    entities: [
                        { 
                            type: 'teleporter', 
                            x: 5, 
                            y: 5, 
                            layer: 1, 
                            data: { connectionKey: 'blue' }
                        }
                    ]
                }
            ]
        };

        GameRuntime.fromConfig(config, () => null);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Connection "blue" has only 1 endpoint')
        );
    });
});
```

### Integration Tests

```typescript
describe('TeleporterSystem with connection keys', () => {
    it('should teleport player to matching portal', () => {
        const config: GameConfig = {
            initialScene: 'room1',
            systems: ['TeleporterSystem'],
            scenes: [
                { 
                    id: 'room1', 
                    width: 20, 
                    height: 20, 
                    entities: [
                        { type: 'player', x: 4, y: 5, layer: 6, data: { hp: 100 } },
                        { type: 'teleporter', x: 5, y: 5, layer: 1, data: { connectionKey: 'red' } }
                    ]
                },
                { 
                    id: 'room2', 
                    width: 20, 
                    height: 20, 
                    entities: [
                        { type: 'teleporter', x: 10, y: 10, layer: 1, data: { connectionKey: 'red' } }
                    ]
                }
            ]
        };

        const runtime = GameRuntime.fromConfig(config, createSystemByName);
        
        // Set player ID
        const playerScene = runtime.game.sceneManager.getScene('room1')!;
        const playerId = playerScene.spatial.getEntityIdAt(4, 5, 6)!;
        runtime.game.gameState.playerEntityId = playerId;
        
        // Move player onto teleporter
        playerScene.spatial.move(4, 5, 5, 5, 6);
        playerScene.spatial.commit();
        
        // Execute tick (trigger teleporter)
        runtime.tick();
        
        // Verify player in room2
        const playerPos = runtime.game.getPlayerPosition();
        expect(playerPos?.sceneId).toBe('room2');
        expect(playerPos?.x).toBe(10);
        expect(playerPos?.y).toBe(10);
    });
});
```

### Visual Tests

```typescript
visual('color-coded portals', {
    arrange: ({ runtime }) => {
        const config = loadJSON('spawners-and-signals.json');
        // Config already has connectionKey instead of destination
        Object.assign(runtime, GameRuntime.fromConfig(config, createSystemByName));
    },
    act: ({ runtime }) => {
        // Move player onto red portal
        const scene = runtime.activeScene;
        scene.spatial.move(/* player to portal */);
        scene.spatial.commit();
        runtime.tick(); // Transition executes
    },
    assert: ({ runtime, expect }) => {
        expect('Player at red portal destination', () => {
            const pos = runtime.game.getPlayerPosition();
            if (pos?.sceneId !== 'room2' || pos.x !== 2 || pos.y !== 10) {
                throw new Error(`Expected room2(2,10), got ${pos?.sceneId}(${pos?.x},${pos?.y})`);
            }
        });
    }
});
```

### Manual Testing Checklist

- [ ] Convert spawners-and-signals.json to use `connectionKey`
- [ ] Load config with `GameRuntime.fromConfig()`
- [ ] Verify console shows "Registered connection" logs
- [ ] Teleport from room1 → room2, verify spawn at (2,10)
- [ ] Teleport back to room1, verify spawn at (18,18)
- [ ] Check no warnings about orphaned connections
- [ ] Test spawners still work in room1
- [ ] Test signal/push systems still work in room2

## Implementation Checklist

### Core Package Changes
- [ ] Create `traits/scene-connection.trait.ts`
- [ ] Add `hasSceneConnection()` to `trait-guards.ts`
- [ ] Add `getAllConnections()` to `GameState` (optional debugging helper)
- [ ] Add `GameConfig` interface to `game-runtime.ts`
- [ ] Implement `GameRuntime.fromConfig()` in `game-runtime.ts`
- [ ] Update `TeleporterSystem` to check connection key first
- [ ] Update `entities/teleporter.entity.ts` types

### Dev Harness Changes
- [ ] Refactor `dev/scene-loader.ts` to platform adapter
- [ ] Create `dev/system-factory.ts` for system instantiation
- [ ] Update demo JSON files to use `connectionKey`

### Testing
- [ ] Write unit tests for `GameRuntime.fromConfig()`
- [ ] Write unit tests for connection registration
- [ ] Write integration tests for teleportation
- [ ] Create visual test for multi-scene portals
- [ ] Test backward compatibility with `destination` format

### Documentation
- [ ] Update README with `GameRuntime.fromConfig()` example
- [ ] Document JSON config format (new connectionKey field)
- [ ] Add migration guide for existing configs
- [ ] Update DEVELOPER_CONTEXT.md with initialization phases

## Future Enhancements

### Portal Selection Strategies
```typescript
interface HasSceneConnection {
    connectionKey: string;
    selectionMode?: 'random' | 'nearest' | 'sequential' | 'specific';
    preferredDestination?: string; // Scene ID for 'specific' mode
}
```

### Bidirectional vs One-Way Portals
```typescript
interface HasSceneConnection {
    connectionKey: string;
    isOneWay?: boolean;
    destinationKey?: string; // For one-way portals
}
```

### Connection Groups
```typescript
// Entrance/exit pairs
connectionKey: "red:entrance"
connectionKey: "red:exit"
```

### Runtime Connection Management
```typescript
gameState.enableConnection('red');
gameState.disableConnection('blue');
gameState.setConnectionActive('green', false);
```

### Editor Visualization
- Draw connection lines between matching portals
- Show connection key labels on entities
- Highlight orphaned portals with warning icon
- Color-code connection visualization

## Questions & Decisions

**Q: What happens if multiple destinations exist for one connection key?**  
A: Use first non-current destination. Future: support `selectionMode` option.

**Q: Should connectionKey be required or optional on teleporters?**  
A: Optional. Fall back to `destination` for backward compatibility.

**Q: Can connections be modified at runtime?**  
A: Not in MVP. `GameState.connections` is built at load time. Future enhancement.

**Q: Should we validate connections (ensure pairs exist)?**  
A: Yes. Already implemented - warns if connection has only 1 endpoint.

**Q: Do we need InputProvider in GameRuntime.fromConfig()?**  
A: Yes, but it's optional. Platform adapters create input providers, core package accepts them as dependencies.

**Q: Where does the system factory come from?**  
A: Application-specific. Each app provides a factory function that maps system names to instances. This keeps the core package free of application-specific system knowledge.

## References

- `DEVELOPER_CONTEXT.md` - Multi-scene architecture
- `spawners-and-signals.json` - Current teleporter format
- `packages/spartan/core/game-state.ts` - Existing connection methods ✅
- `packages/spartan/core/game-manager.ts` - Scene transition logic ✅
- `packages/spartan/core/game-runtime.ts` - Needs fromConfig() ❌
- `packages/spartan/systems/teleporter-system.ts` - Needs connection key support ❌
- `dev/scene-loader.ts` - Should become platform adapter ❌

## Summary of Key Insights from Code Review

1. **GameState already has the right infrastructure** - No changes needed to core connection methods
2. **GameRuntime.new() only creates empty scenes** - This is why entities/connections aren't loaded
3. **GameManager.executePendingTransition() is solid** - Scene transitions work correctly when triggered
4. **The missing piece is initialization** - Need GameRuntime.fromConfig() to bridge JSON → runtime
5. **Platform separation is clean** - InputProvider pattern already supports platform adapters
6. **System factory pattern needed** - Config has system names, need app-specific instantiation logic

**The fix is surgical:** Add GameRuntime.fromConfig(), update TeleporterSystem, add the trait. Everything else already works.
