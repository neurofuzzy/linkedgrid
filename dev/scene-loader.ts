import {
  GameRuntime,
  GameRuntimeConfig,
} from '../packages/spartan/core/game-runtime';
import { GameManager } from '../packages/spartan/core/game-manager';
import { TeleporterSystem } from '../packages/spartan/systems/teleporter.system';
import { CollectionSystem } from '../packages/spartan/systems/collection.system';
import { DoorSystem } from '../packages/spartan/systems/door.system';
import { PlayerInputSystem } from '../packages/spartan/systems/player-input.system';
import { FloorEffectSystem } from '../packages/spartan/systems/floor-effect.system';
import { ExplosionSystem } from '../packages/spartan/systems/explosion.system';
import { PoisonSystem } from '../packages/spartan/systems/poison.system';
import { FireSystem } from '../packages/spartan/systems/fire.system';
import { LiquidSystem } from '../packages/spartan/systems/liquid.system';
import { ChainReactionSystem } from '../packages/spartan/systems/chain-reaction.system';
import { SignalSystem } from '../packages/spartan/systems/signal.system';
import { GateSystem } from '../packages/spartan/systems/gate.system';
import type { GameSystem } from '../packages/spartan/core/types';
import type { EntityData } from '../packages/spartan/entities/entity.types';
import {
  isPlayer,
  isEnemy,
  isTeleporter,
  hasHealth,
  hasAI,
  hasTeleportTarget,
  hasPropagation,
  hasTemperature,
} from '../packages/spartan/traits/trait-guards';
import {
  InputManager,
  HeadlessInputManager,
  WebInputProvider,
} from '../packages/spartan-web/input';

/**
 * Entity definition in JSON scene.
 */
export interface EntityDefinition {
  type: string;
  x: number;
  y: number;
  layer: number;
  data?: Record<string, unknown>;
  props?: Record<string, unknown>; // DEPRECATED: Use 'data' instead
}

/**
 * Scene definition in JSON config.
 */
export interface SceneDefinition {
  id: string;
  name?: string;
  width: number;
  height: number;
  entities?: EntityDefinition[];
  metadata?: Record<string, unknown>;
}

/**
 * Complete scene configuration file format.
 */
export interface SceneConfig {
  scenes: SceneDefinition[];
  initialScene: string;
  systems?: string[];
  tickRate?: number;
  input?: {
    type: 'keyboard' | 'headless' | 'none';
    options?: {
      bufferInput?: boolean;
      directionMode?: 'continuous' | 'tap';
      cellSize?: number;
      cellGap?: number;
    };
  };
}

/**
 * System factory function type.
 */
type SystemFactory = (gameManager: GameManager) => GameSystem;

/**
 * System registry for mapping string names to system constructors.
 * Add new systems here as they're implemented.
 */
const SYSTEM_REGISTRY: Record<string, SystemFactory> = {
  TeleporterSystem: (gameManager) => new TeleporterSystem(gameManager),
  CollectionSystem: (gameManager) => new CollectionSystem(gameManager),
  DoorSystem: (gameManager) => new DoorSystem(gameManager),
  FloorEffectSystem: (gameManager) => new FloorEffectSystem(gameManager),
  ExplosionSystem: () => new ExplosionSystem(),
  PoisonSystem: (gameManager) => new PoisonSystem(gameManager),
  FireSystem: () => new FireSystem(),
  LiquidSystem: () => new LiquidSystem(),
  ChainReactionSystem: () => new ChainReactionSystem(),
  SignalSystem: (gameManager) => new SignalSystem(gameManager),
  GateSystem: (gameManager) => new GateSystem(gameManager),
};

/**
 * SceneLoader - Parse JSON scene configs and initialize GameRuntime.
 *
 * Handles:
 * - Creating GameRuntime with initial scene
 * - Adding additional scenes to SceneManager
 * - Spawning entities in each scene
 * - Registering systems by name
 *
 * @example
 * ```typescript
 * const loader = new SceneLoader();
 * const config = await fetch('/dev/games/basic.json').then(r => r.json());
 * const runtime = loader.load(config);
 * runtime.start();
 * ```
 */
export class SceneLoader {
  constructor(private container?: HTMLElement | null) { }

  /**
   * Load scene configuration and create initialized GameRuntime.
   *
   * @param config - Scene configuration from JSON
   * @returns Initialized GameRuntime ready to start
   */
  load(config: SceneConfig): GameRuntime {
    if (!config.scenes || config.scenes.length === 0) {
      throw new Error('Scene config must contain at least one scene');
    }

    // Find initial scene
    const initialSceneId = config.initialScene || config.scenes[0].id;
    const initialScene = config.scenes.find((s) => s.id === initialSceneId);

    if (!initialScene) {
      throw new Error(`Initial scene "${initialSceneId}" not found in config`);
    }

    // Create runtime with initial scene (empty)
    const runtimeConfig: GameRuntimeConfig = {
      initialScene: {
        id: initialScene.id,
        width: initialScene.width,
        height: initialScene.height,
        metadata: {
          ...initialScene.metadata,
          name: initialScene.name,
        },
      },
      systems: [], // Will be populated below
      tickRate: config.tickRate || 10,
    };

    const runtime = GameRuntime.new(runtimeConfig);

    // Create and populate initial scene
    this.populateScene(runtime, initialScene);

    // Create additional scenes
    for (const sceneDef of config.scenes) {
      if (sceneDef.id !== initialSceneId) {
        runtime.game.sceneManager.createScene(
          sceneDef.id,
          sceneDef.width,
          sceneDef.height,
          {
            ...sceneDef.metadata,
            name: sceneDef.name,
          }
        );

        this.populateScene(runtime, sceneDef);
      }
    }

    // Create input manager and register PlayerInputSystem FIRST
    // This ensures PlayerInputSystem runs before other systems can react to move intents
    if (config.input && config.input.type !== 'none') {
      const { manager, cleanup } = this.createInputManager(
        config.input,
        this.container
      );

      // Create InputProvider - use WebInputProvider for DOM-based input, simple adapter for headless
      const inputProvider = manager instanceof InputManager
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
      const playerInputSystem = new PlayerInputSystem(runtime.game, inputProvider);
      runtime.addSystem(playerInputSystem);

      // Store references for external access
      runtime.inputManager = manager;
      runtime.inputCleanup = cleanup;
    }

    // Register other systems AFTER PlayerInputSystem
    // This allows systems like DoorSystem to react to staged move intents
    if (config.systems && config.systems.length > 0) {
      for (const systemName of config.systems) {
        const systemFactory = SYSTEM_REGISTRY[systemName];
        if (!systemFactory) {
          console.warn(`Unknown system: ${systemName}`);
          continue;
        }

        const system = systemFactory(runtime.game);
        // Add to both systems array (persists across scene transitions) and gameLoop
        runtime.addSystem(system);
      }
    }

    // Initialize cell masks for all pre-spawned entities
    // This ensures BLOCKING and VISION_BLOCKING masks are set correctly
    runtime.spatial.syncMasks();

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
    config: SceneConfig['input'],
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
      cellSize: inputConfig.options?.cellSize || 24,
      cellGap: inputConfig.options?.cellGap || 0,
      bufferInput: inputConfig.options?.bufferInput || false,
      directionMode:
        inputConfig.options?.directionMode || ('continuous' as const),
    };

    const manager = new InputManager(container ?? null, null, options);
    manager.enableKeyboard().enableBuffering(true);

    return {
      manager,
      cleanup: () => manager.destroy(),
    };
  }

  /**
   * Populate a scene with entities from definition.
   *
   * @param runtime - GameRuntime instance
   * @param sceneDef - Scene definition with entities
   */
  private populateScene(runtime: GameRuntime, sceneDef: SceneDefinition): void {
    const scene = runtime.game.sceneManager.getScene(sceneDef.id);
    if (!scene) {
      throw new Error(`Scene ${sceneDef.id} not found`);
    }

    const entities = sceneDef.entities || [];
    let playerId: number | null = null;

    // Spawn all entities
    for (const entityDef of entities) {
      // Skip comment/section objects (used for documentation in JSON files)
      if (!entityDef.type || entityDef.x === undefined || entityDef.y === undefined || entityDef.layer === undefined) {
        continue;
      }

      // Validate schema: Check for common mistake of using 'props' instead of 'data'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((entityDef as any).props && !entityDef.data) {
        console.error(
          `[SceneLoader] ❌ SCHEMA ERROR: Entity '${entityDef.type}' at (${entityDef.x}, ${entityDef.y}) in scene '${sceneDef.id}' uses 'props' instead of 'data'.\n` +
          `  → FIX: Change "props": {...} to "data": {...} in your JSON file.\n` +
          `  → Properties will NOT be loaded until this is fixed!`
        );
        // Fallback to support legacy JSON
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entityDef.data = (entityDef as any).props;
      }

      // Add sceneId to entity data
      const entityData = {
        ...(entityDef.data || {}),
        sceneId: scene.id,
      };

      // Validate entity data using trait guards
      // Cast type to EntityData - JSON provides string type but EntityData expects literal union
      const tempEntityForValidation = {
        id: 0,
        type: entityDef.type,
        ...entityData,
      } as EntityData;

      // Validate required traits for known entity types
      if (isPlayer(tempEntityForValidation)) {
        if (!hasHealth(tempEntityForValidation)) {
          console.warn(
            `[SceneLoader] Player entity in scene '${sceneDef.id}' at (${entityDef.x}, ${entityDef.y}) is missing health properties (hp, maxHp). This may cause runtime errors.`
          );
        }
      }

      if (isEnemy(tempEntityForValidation)) {
        if (!hasHealth(tempEntityForValidation)) {
          console.warn(
            `[SceneLoader] Enemy entity in scene '${sceneDef.id}' at (${entityDef.x}, ${entityDef.y}) is missing health properties (hp, maxHp).`
          );
        }
        if (!hasAI(tempEntityForValidation)) {
          console.warn(
            `[SceneLoader] Enemy entity in scene '${sceneDef.id}' at (${entityDef.x}, ${entityDef.y}) is missing AI properties (aiState).`
          );
        }
      }

      if (isTeleporter(tempEntityForValidation)) {
        if (!hasTeleportTarget(tempEntityForValidation)) {
          console.warn(
            `[SceneLoader] Teleporter entity in scene '${sceneDef.id}' at (${entityDef.x}, ${entityDef.y}) is missing teleport target (targetKey).`
          );
        }
      }

      // Validate propagation properties for fire, water, etc.
      // Use entityDef.type (raw JSON string) since EntityData union uses different names (e.g. 'fire-visual' not 'fire')
      if (
        entityDef.type === 'fire' ||
        entityDef.type === 'fire-visual' ||
        entityDef.type === 'water' ||
        entityDef.type === 'poison-gas'
      ) {
        if (!hasPropagation(tempEntityForValidation)) {
          console.warn(
            `[SceneLoader] ${entityDef.type} entity in scene '${sceneDef.id}' at (${entityDef.x}, ${entityDef.y}) is missing propagation properties.\n` +
            `  → Required: propagationType, spreadRate, spreadLayer, spreadType\n` +
            `  → Optional: spreadProbability, maxDistance, lifetime, blockedByLayers`
          );
        } else {
          // Validate that spreadType is set
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const propData = tempEntityForValidation as any;
          if (!propData.spreadType) {
            console.warn(
              `[SceneLoader] ${entityDef.type} entity in scene '${sceneDef.id}' at (${entityDef.x}, ${entityDef.y}) has propagation but is missing 'spreadType' property.\n` +
              `  → This will cause spawned entities to have type 'undefined'!`
            );
          }
        }
      }

      // Validate temperature for grass, gasoline, fuses
      if (
        entityDef.type === 'grass' ||
        entityDef.type === 'gasoline' ||
        entityDef.type === 'fuse'
      ) {
        if (!hasTemperature(tempEntityForValidation)) {
          console.warn(
            `[SceneLoader] ${entityDef.type} entity in scene '${sceneDef.id}' at (${entityDef.x}, ${entityDef.y}) is missing temperature properties (temperature, flammable, flamePoint).`
          );
        }
      }

      const id = scene.spatial.spawn(
        entityDef.type,
        entityDef.x,
        entityDef.y,
        entityDef.layer,
        entityData
      );

      // Track player entity
      if (entityDef.type === 'player') {
        playerId = id;
      }
    }

    // Commit all spawns
    scene.spatial.commit();

    // Set player entity ID in game state (if player was spawned in initial scene)
    if (
      playerId !== null &&
      sceneDef.id === runtime.game.sceneManager.getActiveScene()?.id
    ) {
      runtime.game.gameState.playerEntityId = playerId;
    }
  }

  /**
   * Validate scene configuration.
   *
   * @param config - Scene configuration to validate
   * @returns Array of validation errors (empty if valid)
   */
  static validate(config: SceneConfig): string[] {
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
            if (entity.x < 0 || entity.x >= scene.width) {
              errors.push(
                `Scene "${scene.id}" entity ${i}: x=${entity.x} out of bounds (0-${scene.width - 1})`
              );
            }
            if (entity.y < 0 || entity.y >= scene.height) {
              errors.push(
                `Scene "${scene.id}" entity ${i}: y=${entity.y} out of bounds (0-${scene.height - 1})`
              );
            }
            if (entity.layer < 0 || entity.layer > 7) {
              errors.push(
                `Scene "${scene.id}" entity ${i}: layer=${entity.layer} invalid (must be 0-7)`
              );
            }
          }
        }
      }
    }

    // Validate systems
    if (config.systems) {
      for (const systemName of config.systems) {
        if (!SYSTEM_REGISTRY[systemName]) {
          errors.push(`Unknown system: "${systemName}"`);
        }
      }
    }

    return errors;
  }
}
