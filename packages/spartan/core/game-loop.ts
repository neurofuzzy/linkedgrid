/**
 * @brief Main game loop orchestrating systems and frame ticks.
 */
import { SpatialSystem } from './spatial-system';
import type { GameManager } from './game-manager';
import type { GameSystem, GameContext, ExecutionPhase } from './types';
import { EXECUTION_PHASE_ORDER } from '../config/systems.config';

/**
 * Sort systems by their execution phase.
 * Systems without an executionPhase default to 'main'.
 * Stable sort preserves original order within the same phase.
 */
function sortSystemsByPhase(systems: GameSystem[]): GameSystem[] {
  return [...systems].sort((a, b) => {
    const phaseA: ExecutionPhase = a.executionPhase ?? 'main';
    const phaseB: ExecutionPhase = b.executionPhase ?? 'main';
    return EXECUTION_PHASE_ORDER[phaseA] - EXECUTION_PHASE_ORDER[phaseB];
  });
}

/**
 * GameLoop - Orchestrates one game tick for a SpatialSystem.
 *
 * Runs the tick cycle:
 * 1. Detect overlaps from committed state
 * 2. Run all systems (which stage movement intents)
 * 3. Commit all intents atomically
 *
 * @example
 * ```typescript
 * const gameLoop = new GameLoop(scene.spatial, gameManager);
 * gameLoop.addSystem(new TeleporterSystem());
 * gameLoop.addSystem(new EnemyAISystem());
 *
 * // Each turn/frame
 * gameLoop.tick();
 * ```
 */
export class GameLoop {
  private systems: GameSystem[] = [];
  private _tickCount = 0;

  constructor(
    private spatial: SpatialSystem,
    private gameManager?: GameManager
  ) { }

  /** Current tick count */
  get tickCount(): number {
    return this._tickCount;
  }

  /**
   * Register systems with automatic phase-based ordering.
   *
   * Systems are automatically sorted by their executionPhase property:
   * 1. 'input' - Input systems (PlayerInputSystem)
   * 2. 'pre-commit' - React to intents (PushSystem, DoorSystem)
   * 3. 'main' - Core logic (FireSystem, ExplosionSystem)
   * 4. 'post-commit' - React to committed state (CollectionSystem, TeleporterSystem)
   *
   * Systems without an executionPhase default to 'main'.
   * Order within the same phase is preserved (stable sort).
   */
  registerSystems(systems: GameSystem[]): void {
    this.systems = sortSystemsByPhase(systems);
  }

  /**
   * Register a game system to run each tick.
   *
   * The system is automatically sorted into the correct position
   * based on its executionPhase property.
   *
   * @param system - Game system to register
   *
   * @example
   * ```typescript
   * gameLoop.addSystem(new TeleporterSystem(gameManager));
   * gameLoop.addSystem(new EnemyAISystem());
   * ```
   */
  addSystem(system: GameSystem): void {
    this.systems.push(system);
    this.systems = sortSystemsByPhase(this.systems);
  }

  /**
   * Add a system to the beginning of the execution list.
   * @deprecated Use addSystem() instead - systems are now auto-sorted by executionPhase.
   */
  prependSystem(system: GameSystem): void {
    this.systems.unshift(system);
    this.systems = sortSystemsByPhase(this.systems);
  }

  /**
   * Execute one game tick synchronously.
   *
   * 1. Detect overlaps from committed state
   * 2. Run all systems (they stage intents)
   * 3. Commit all intents atomically
   *
   * @example
   * ```typescript
   * // Manual tick (for testing or turn-based)
   * gameLoop.tick();
   *
   * // Or called by GameRuntime in real-time loop
   * ```
   */
  tick(): void {
    this._tickCount++;

    // 1. Detect overlaps
    const overlaps = this.spatial.detectOverlaps();

    // 2. Run systems
    const context: GameContext = {
      tick: this._tickCount,
      overlaps,
      spatial: this.spatial as unknown as GameContext['spatial'],
      gameManager: this.gameManager as unknown as GameContext['gameManager'],
    };

    for (const system of this.systems) {
      system.update(context);
    }

    // 3. Commit intents
    this.spatial.commit();
  }

  /** Reset tick counter (for testing or scene transitions) */
  resetTicks(): void {
    this._tickCount = 0;
  }
}
