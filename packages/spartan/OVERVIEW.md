# Spartan Package Overview

The `spartan` package is a high-performance, cell-centric 2D game framework built on top of `linkedgrid`.

## Core Runtime

| File | Description |
| :--- | :--- |
| `index.ts` | Main entry point, exporting all public APIs. |
| `types.ts` | Core type definitions, including `GameSystem`, `GameContext`, and `EntityData`. |
| `game-runtime.ts` | The driver of the game. Manages the `requestAnimationFrame` loop, fixed timestep updates, and high-level saving/loading. |
| `game-loop.ts` | The logic coordinator. Executes one "Tick": `overlap detection` -> `system updates` -> `spatial commit`. |
| `game-state.ts` | Container for global game data (lives, score, inventory) and the `SparseEntityStore`. |
| `game-manager.ts` | Top-level orchestrator that binds `GameState`, `SceneManager`, and `GameRuntime` together. |

## Spatial & Entity System

| File | Description |
| :--- | :--- |
| `spatial-system.ts` | **The Brain.** Manages the 2D grid, spatial queries (radius, line), and the Two-Phase Commit transaction system for movement. |
| `entity-store.ts` | **The Database.** A sparse map of `EntityID -> EntityData`. Stores *what* things are, while SpatialSystem stores *where* things are. |
| `scene.ts` | Container for a single level. Owns a `LinkedGrid` and a `SpatialSystem`. |
| `scene-manager.ts` | Manages multiple scenes, including creation, deletion, and transitions. |

## Directories

| Directory | Purpose |
| :--- | :--- |
| `entities/` | **Traits & Archetypes**. Contains `traits.ts` (interfaces), `entity-types.ts` (compositions), and `GUIDELINES.md`. |
| `systems/` | **Game Logic**. Contains standard systems (`PlayerInput`, `DoorSystem`, `PropagationSystem`) and `SYSTEM_DEVELOPMENT.md`. |
| `layers/` | **Layer Definitions**. Constants for the 8-layer rendering/collision stack (`GameLayers`). |
| `input/` | **Input Handling**. Abstracts Keyboard/Mouse/Gamepad into a unified `InputManager`. |

## Key Concepts

1.  **Cell-Centric**: The Grid is the source of truth for location.
2.  **Two-Phase Commit**: Systems propose changes (Intents), SpatialSystem executes them at the end of the tick.
3.  **Entity/Trait**: Entities are composed of pure data interfaces (Traits) rather than classes.
4.  **Global Store / Local Grid**: Entity data is global (persists across scenes), but positions are local to a specific Scene.
