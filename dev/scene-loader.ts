import { GameRuntime, GameRuntimeConfig } from '../packages/spartan/game-runtime';
import { GameLayers } from '../packages/spartan/types';
import { TeleporterSystem } from '../packages/spartan/teleporter-system';
import type { GameSystem } from '../packages/spartan/types';

/**
 * Entity definition in JSON scene.
 */
export interface EntityDefinition {
  type: string;
  x: number;
  y: number;
  layer: number;
  data?: Record<string, unknown>;
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
}

/**
 * System registry for mapping string names to system constructors.
 * Add new systems here as they're implemented.
 */
const SYSTEM_REGISTRY: Record<string, (gameManager: any) => GameSystem> = {
  'TeleporterSystem': (gameManager) => new TeleporterSystem(gameManager),
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
 * const config = await fetch('/dev/scenes/basic.json').then(r => r.json());
 * const runtime = loader.load(config);
 * runtime.start();
 * ```
 */
export class SceneLoader {
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
    const initialScene = config.scenes.find(s => s.id === initialSceneId);
    
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
          name: initialScene.name
        }
      },
      systems: [], // Will be populated below
      tickRate: config.tickRate || 10
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
            name: sceneDef.name
          }
        );
        
        this.populateScene(runtime, sceneDef);
      }
    }
    
    // Register systems
    if (config.systems && config.systems.length > 0) {
      for (const systemName of config.systems) {
        const systemFactory = SYSTEM_REGISTRY[systemName];
        if (!systemFactory) {
          console.warn(`Unknown system: ${systemName}`);
          continue;
        }
        
        const system = systemFactory(runtime.game);
        // Add to both systems array (persists across scene transitions) and gameLoop
        (runtime as any).systems.push(system);
        (runtime as any).gameLoop.addSystem(system);
      }
    }
    
    return runtime;
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
      // Add sceneId to entity data
      const entityData = {
        ...(entityDef.data || {}),
        sceneId: scene.id
      };
      
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
    if (playerId !== null && sceneDef.id === runtime.game.sceneManager.getActiveScene()?.id) {
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
      const hasInitial = config.scenes.some(s => s.id === config.initialScene);
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
            if (entity.x < 0 || entity.x >= scene.width) {
              errors.push(`Scene "${scene.id}" entity ${i}: x=${entity.x} out of bounds (0-${scene.width - 1})`);
            }
            if (entity.y < 0 || entity.y >= scene.height) {
              errors.push(`Scene "${scene.id}" entity ${i}: y=${entity.y} out of bounds (0-${scene.height - 1})`);
            }
            if (entity.layer < 0 || entity.layer > 7) {
              errors.push(`Scene "${scene.id}" entity ${i}: layer=${entity.layer} invalid (must be 0-7)`);
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
