# ADR: Consolidate Data Loading and Connection Registration

## Status
Proposed

## Context
Currently, the logic for parsing JSON scene configurations and initializing the `GameRuntime` resides in `dev/scene-loader.ts`, which is part of the developer playground/harness and not the core `@linkedgrid/spartan` package.

This separation creates several issues:
1.  **Reusability**: Consumers of the package cannot easily load game configurations without re-implementing the loader.
2.  **Global State Initialization**: There is no standardized "boot" phase for the game. This makes it difficult to strict initialize global state, such as registering cross-scene connections (teleporters, signal networks) before the game loop starts.
3.  **Fragility**: Logic like "register all connections" currently has to be hacked into the `dev` loader or done lazily in systems, which leads to bugs (e.g., teleporters not knowing their destinations until a scene is visited).

## Problem Statement
We need a robust, package-native way to load a full game configuration (multiple scenes, systems, entities) and ensure that global relationships (like connections) are fully established *before* the first frame of gameplay.

## Proposed Solution

### 1. `GameRuntime` Ownership of Loading
The `GameRuntime` class (in `packages/spartan/core/game-runtime.ts`) will become the primary entry point for initializing a game from a configuration. It will orchestrate the creation of `GameManager`, `GameState`, and `SceneManager`.

We will add a static method `GameRuntime.fromConfig(config: GameConfig): GameRuntime` which:
- Validates the configuration.
- Initializes the core systems.
- Performs the two-phase initialization (Structure -> Hydration).

### 2. Implementation of Two-Phase Initialization
The loading process within `GameRuntime` will follow:

**Phase 1: Structure & State**
- Create `GameManager` and `GameState`.
- Create all `Scene` instances (grids) defined in the config.
- Register all game systems defined in the config.

**Phase 2: Hydration & Global Indexing**
- Iterate through *all* entities in *all* scenes defined in the JSON.
- Spawn entities into their respective `SparseEntityStore` and `SpatialSystem`s.
- **CRITICAL:** As entities are spawned, check for global traits (specifically `HasConnection`).
- If an entity has `HasConnection`, register it immediately in `GameState.connections`.

### 3. Connection Registry
This ensures `GameState.connections` is a complete, global lookup table available immediately upon game start.

### 4. Refactor `dev/scene-loader.ts` to Platform Adapter
The existing `dev/scene-loader.ts` will be retained but refactored to act as a **Platform Adapter** (specifically for the Web Playground).
- **Responsibility:** It will handle web-specific tasks like creating the `InputManager` (which depends on DOM events), setting up the rendering loop (if not handled by runtime), and then delegating the core game loading to `GameRuntime`.
- **Constraint:** The `@linkedgrid/spartan` package remains strictly platform-agnostic. It knows nothing about DOM, HTML, or specific input hardware.

## Detailed Design

### Update: `packages/spartan/core/game-runtime.ts`

```typescript
export class GameRuntime {
  // ... existing code ...

  static fromConfig(config: GameConfig): GameRuntime {
    // 1. Setup Runtime & Systems
    const game = new GameManager();
    // ... setup systems ...

    const runtime = new GameRuntime(game, systems, ...);

    // 2. Create Scenes
    for (const sceneDef of config.scenes) {
        runtime.game.sceneManager.createScene(...);
    }

    // 3. Hydrate Entities & Build Global Index
    for (const sceneDef of config.scenes) {
        const scene = runtime.game.sceneManager.getScene(sceneDef.id);
        
        for (const entityDef of sceneDef.entities) {
            // Spawn entity
            const id = scene.spatial.spawn(...);
            
            // CHECK GLOBAL TRAITS
            const entityData = runtime.game.gameState.entityStore.getData(id);
            
            // Register Connections
            if (hasConnection(entityData)) {
                runtime.game.gameState.addConnection(
                    entityData.connectionKey, 
                    scene.id, 
                    entityDef.x, 
                    entityDef.y, 
                    entityDef.layer
                );
            }
        }
        
        // Finalize scene
        scene.spatial.commit();
    }
    
    return runtime;
  }
}
```

### `HasConnection` Trait
We will formalize the `HasConnection` trait:
```typescript
export interface HasConnection {
    connectionKey: string;
}
```

## Consequences

**Positive:**
- **Reliability:** Teleporters and other linked entities will strictly work from tick 0.
- **Usability:** Package consumers get a full-featured loader out of the box.
- **Cleanliness:** Removes "dev-only" logic that is actually core to the engine's capability.

**Negative:**
- **Performance:** Loading very large games might take slightly longer at startup as we parse all scenes (though this is likely negligible for current scale and even desirable for correctness).
- **Refactor Cost:** Requires moving code and updating the playground.

## Verification
- `spawners-and-signals.json` demo should work flawlessly.
- Teleporters should resolve destinations by key, not hardcoded coordinates.
- Connections map should be populated immediately.
