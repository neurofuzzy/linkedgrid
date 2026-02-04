# Migration Guide: Refactoring SceneLoader to Use GameRuntime.fromConfig()

## Overview

This guide shows how to refactor the existing `dev/scene-loader.ts` from a "do everything" loader into a lightweight platform adapter that delegates to `GameRuntime.fromConfig()`.

## Current Architecture Problems

### Problem 1: Entity Spawning Logic in Dev Harness
```typescript
// CURRENT: In dev/scene-loader.ts (lines 336-473)
private populateScene(runtime: GameRuntime, sceneDef: SceneDefinition): void {
    // 114 lines of spawning logic
    // Validation logic
    // Player tracking
    // All of this should be in the package!
}
```

### Problem 2: System Registry in Dev Harness
```typescript
// CURRENT: In dev/scene-loader.ts (lines 103-140)
const SYSTEM_REGISTRY: Record<string, SystemFactory> = {
    PushSystem: () => new PushSystem(),
    TeleporterSystem: (gameManager) => new TeleporterSystem(gameManager),
    // ... 17 more systems
    // This is application-specific and should stay here
};
```

### Problem 3: No Connection Registration
```typescript
// CURRENT: populateScene() spawns entities but never checks for HasSceneConnection
// Result: GameState.connections is never populated
// Bug: Teleporters don't work correctly across scenes
```

## Migration Steps

### Step 1: Add GameRuntime.fromConfig() to Package

**File:** `packages/spartan/core/game-runtime.ts`

Add the `GameConfig` interface and `fromConfig()` static method from the ADR.

**Key differences from current SceneLoader.load():**
1. **Platform-agnostic** - No DOM dependencies
2. **Connection registration** - Checks `hasSceneConnection()` trait
3. **Validation built-in** - Warns about orphaned connections
4. **System factory pattern** - Takes factory function as parameter

### Step 2: Move SYSTEM_REGISTRY to Separate File

**NEW FILE:** `dev/system-factory.ts`

```typescript
import { GameManager } from '../packages/spartan/core/game-manager';
import { TeleporterSystem } from '../packages/spartan/systems/teleporter.system';
import { CollectionSystem } from '../packages/spartan/systems/collection.system';
import { DoorSystem } from '../packages/spartan/systems/door.system';
import { FloorEffectSystem } from '../packages/spartan/systems/floor-effect.system';
import { ExplosionSystem } from '../packages/spartan/systems/explosion.system';
import { HealthSystem } from '../packages/spartan/systems/health.system';
import { PoisonSystem } from '../packages/spartan/systems/poison.system';
import { FireSystem } from '../packages/spartan/systems/fire.system';
import { LiquidSystem } from '../packages/spartan/systems/liquid.system';
import { ChainReactionSystem } from '../packages/spartan/systems/chain-reaction.system';
import { SignalSystem } from '../packages/spartan/systems/signal.system';
import { GateSystem } from '../packages/spartan/systems/gate.system';
import { NPCMovementSystem } from '../packages/spartan/systems/npc-movement.system';
import { ProjectileSystem } from '../packages/spartan/systems/projectile.system';
import { TurretSystem } from '../packages/spartan/systems/turret.system';
import { SpawningSystem } from '../packages/spartan/systems/spawning.system';
import { PushSystem } from '../packages/spartan/systems/push.system';
import type { GameSystem } from '../packages/spartan/core/types';

/**
 * System factory for web playground.
 * Maps system names to instances with dependency injection.
 * 
 * This is application-specific and should NOT be in the core package.
 */
export function createSystemByName(
  name: string,
  gameManager: GameManager
): GameSystem | null {
  // Track created systems for dependency injection
  const systemCache = new Map<string, GameSystem>();

  switch (name) {
    case 'PushSystem':
      return new PushSystem();

    case 'TeleporterSystem':
      return new TeleporterSystem(gameManager);

    case 'CollectionSystem':
      return new CollectionSystem(gameManager);

    case 'DoorSystem':
      return new DoorSystem(gameManager);

    case 'FloorEffectSystem':
      return new FloorEffectSystem(gameManager);

    case 'ExplosionSystem':
      return new ExplosionSystem();

    case 'HealthSystem':
      if (!systemCache.has('HealthSystem')) {
        systemCache.set('HealthSystem', new HealthSystem());
      }
      return systemCache.get('HealthSystem')!;

    case 'PoisonSystem':
      return new PoisonSystem(gameManager);

    case 'FireSystem':
      return new FireSystem();

    case 'LiquidSystem':
      return new LiquidSystem();

    case 'ChainReactionSystem':
      return new ChainReactionSystem();

    case 'SignalSystem':
      return new SignalSystem(gameManager);

    case 'GateSystem':
      return new GateSystem(gameManager);

    case 'NPCMovementSystem':
      return new NPCMovementSystem();

    case 'ProjectileSystem': {
      let healthSystem = systemCache.get('HealthSystem') as HealthSystem | undefined;
      if (!healthSystem) {
        healthSystem = new HealthSystem();
        systemCache.set('HealthSystem', healthSystem);
      }
      const projectileSystem = new ProjectileSystem(healthSystem);
      systemCache.set('ProjectileSystem', projectileSystem);
      return projectileSystem;
    }

    case 'TurretSystem': {
      let healthSystem = systemCache.get('HealthSystem') as HealthSystem | undefined;
      if (!healthSystem) {
        healthSystem = new HealthSystem();
        systemCache.set('HealthSystem', healthSystem);
      }

      let projectileSystem = systemCache.get('ProjectileSystem') as ProjectileSystem | undefined;
      if (!projectileSystem) {
        projectileSystem = new ProjectileSystem(healthSystem);
        systemCache.set('ProjectileSystem', projectileSystem);
      }

      return new TurretSystem(healthSystem, projectileSystem);
    }

    case 'SpawningSystem':
      return new SpawningSystem(gameManager);

    default:
      console.warn(`[SystemFactory] Unknown system: "${name}"`);
      return null;
  }
}
```

**Note on Dependency Injection:**
The system factory needs to be smarter to handle dependencies. Consider using a proper DI container or refactoring systems to not require constructor dependencies.

### Step 3: Refactor SceneLoader to Platform Adapter

**File:** `dev/scene-loader.ts` (refactored)

```typescript
import { GameRuntime } from '../packages/spartan/core/game-runtime';
import type { GameConfig } from '../packages/spartan/core/game-runtime';
import { PlayerInputSystem } from '../packages/spartan/systems/player-input.system';
import {
  InputManager,
  HeadlessInputManager,
  WebInputProvider,
} from '../packages/spartan-web/input';
import { createSystemByName } from './system-factory';

/**
 * SceneLoader - Platform adapter for web-based game loading.
 *
 * Responsibilities:
 * - Create DOM-specific input managers (keyboard/mouse)
 * - Delegate game initialization to GameRuntime.fromConfig()
 * - Attach input cleanup handlers
 *
 * What moved to the package:
 * - Entity spawning logic (now in GameRuntime.fromConfig())
 * - Connection registration (now in GameRuntime.fromConfig())
 * - Scene creation (now in GameRuntime.fromConfig())
 *
 * What stays here:
 * - Input manager creation (DOM-dependent)
 * - System factory (application-specific)
 * - Container management (web-specific)
 *
 * @example
 * ```typescript
 * const loader = new SceneLoader(document.getElementById('game'));
 * const config = await fetch('/games/level1.json').then(r => r.json());
 * const runtime = loader.load(config);
 * runtime.start();
 * ```
 */
export class SceneLoader {
  constructor(private container?: HTMLElement | null) {}

  /**
   * Load scene configuration and create initialized GameRuntime.
   *
   * @param config - Scene configuration from JSON
   * @returns Initialized GameRuntime ready to start
   */
  load(config: GameConfig): GameRuntime {
    console.log('[SceneLoader] Loading game for web platform...');

    // Validate config before loading
    const errors = SceneLoader.validate(config);
    if (errors.length > 0) {
      throw new Error(
        `Invalid scene config:\n${errors.map((e) => `  - ${e}`).join('\n')}`
      );
    }

    // Create platform-specific input provider
    let inputProvider;
    let inputCleanup: (() => void) | undefined;

    if (config.input && config.input.type !== 'none') {
      const { manager, cleanup } = this.createInputManager(
        config.input,
        this.container
      );
      inputCleanup = cleanup;

      // Wrap in InputProvider interface
      inputProvider =
        manager instanceof InputManager
          ? new WebInputProvider(manager)
          : {
              // Headless adapter
              getDirection: () => manager.getBufferedDirection(),
              isActionPressed: (action: string) =>
                manager.isActionPressed(action),
              clearBuffer: () => manager.clearBuffer(),
            };

      console.log(
        `[SceneLoader] Created ${config.input.type} input provider`
      );
    }

    // Delegate to package-native loader
    const runtime = GameRuntime.fromConfig(
      config,
      createSystemByName,
      inputProvider
    );

    // Attach input cleanup
    if (inputCleanup) {
      runtime.inputCleanup = inputCleanup;
    }

    console.log('[SceneLoader] ✅ Game loaded successfully for web');
    return runtime;
  }

  /**
   * Create input manager based on configuration.
   *
   * @param config - Input configuration from scene config
   * @param container - DOM container for keyboard/mouse input
   * @returns Input manager instance and cleanup function
   */
  private createInputManager(
    config: { type: 'keyboard' | 'headless'; options?: Record<string, unknown> },
    container?: HTMLElement | null
  ): {
    manager: InputManager | HeadlessInputManager;
    cleanup: () => void;
  } {
    if (config.type === 'headless') {
      const manager = new HeadlessInputManager();
      return {
        manager,
        cleanup: () => {
          /* no cleanup needed */
        },
      };
    }

    // Keyboard input (default)
    const options = {
      cellSize: (config.options?.cellSize as number) ?? 32,
      cellGap: (config.options?.cellGap as number) ?? 0,
      bufferInput: (config.options?.bufferInput as boolean) ?? true,
    };

    const manager = new InputManager(container ?? null, null, options);
    manager.enableKeyboard().enableBuffering(true);

    return {
      manager,
      cleanup: () => manager.destroy(),
    };
  }

  /**
   * Validate scene configuration.
   *
   * @param config - Scene configuration to validate
   * @returns Array of validation errors (empty if valid)
   */
  static validate(config: GameConfig): string[] {
    const errors: string[] = [];

    if (!config.scenes || config.scenes.length === 0) {
      errors.push('Config must contain at least one scene');
    }

    if (config.initialScene && config.scenes) {
      const hasInitial = config.scenes.some(
        (s) => s.id === config.initialScene
      );
      if (!hasInitial) {
        errors.push(
          `Initial scene "${config.initialScene}" not found in scenes array`
        );
      }
    }

    // Validate each scene
    if (config.scenes) {
      for (const scene of config.scenes) {
        if (!scene.id) {
          errors.push('Scene missing required "id" field');
        }
        if (!scene.width || scene.width <= 0) {
          errors.push(`Scene "${scene.id}" has invalid width: ${scene.width}`);
        }
        if (!scene.height || scene.height <= 0) {
          errors.push(`Scene "${scene.id}" has invalid height: ${scene.height}`);
        }

        // Validate entities
        if (scene.entities) {
          for (let i = 0; i < scene.entities.length; i++) {
            const entity = scene.entities[i];
            
            // Skip comments
            if (!entity.type) continue;

            if (entity.x < 0 || entity.x >= scene.width) {
              errors.push(
                `Scene "${scene.id}" entity ${i} (${entity.type}): x=${entity.x} out of bounds (0-${scene.width - 1})`
              );
            }
            if (entity.y < 0 || entity.y >= scene.height) {
              errors.push(
                `Scene "${scene.id}" entity ${i} (${entity.type}): y=${entity.y} out of bounds (0-${scene.height - 1})`
              );
            }
            if (entity.layer < 0 || entity.layer > 7) {
              errors.push(
                `Scene "${scene.id}" entity ${i} (${entity.type}): layer=${entity.layer} invalid (must be 0-7)`
              );
            }
          }
        }
      }
    }

    return errors;
  }
}
```

**Changes from original:**
- ✅ Removed `populateScene()` method (now in GameRuntime.fromConfig())
- ✅ Removed SYSTEM_REGISTRY (moved to system-factory.ts)
- ✅ Removed all entity validation (moved to GameRuntime.fromConfig())
- ✅ Removed player tracking (handled by GameRuntime.fromConfig())
- ✅ Simplified to ~150 lines (from 550 lines)
- ✅ Only handles platform-specific concerns (input, DOM)

### Step 4: Update Type Definitions

**File:** `dev/scene-loader.d.ts` (updated)

```typescript
import { GameRuntime } from '../packages/spartan/core/game-runtime';
import type { GameConfig } from '../packages/spartan/core/game-runtime';

/**
 * SceneLoader - Platform adapter for web-based game loading.
 * 
 * Delegates to GameRuntime.fromConfig() for core loading.
 */
export declare class SceneLoader {
  private container?;
  
  constructor(container?: HTMLElement | null);
  
  /**
   * Load scene configuration and create initialized GameRuntime.
   */
  load(config: GameConfig): GameRuntime;
  
  /**
   * Create input manager based on configuration (platform-specific).
   */
  private createInputManager;
  
  /**
   * Validate scene configuration.
   */
  static validate(config: GameConfig): string[];
}
```

## Before & After Comparison

### Before: SceneLoader.load()
```typescript
load(config: SceneConfig): GameRuntime {
    // 1. Create runtime with empty scene
    const runtime = GameRuntime.new(runtimeConfig);
    
    // 2. Populate initial scene (114 lines of logic)
    this.populateScene(runtime, initialScene);
    
    // 3. Create additional scenes
    for (const sceneDef of config.scenes) {
        runtime.game.sceneManager.createScene(...);
        this.populateScene(runtime, sceneDef); // Another 114 lines
    }
    
    // 4. Create input manager (DOM-specific)
    const { manager, cleanup } = this.createInputManager(...);
    
    // 5. Register systems
    for (const systemName of config.systems) {
        const system = SYSTEM_REGISTRY[systemName](...);
        runtime.addSystem(system);
    }
    
    // ❌ Never registers connections!
    
    return runtime;
}
```

**Total:** 550 lines, mixes concerns, no connection registration

### After: SceneLoader.load()
```typescript
load(config: GameConfig): GameRuntime {
    // 1. Validate config
    const errors = SceneLoader.validate(config);
    if (errors.length > 0) throw new Error(...);
    
    // 2. Create platform-specific input (DOM-dependent)
    const { manager, cleanup } = this.createInputManager(...);
    const inputProvider = new WebInputProvider(manager);
    
    // 3. Delegate to package (platform-agnostic)
    const runtime = GameRuntime.fromConfig(
        config,
        createSystemByName,  // Application-specific factory
        inputProvider        // Platform-specific input
    );
    
    // 4. Attach cleanup
    runtime.inputCleanup = cleanup;
    
    // ✅ Connections registered in GameRuntime.fromConfig()!
    
    return runtime;
}
```

**Total:** ~150 lines, clean separation of concerns, connection registration included

## Benefits of Migration

### 1. Package Completeness
- ✅ Core loading logic now in `@linkedgrid/spartan`
- ✅ Can use package without dev harness
- ✅ Easier to create new platforms (Unity, Godot, CLI)

### 2. Connection Registry Works
- ✅ `GameState.connections` populated during initialization
- ✅ Teleporters work correctly across scenes
- ✅ Editor can use color-coded portals

### 3. Cleaner Architecture
- ✅ Platform adapter pattern
- ✅ Separation of concerns
- ✅ Less code in dev harness
- ✅ Better testability

### 4. Better Developer Experience
- ✅ Console logs show connection registration
- ✅ Validation warnings for orphaned portals
- ✅ Easier to debug scene loading issues

## Migration Checklist

### Core Package
- [ ] Add `GameConfig` interface to `game-runtime.ts`
- [ ] Implement `GameRuntime.fromConfig()` static method
- [ ] Add `HasSceneConnection` trait
- [ ] Add `hasSceneConnection()` guard
- [ ] Update `TeleporterSystem` to use connection registry

### Dev Harness
- [ ] Create `dev/system-factory.ts` with `createSystemByName()`
- [ ] Refactor `dev/scene-loader.ts` to platform adapter
- [ ] Update `dev/scene-loader.d.ts` type definitions
- [ ] Test with existing demo configs

### Configuration Files
- [ ] Update teleporter entities to use `connectionKey`
- [ ] Test backward compatibility with `destination` format

### Testing
- [ ] Unit tests for `GameRuntime.fromConfig()`
- [ ] Integration tests for connection registration
- [ ] Visual tests for multi-scene teleportation
- [ ] Verify all demos still work

## System Factory Pattern Note

The current `SYSTEM_REGISTRY` uses a closure-based approach for dependency injection:

```typescript
ProjectileSystem: (_gameManager, systems) => {
    let healthSystem = systems.get('HealthSystem') as HealthSystem | undefined;
    if (!healthSystem) {
        healthSystem = new HealthSystem();
        systems.set('HealthSystem', healthSystem);
    }
    return new ProjectileSystem(healthSystem);
}
```

**For the refactored version**, you have two options:

### Option A: Keep Stateful Factory (Simpler)
```typescript
// Factory maintains state across calls
const systemCache = new Map<string, GameSystem>();

export function createSystemByName(name: string, gameManager: GameManager) {
    if (name === 'HealthSystem') {
        if (!systemCache.has('HealthSystem')) {
            systemCache.set('HealthSystem', new HealthSystem());
        }
        return systemCache.get('HealthSystem')!;
    }
    
    if (name === 'ProjectileSystem') {
        const health = systemCache.get('HealthSystem') as HealthSystem;
        return new ProjectileSystem(health);
    }
}
```

**Pros:** Simple, works with current system architecture  
**Cons:** Global state, harder to test

### Option B: Two-Pass System Creation (Better)
```typescript
// GameRuntime.fromConfig() creates systems in two passes:

// Pass 1: Create independent systems
for (const systemName of config.systems) {
    if (!hasDependencies(systemName)) {
        systems.push(systemFactory(systemName, game));
    }
}

// Pass 2: Create dependent systems (can access already-created systems)
for (const systemName of config.systems) {
    if (hasDependencies(systemName)) {
        systems.push(systemFactory(systemName, game, systems));
    }
}
```

**Pros:** No global state, explicit dependencies  
**Cons:** Requires system dependency metadata

### Option C: Refactor Systems (Best Long-Term)
```typescript
// Remove constructor dependencies entirely
class ProjectileSystem extends BaseSystem {
    private healthSystem?: HealthSystem;
    
    // Inject dependencies after construction
    setHealthSystem(health: HealthSystem) {
        this.healthSystem = health;
    }
}
```

**Pros:** Cleanest architecture, most flexible  
**Cons:** Requires refactoring all systems

**Recommendation for MVP:** Use Option A (stateful factory). You can refactor to Option C later.

## Testing the Migration

### 1. Unit Test GameRuntime.fromConfig()
```typescript
describe('GameRuntime.fromConfig', () => {
    it('should register connections for teleporters', () => {
        const config = {
            scenes: [
                { 
                    id: 'room1', 
                    entities: [
                        { type: 'teleporter', x: 5, y: 5, layer: 1, 
                          data: { connectionKey: 'red' }}
                    ]
                },
                { 
                    id: 'room2', 
                    entities: [
                        { type: 'teleporter', x: 10, y: 10, layer: 1,
                          data: { connectionKey: 'red' }}
                    ]
                }
            ],
            initialScene: 'room1',
            systems: []
        };

        const runtime = GameRuntime.fromConfig(config, () => null);
        const connections = runtime.game.gameState.getConnections('red');

        expect(connections).toHaveLength(2);
        expect(connections[0]).toMatchObject({ sceneId: 'room1', x: 5, y: 5 });
        expect(connections[1]).toMatchObject({ sceneId: 'room2', x: 10, y: 10 });
    });
});
```

### 2. Integration Test SceneLoader
```typescript
describe('SceneLoader (web platform)', () => {
    it('should load game with connection registration', () => {
        const loader = new SceneLoader();
        const config = loadTestConfig('multi-scene.json');
        
        const runtime = loader.load(config);
        
        // Verify connections registered
        const connections = runtime.game.gameState.getConnections('red');
        expect(connections.length).toBeGreaterThan(0);
        
        // Verify systems created
        expect(runtime.systems).toContain(TeleporterSystem);
    });
});
```

### 3. Visual Test Teleportation
```typescript
visual('teleporter with connection keys', {
    arrange: ({ runtime }) => {
        const config = {
            scenes: [
                { id: 'room1', entities: [
                    { type: 'player', x: 4, y: 5, layer: 6 },
                    { type: 'teleporter', x: 5, y: 5, layer: 1,
                      data: { connectionKey: 'portal-A' }}
                ]},
                { id: 'room2', entities: [
                    { type: 'teleporter', x: 10, y: 10, layer: 1,
                      data: { connectionKey: 'portal-A' }}
                ]}
            ],
            initialScene: 'room1',
            systems: ['TeleporterSystem']
        };
        
        Object.assign(runtime, GameRuntime.fromConfig(config, createSystemByName));
    },
    act: ({ runtime }) => {
        // Move player onto portal
        const scene = runtime.activeScene;
        scene.spatial.move(4, 5, 5, 5, 6);
        scene.spatial.commit();
        runtime.tick();
    },
    assert: ({ runtime, expect }) => {
        expect('Player teleported to room2', () => {
            const pos = runtime.game.getPlayerPosition();
            if (pos?.sceneId !== 'room2' || pos.x !== 10 || pos.y !== 10) {
                throw new Error(`Expected room2(10,10), got ${pos?.sceneId}(${pos.x},${pos.y})`);
            }
        });
    }
});
```

## Rollout Strategy

### Phase 1: Implement Core (Week 1)
1. Add `GameRuntime.fromConfig()` to package
2. Add `HasSceneConnection` trait
3. Write unit tests for connection registration

### Phase 2: Refactor Dev Harness (Week 1-2)
1. Create `system-factory.ts`
2. Refactor `scene-loader.ts` to adapter
3. Update type definitions
4. Test with existing demos

### Phase 3: Update Configs (Week 2)
1. Convert teleporters to use `connectionKey`
2. Test backward compatibility
3. Update documentation

### Phase 4: Update TeleporterSystem (Week 2)
1. Check `hasSceneConnection()` first
2. Fall back to `hasTeleportTarget()`
3. Add logging for debugging

### Phase 5: Documentation & Cleanup (Week 3)
1. Update README with new patterns
2. Write migration guide for other platforms
3. Add examples of custom system factories

## Conclusion

This migration transforms SceneLoader from a monolithic loader into a clean platform adapter, while moving core game initialization logic into the package where it belongs. The key insight is that **connection registration is a core game concern**, not a platform concern, so it belongs in `@linkedgrid/spartan`, not in the dev harness.

The refactored architecture is:
- ✅ More maintainable (separation of concerns)
- ✅ More reusable (platform-agnostic core)
- ✅ More testable (cleaner dependencies)
- ✅ More debuggable (better logging)
- ✅ Actually works (connections registered!)
