/**
 * SceneLoader - Thin wrapper around GameEmbed for dev playground.
 *
 * This is a lightweight adapter that maintains backward compatibility
 * with existing playground code while delegating all work to GameEmbed.
 *
 * For new projects, use GameEmbed directly from 'spartan-web'.
 *
 * @example
 * ```typescript
 * const loader = new SceneLoader(document.getElementById('game'));
 * const config = await fetch('/games/level1.json').then(r => r.json());
 * const runtime = loader.load(config);
 * runtime.start();
 * ```
 */
import {
  GameRuntime,
  GameConfig,
  SceneDefinition,
  EntityDefinition,
} from '../packages/spartan/core/game-runtime';
import { GameEmbed } from '../packages/spartan-web';

// Re-export types for backward compatibility
export type { GameConfig, SceneDefinition, EntityDefinition };

/**
 * @deprecated Use GameConfig from game-runtime.ts instead
 */
export type SceneConfig = GameConfig;

/**
 * SceneLoader - Platform adapter for web-based game loading.
 *
 * This class is now a thin wrapper around GameEmbed. For new code,
 * consider using GameEmbed directly:
 *
 * ```typescript
 * import { GameEmbed } from 'spartan-web';
 *
 * const embed = new GameEmbed(container);
 * embed.load(config);
 * embed.start();
 * ```
 */
export class SceneLoader {
  private embed: GameEmbed;

  constructor(container?: HTMLElement | null) {
    this.embed = new GameEmbed(container ?? null);
  }

  /**
   * Load scene configuration and create initialized GameRuntime.
   *
   * @param config - Scene configuration from JSON
   * @returns Initialized GameRuntime ready to start
   */
  load(config: GameConfig): GameRuntime {
    this.embed.load(config);
    const runtime = this.embed.getRuntime();
    
    if (!runtime) {
      throw new Error('Failed to create GameRuntime');
    }

    return runtime;
  }

  /**
   * Validate scene configuration.
   *
   * @param config - Scene configuration to validate
   * @returns Array of validation errors (empty if valid)
   */
  static validate(config: GameConfig): string[] {
    return GameEmbed.validate(config);
  }
}
