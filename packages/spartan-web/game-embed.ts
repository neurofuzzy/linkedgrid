/**
 * GameEmbed - Simple web embedding for Spartan games.
 *
 * Provides a clean, consumer-friendly API for embedding games in web pages.
 * Handles all the complexity of input management, system initialization,
 * and game lifecycle internally.
 *
 * @example
 * ```typescript
 * // Minimal usage
 * const embed = new GameEmbed(document.getElementById('game'));
 * const config = await fetch('/games/level1.json').then(r => r.json());
 * await embed.load(config);
 * embed.start();
 *
 * // With cleanup
 * embed.destroy();
 * ```
 */
import {
  GameRuntime,
  type GameConfig,
  type InputProvider,
} from '../spartan/core/game-runtime';
import {
  InputManager,
  HeadlessInputManager,
  WebInputProvider,
} from './input';

import type { InputPreset } from '../spartan/core/input-provider';

/**
 * Input configuration for GameEmbed.
 */
export interface GameEmbedInputConfig {
  /** Input mode: 'keyboard' (default), 'headless', or 'none' */
  type?: 'keyboard' | 'headless' | 'none';
  /** Cell size in pixels (for mouse input) */
  cellSize?: number;
  /** Gap between cells (for mouse input) */
  cellGap?: number;
  /** Buffer inputs between ticks */
  bufferInput?: boolean;
  /** Direction input mode */
  directionMode?: 'continuous' | 'tap';
  /**
   * Input preset for mapping controls.
   * - 'classic': Both arrow and WASD control movement, aim follows last move
   * - 'twin-stick': Arrows for movement, WASD for aiming (auto-fires)
   * - 'separated': Arrows for movement, WASD for attack direction
   */
  preset?: InputPreset;
}

/**
 * Configuration options for GameEmbed.
 */
export interface GameEmbedConfig {
  /** Input configuration (defaults to keyboard input) */
  input?: GameEmbedInputConfig;
}

/**
 * GameEmbed - High-level API for embedding Spartan games.
 *
 * This class encapsulates:
 * - DOM container attachment
 * - Input manager creation and cleanup
 * - GameRuntime initialization with all systems
 * - Game lifecycle (start, stop, restart, destroy)
 *
 * All systems are automatically initialized via the built-in
 * system registry. No external configuration needed.
 */
export class GameEmbed {
  private container: HTMLElement | null;
  private runtime: GameRuntime | null = null;
  private inputManager: InputManager | HeadlessInputManager | null = null;
  private inputProvider: InputProvider | null = null;
  private embedConfig: GameEmbedConfig;

  /**
   * Create a new GameEmbed instance.
   *
   * @param container - DOM element to embed the game in (optional for headless)
   * @param config - Optional configuration
   *
   * @example
   * ```typescript
   * const embed = new GameEmbed(document.getElementById('game'));
   * ```
   */
  constructor(container: HTMLElement | null = null, config: GameEmbedConfig = {}) {
    this.container = container;
    this.embedConfig = config;
  }

  /**
   * Load a game from JSON configuration.
   *
   * Creates the input provider (if configured) and initializes
   * the GameRuntime with all systems.
   *
   * @param gameConfig - Game configuration (from JSON)
   * @returns The GameEmbed instance for chaining
   *
   * @example
   * ```typescript
   * const config = JSON.parse(jsonString);
   * embed.load(config);
   * embed.start();
   * ```
   */
  load(gameConfig: GameConfig): this {
    // Validate configuration
    const errors = GameEmbed.validate(gameConfig);
    if (errors.length > 0) {
      throw new Error(
        `Invalid game config:\n${errors.map((e) => `  - ${e}`).join('\n')}`
      );
    }

    // Build input configuration by merging gameConfig.input with embedConfig.input
    // Spread options first to prevent them from overriding type/preset
    const inputConfig: GameEmbedInputConfig = {
      ...this.embedConfig.input,
      ...(gameConfig.input?.options as Record<string, unknown> ?? {}),
      type: gameConfig.input?.type ?? this.embedConfig.input?.type ?? 'keyboard',
      preset: gameConfig.input?.preset ?? this.embedConfig.input?.preset ?? 'classic',
    };

    // Create input manager and provider
    if (inputConfig.type !== 'none') {
      this.createInputManager(inputConfig);
    }

    // Create runtime with all systems
    this.runtime = GameRuntime.fromConfig(gameConfig, this.inputProvider ?? undefined);

    // Store input manager reference on runtime for external access
    if (this.inputManager) {
      this.runtime.inputManager = this.inputManager;
      this.runtime.inputCleanup = () => this.destroyInput();
    }

    return this;
  }

  /**
   * Start the game loop.
   *
   * @returns The GameEmbed instance for chaining
   * @throws Error if no game is loaded
   */
  start(): this {
    if (!this.runtime) {
      throw new Error('No game loaded. Call load() first.');
    }
    this.runtime.start();
    return this;
  }

  /**
   * Stop the game loop (pause).
   *
   * @returns The GameEmbed instance for chaining
   */
  stop(): this {
    this.runtime?.stop();
    return this;
  }

  /**
   * Execute a single game tick (for testing or turn-based games).
   *
   * @returns The GameEmbed instance for chaining
   */
  tick(): this {
    this.runtime?.tick();
    return this;
  }

  /**
   * Get the underlying GameRuntime.
   *
   * Useful for accessing game state, spatial operations, etc.
   *
   * @returns The GameRuntime instance or null if not loaded
   */
  getRuntime(): GameRuntime | null {
    return this.runtime;
  }

  /**
   * Get the input manager (for programmatic input control).
   *
   * @returns The input manager or null if not created
   */
  getInputManager(): InputManager | HeadlessInputManager | null {
    return this.inputManager;
  }

  /**
   * Check if a game is currently loaded.
   */
  get isLoaded(): boolean {
    return this.runtime !== null;
  }

  /**
   * Check if the game loop is running.
   */
  get isRunning(): boolean {
    return this.runtime?.isRunning ?? false;
  }

  /**
   * Get the current tick count.
   */
  get tickCount(): number {
    return this.runtime?.tickCount ?? 0;
  }

  /**
   * Destroy the embed and clean up all resources.
   *
   * Stops the game loop, destroys input managers, and releases
   * all references. The embed instance should not be used after
   * calling destroy().
   */
  destroy(): void {
    this.runtime?.stop();
    this.destroyInput();
    this.runtime = null;
  }

  /**
   * Create input manager based on configuration.
   */
  private createInputManager(config: GameEmbedInputConfig): void {
    if (config.type === 'headless') {
      const headless = new HeadlessInputManager();
      headless.enable();
      if (config.preset) {
        headless.setPreset(config.preset);
      }
      this.inputManager = headless;
      this.inputProvider = headless.asInputProvider();
      return;
    }

    // Default: keyboard/gamepad/mouse input
    const options = {
      cellSize: config.cellSize ?? 24,
      cellGap: config.cellGap ?? 0,
      bufferInput: config.bufferInput ?? false,
      directionMode: config.directionMode ?? ('continuous' as const),
      preset: config.preset ?? 'classic',
    };

    const manager = new InputManager(this.container, null, options);
    manager.enableKeyboard().enableBuffering(true);

    this.inputManager = manager;
    this.inputProvider = new WebInputProvider(manager);

    // Apply preset from config to the provider (mapping happens in provider, not manager)
    if (config.preset) {
      (this.inputProvider as WebInputProvider).setPreset(config.preset);
    }
  }

  /**
   * Destroy input manager and provider.
   */
  private destroyInput(): void {
    if (this.inputManager) {
      if (this.inputManager instanceof InputManager) {
        this.inputManager.destroy();
      } else {
        this.inputManager.cleanup();
      }
      this.inputManager = null;
    }

    if (this.inputProvider && 'destroy' in this.inputProvider) {
      (this.inputProvider as WebInputProvider).destroy();
    }
    this.inputProvider = null;
  }

  /**
   * Validate game configuration.
   *
   * @param config - Game configuration to validate
   * @returns Array of validation errors (empty if valid)
   */
  static validate(config: GameConfig): string[] {
    const errors: string[] = [];

    if (!config.scenes || config.scenes.length === 0) {
      errors.push('Config must contain at least one scene');
    }

    if (config.initialScene && config.scenes) {
      const hasInitial = config.scenes.some((s) => s.id === config.initialScene);
      if (!hasInitial) {
        errors.push(`Initial scene "${config.initialScene}" not found in scenes array`);
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
            // Skip comment/section objects
            if (
              !entity.type ||
              entity.x === undefined ||
              entity.y === undefined ||
              entity.layer === undefined
            ) {
              continue;
            }

            if (entity.x < 0 || entity.x >= scene.width) {
              errors.push(
                `Scene "${scene.id}" entity ${i} (${entity.type}): x=${entity.x} out of bounds`
              );
            }
            if (entity.y < 0 || entity.y >= scene.height) {
              errors.push(
                `Scene "${scene.id}" entity ${i} (${entity.type}): y=${entity.y} out of bounds`
              );
            }
            if (entity.layer < 0 || entity.layer > 8) {
              errors.push(
                `Scene "${scene.id}" entity ${i} (${entity.type}): layer=${entity.layer} invalid`
              );
            }
          }
        }
      }
    }

    return errors;
  }
}
