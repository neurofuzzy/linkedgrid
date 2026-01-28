import { GameManager } from './game-manager.js';
import { GameLoop } from './game-loop.js';
import { Scene } from './scene.js';
import { SpatialSystem } from './spatial-system.js';
import type { GameSystem } from './types.js';

/**
 * Configuration for creating a new game.
 */
export interface GameRuntimeConfig {
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

/**
 * GameRuntime - Real-time execution environment.
 *
 * Manages fixed-timestep game loop, scene transitions, and save/load.
 * Uses requestAnimationFrame for real-time execution with consistent
 * tick rate regardless of frame rate.
 *
 * @example
 * ```typescript
 * const runtime = GameRuntime.new({
 *   initialScene: { id: 'level-1', width: 50, height: 50 },
 *   systems: [new EnemyAISystem(), new TeleporterSystem()],
 *   tickRate: 10
 * });
 *
 * // Setup initial state
 * const playerId = runtime.spatial.spawn('player', 25, 25, GameLayers.ACTORS);
 * runtime.game.gameState.playerEntityId = playerId;
 *
 * // Start game
 * runtime.start();
 * ```
 */
export class GameRuntime {
  readonly game: GameManager;
  private gameLoop: GameLoop;
  private systems: GameSystem[];
  private initialConfig: GameRuntimeConfig;

  // Frame timing
  private animationFrameId?: number;
  private lastTickTime = 0;
  private tickInterval: number; // ms per tick
  private accumulator = 0;
  private _tickCount = 0;
  private _isRunning = false;

  private constructor(
    game: GameManager,
    systems: GameSystem[],
    tickRate: number,
    initialConfig: GameRuntimeConfig,
    initialTickCount = 0
  ) {
    this.game = game;
    this.systems = systems;
    this.tickInterval = 1000 / tickRate;
    this.initialConfig = initialConfig;
    this._tickCount = initialTickCount;

    // Initialize loop for active scene
    const activeScene = game.sceneManager.getActiveScene();
    if (!activeScene) {
      throw new Error('No active scene');
    }
    this.gameLoop = new GameLoop(activeScene.spatial);
    this.registerSystems();
  }

  /**
   * Create new game runtime.
   *
   * @param config - Runtime configuration
   * @returns New GameRuntime instance
   *
   * @example
   * ```typescript
   * const runtime = GameRuntime.new({
   *   initialScene: { id: 'dungeon', width: 40, height: 30 },
   *   systems: [new TeleporterSystem()],
   *   tickRate: 10
   * });
   * ```
   */
  static new(config: GameRuntimeConfig): GameRuntime {
    const game = new GameManager();

    // Create initial scene
    game.sceneManager.createScene(
      config.initialScene.id,
      config.initialScene.width,
      config.initialScene.height,
      config.initialScene.metadata
    );

    return new GameRuntime(game, config.systems, config.tickRate || 10, config);
  }

  /**
   * Load game from saved data.
   *
   * @param saveData - Saved game data
   * @param systems - Systems to register (not serialized)
   * @param tickRate - Ticks per second (default: 10)
   * @returns New GameRuntime instance with loaded state
   *
   * @example
   * ```typescript
   * const savedJson = localStorage.getItem('save');
   * const saveData = JSON.parse(savedJson);
   * const runtime = GameRuntime.load(saveData, [
   *   new TeleporterSystem(),
   *   new EnemyAISystem()
   * ], 10);
   * runtime.start();
   * ```
   */
  static load(
    saveData: any,
    systems: GameSystem[],
    tickRate = 10
  ): GameRuntime {
    const game = GameManager.load(saveData);

    // Create minimal config for constructor
    const config: GameRuntimeConfig = {
      initialScene: {
        id: saveData.activeSceneId || 'unknown',
        width: 10,
        height: 10,
      },
      systems,
      tickRate,
    };

    return new GameRuntime(
      game,
      systems,
      tickRate,
      config,
      saveData.tickCount || 0
    );
  }

  /**
   * Start the game loop.
   *
   * Begins requestAnimationFrame loop with fixed timestep.
   * If already running, this is a no-op.
   *
   * @example
   * ```typescript
   * runtime.start();
   * // Game is now running
   * ```
   */
  start(): void {
    if (this._isRunning) return;

    this._isRunning = true;
    this.lastTickTime = performance.now();
    this.loop();
  }

  /**
   * Stop the game loop.
   *
   * Cancels requestAnimationFrame. Game state is preserved.
   * Call start() to resume.
   *
   * @example
   * ```typescript
   * runtime.stop();
   * // Game paused, state preserved
   * ```
   */
  stop(): void {
    this._isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }

  /**
   * Execute one game tick manually.
   *
   * Useful for testing or turn-based execution.
   * Handles scene transitions automatically.
   * Increments tick count.
   *
   * @example
   * ```typescript
   * // In tests
   * runtime.tick();
   *
   * // Or for turn-based control
   * document.addEventListener('keydown', () => {
   *   runtime.tick();
   * });
   * ```
   */
  tick(): void {
    const sceneBefore = this.game.sceneManager.getActiveScene();

    // 1. Run game loop (systems stage intents)
    this.gameLoop.tick();
    this._tickCount++;

    // 2. Execute queued scene transition (if any)
    const sceneChanged = this.game.executePendingTransition();

    // 3. If scene changed, rebuild game loop
    if (sceneChanged) {
      const sceneAfter = this.game.sceneManager.getActiveScene();
      if (sceneAfter && sceneAfter !== sceneBefore) {
        this.onSceneTransition(sceneAfter);
      }
    }
  }

  /**
   * Save current game state.
   *
   * Stops loop if running, saves state, then resumes if needed.
   * Returns SaveData that can be serialized to JSON.
   *
   * @returns SaveData object
   *
   * @example
   * ```typescript
   * const saveData = runtime.save();
   * localStorage.setItem('save-slot-1', JSON.stringify(saveData));
   * ```
   */
  save(): any {
    const wasRunning = this._isRunning;
    if (wasRunning) {
      this.stop();
    }

    const saveData = {
      ...this.game.save(),
      tickCount: this._tickCount,
      tickRate: 1000 / this.tickInterval,
    };

    if (wasRunning) {
      this.start();
    }

    return saveData;
  }

  /**
   * Restart game to initial state.
   *
   * Creates new GameManager with initial scene configuration.
   * Resets tick count and accumulator.
   *
   * @param autoStart - If true, automatically start after restart
   *
   * @example
   * ```typescript
   * // Player died, restart from beginning
   * runtime.restart(true);
   * ```
   */
  restart(autoStart = false): void {
    this.stop();

    // Create new GameManager
    (this as any).game = new GameManager();

    // Recreate initial scene
    this.game.sceneManager.createScene(
      this.initialConfig.initialScene.id,
      this.initialConfig.initialScene.width,
      this.initialConfig.initialScene.height,
      this.initialConfig.initialScene.metadata
    );

    // Reset state
    this._tickCount = 0;
    this.accumulator = 0;

    // Reinitialize loop
    const activeScene = this.game.sceneManager.getActiveScene();
    if (activeScene) {
      this.gameLoop = new GameLoop(activeScene.spatial);
      this.registerSystems();
    }

    if (autoStart) {
      this.start();
    }
  }

  /**
   * Get the active scene's spatial system.
   *
   * Convenience accessor for common operations.
   *
   * @returns Active scene's SpatialSystem
   * @throws Error if no active scene
   */
  get spatial(): SpatialSystem {
    const scene = this.game.sceneManager.getActiveScene();
    if (!scene) throw new Error('No active scene');
    return scene.spatial;
  }

  /**
   * Get the active scene.
   *
   * @returns Active scene
   * @throws Error if no active scene
   */
  get activeScene(): Scene {
    const scene = this.game.sceneManager.getActiveScene();
    if (!scene) throw new Error('No active scene');
    return scene;
  }

  /**
   * Check if game loop is running.
   *
   * @returns True if loop is active
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get total tick count since start.
   *
   * @returns Number of ticks executed
   */
  get tickCount(): number {
    return this._tickCount;
  }

  /**
   * Internal requestAnimationFrame loop.
   *
   * Implements fixed timestep with accumulator pattern.
   * Game ticks run at consistent rate regardless of frame rate.
   */
  private loop = (): void => {
    if (!this._isRunning) return;

    const now = performance.now();
    const deltaTime = now - this.lastTickTime;
    this.lastTickTime = now;

    // Accumulate time
    this.accumulator += deltaTime;

    // Fixed timestep: run ticks for accumulated time
    while (this.accumulator >= this.tickInterval) {
      // Call internal tick logic (without double-incrementing count)
      const sceneBefore = this.game.sceneManager.getActiveScene();

      // 1. Run game loop
      this.gameLoop.tick();
      this._tickCount++;

      // 2. Execute queued scene transition
      const sceneChanged = this.game.executePendingTransition();

      // 3. Rebuild game loop if scene changed
      if (sceneChanged) {
        const sceneAfter = this.game.sceneManager.getActiveScene();
        if (sceneAfter && sceneAfter !== sceneBefore) {
          this.onSceneTransition(sceneAfter);
        }
      }

      this.accumulator -= this.tickInterval;
    }

    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Handle scene transition.
   *
   * Recreates game loop for new scene and re-registers systems.
   *
   * IMPORTANT: Only systems in this.systems[] are re-registered.
   * Systems added directly via gameLoop.addSystem() are permanently lost.
   * See specs/spartan-system-registration.md for correct registration patterns.
   */
  private onSceneTransition(newScene: Scene): void {
    // Recreate game loop for new scene
    this.gameLoop = new GameLoop(newScene.spatial);
    this.registerSystems();
  }

  /**
   * Register all systems with current game loop.
   */
  private registerSystems(): void {
    for (const system of this.systems) {
      this.gameLoop.addSystem(system);
    }
  }
}
