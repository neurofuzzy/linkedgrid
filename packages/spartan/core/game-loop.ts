/**
 * @brief Main game loop orchestrating systems and frame ticks.
 */
import { SpatialSystem } from './spatial-system';
import type { GameManager } from './game-manager';
import type { GameSystem, GameContext } from './types';

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

  constructor(
    private spatial: SpatialSystem,
    private gameManager?: GameManager
  ) { }

  /**
   * Register systems in execution order.
   *
   * CRITICAL: Order matters! Systems execute in registration order.
   * See GUIDELINES.md for execution phase requirements.
   *
   * Recommended order:
   * 1. Input systems (PlayerInputSystem)
   * 2. Pre-commit systems (DoorSystem)
   * 3. Main systems (FireSystem, CombatSystem)
   * 4. Post-commit systems (CollectionSystem)
   */
  registerSystems(systems: GameSystem[]): void {
    this.systems = systems;
  }

  /**
   * Register a game system to run each tick.
   *
   * Systems are executed in registration order.
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
    // 1. Detect overlaps
    const overlaps = this.spatial.detectOverlaps();

    // 2. Run systems
    const context: GameContext = {
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
}
