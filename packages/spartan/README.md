# Spartan Game Engine

The `spartan` package is a high-performance, cell-centric 2D game framework built on top of `linkedgrid`. It adopts a data-oriented design with a focus on LLM-friendliness and deterministic execution.

## Package Structure

### `core/` - The Engine Brain
| File | Description |
| :--- | :--- |
| `grid/` | Underlying grid topology and cellular utilities (`LinkedGrid`). |
| `spatial-system.ts` | Manages 2D positioning and the Two-Phase Commit transaction system. |
| `entity-store.ts` | Sparse map of `EntityID -> EntityData`. Stores *what* things are. |
| `game-loop.ts` | Orchestrates the tick cycle: Overlap detection -> System updates -> Commit. |
| `game-runtime.ts` | Fixed-timestep driver using `requestAnimationFrame`. |
| `game-manager.ts` | Top-level orchestrator for state, scenes, and transitions. |
| `base-system.ts` | Abstract base classes (`BaseTickedSystem`, `BaseReactiveSystem`). |

### Directories
| Directory | Purpose |
| :--- | :--- |
| `entities/` | **Archetypes**. Individual `[name].entity.ts` files and type-safe spawn helpers. |
| `systems/` | **Logic**. Specialized logic systems (e.g., `fire.system.ts`, `liquid.system.ts`). |
| `traits/` | **Traits**. Composable data interfaces (`health.trait.ts`) and runtime guards. |
| `config/` | **Configuration**. Single source of truth for systems, layers, and entity defaults. |
| `input/` | **Input**. Unified `InputManager` for keyboard, mouse, and gamepad. |
| `docs/` | **Knowledge**. Comprehensive framework documentation and ADRs. |

## Key Concepts

1.  **Cell-Centric**: The grid is the primary source of truth for location.
2.  **Two-Phase Commit**: Systems stage "Intents"; the engine executes them atomically at the end of the tick.
3.  **Entity/Trait**: Entities are composed of passive data contracts (Traits) rather than classes.
4.  **Deterministic**: Logic updates on discrete integer Ticks, ensuring repeatability.
5.  **LLM-Friendly**: Explicit naming conventions and centralized metadata reduce cognitive load.

---
See `docs/GUIDELINES.md` for development best practices.