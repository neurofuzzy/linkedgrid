import {
  GameRuntime,
  GameConfig,
  SceneDefinition,
  EntityDefinition,
  SystemFactory,
} from '../packages/spartan/core/game-runtime';
import { GameManager } from '../packages/spartan/core/game-manager';
import { TeleporterSystem } from '../packages/spartan/systems/teleporter.system';
import { CollectionSystem } from '../packages/spartan/systems/collection.system';
import { DoorSystem } from '../packages/spartan/systems/door.system';
import { PlayerInputSystem } from '../packages/spartan/systems/player-input.system';
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
import {
  InputManager,
  HeadlessInputManager,
  WebInputProvider,
} from '../packages/spartan-web/input';

// Re-export types for backward compatibility
export type { GameConfig, SceneDefinition, EntityDefinition };

/**
 * @deprecated Use GameConfig from game-runtime.ts instead
 */
export type SceneConfig = GameConfig;

/**
 * System factory for web playground.
 * Maps system names to instances with dependency injection.
 *
 * This is application-specific and should NOT be in the core package.
 */
const createSystemByName: SystemFactory = (
  name: string,
  gameManager: GameManager,
  createdSystems: Map<string, GameSystem>
): GameSystem | null => {
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
      return new HealthSystem();

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
      let healthSystem = createdSystems.get('HealthSystem') as
        | HealthSystem
        | undefined;
      if (!healthSystem) {
        healthSystem = new HealthSystem();
        createdSystems.set('HealthSystem', healthSystem);
      }
      return new ProjectileSystem(healthSystem);
    }

    case 'TurretSystem': {
      let healthSystem = createdSystems.get('HealthSystem') as
        | HealthSystem
        | undefined;
      if (!healthSystem) {
        healthSystem = new HealthSystem();
        createdSystems.set('HealthSystem', healthSystem);
      }
      let projectileSystem = createdSystems.get('ProjectileSystem') as
        | ProjectileSystem
        | undefined;
      if (!projectileSystem) {
        projectileSystem = new ProjectileSystem(healthSystem);
        createdSystems.set('ProjectileSystem', projectileSystem);
      }
      return new TurretSystem(healthSystem, projectileSystem);
    }

    case 'SpawningSystem':
      return new SpawningSystem(gameManager);

    default:
      return null;
  }
};

/**
 * List of known system names for validation.
 */
const KNOWN_SYSTEMS = [
  'PushSystem',
  'TeleporterSystem',
  'CollectionSystem',
  'DoorSystem',
  'FloorEffectSystem',
  'ExplosionSystem',
  'HealthSystem',
  'PoisonSystem',
  'FireSystem',
  'LiquidSystem',
  'ChainReactionSystem',
  'SignalSystem',
  'GateSystem',
  'NPCMovementSystem',
  'ProjectileSystem',
  'TurretSystem',
  'SpawningSystem',
];

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
    // Validate config before loading
    const errors = SceneLoader.validate(config);
    if (errors.length > 0) {
      throw new Error(
        `Invalid scene config:\n${errors.map((e) => `  - ${e}`).join('\n')}`
      );
    }

    // Delegate to package-native loader
    const runtime = GameRuntime.fromConfig(config, createSystemByName);

    // Create platform-specific input provider and attach PlayerInputSystem
    if (config.input && config.input.type !== 'none') {
      const { manager, cleanup } = this.createInputManager(
        config.input,
        this.container
      );

      // Create InputProvider - use WebInputProvider for DOM-based input, simple adapter for headless
      const inputProvider =
        manager instanceof InputManager
          ? new WebInputProvider(manager)
          : {
              // Headless mode: simple adapter
              getDirection: () => manager.getState().direction,
              getAction: () => manager.getState().action,
              getSecondary: () => manager.getState().secondary,
              getStart: () => manager.getState().start,
              getRestart: () => manager.getState().restart,
              destroy: cleanup,
            };

      // Create and register PlayerInputSystem
      // Runs FIRST to stage movement intents before reactive systems
      const playerInputSystem = new PlayerInputSystem(
        runtime.game,
        inputProvider
      );
      runtime.addSystem(playerInputSystem);

      // Store references for external access
      runtime.inputManager = manager;
      runtime.inputCleanup = cleanup;
    }

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
    config: GameConfig['input'],
    container?: HTMLElement | null
  ): { manager: InputManager | HeadlessInputManager; cleanup: () => void } {
    const inputConfig = config || { type: 'keyboard' as const };

    if (inputConfig.type === 'headless' || inputConfig.type === 'none') {
      const headless = new HeadlessInputManager();
      if (inputConfig.type === 'headless') {
        headless.enable();
      }
      return {
        manager: headless,
        cleanup: () => headless.cleanup(),
      };
    }

    // keyboard/gamepad/mouse
    const options = {
      cellSize: (inputConfig.options?.cellSize as number) || 24,
      cellGap: (inputConfig.options?.cellGap as number) || 0,
      bufferInput: (inputConfig.options?.bufferInput as boolean) || false,
      directionMode:
        (inputConfig.options?.directionMode as 'continuous' | 'tap') ||
        ('continuous' as const),
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
          errors.push(
            `Scene "${scene.id}" has invalid height: ${scene.height}`
          );
        }

        // Validate entities
        if (scene.entities) {
          for (let i = 0; i < scene.entities.length; i++) {
            const entity = scene.entities[i];
            // Skip comment/section objects
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

    // Validate systems
    if (config.systems) {
      for (const systemName of config.systems) {
        if (!KNOWN_SYSTEMS.includes(systemName)) {
          errors.push(`Unknown system: "${systemName}"`);
        }
      }
    }

    return errors;
  }
}
