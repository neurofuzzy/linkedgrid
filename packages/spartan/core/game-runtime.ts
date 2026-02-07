/**
 * @brief Real-time execution environment with fixed timestep loop.
 */
import { GameManager, type SaveData } from './game-manager';
import { GameLoop } from './game-loop';
import { Scene } from './scene';
import { SpatialSystem } from './spatial-system';
import type { GameSystem } from './types';
import { hasSceneConnection } from '../traits/trait-guards';
import { Direction } from './grid/direction';

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
 * Entity definition in JSON game configuration.
 */
export interface EntityDefinition {
  type: string;
  x: number;
  y: number;
  layer: number;
  data?: Record<string, unknown>;
}

/**
 * Scene definition in JSON game configuration.
 */
export interface SceneDefinition {
  id: string;
  name?: string;
  width: number;
  height: number;
  entities?: EntityDefinition[];
  metadata?: Record<string, unknown>;
  /** Explicit edge adjacencies: direction → neighborSceneId */
  adjacencies?: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  };
}

/**
 * Complete game configuration with scenes, entities, and systems.
 * Used by GameRuntime.fromConfig() to load JSON-based games.
 */
/**
 * Objective definition in JSON game configuration.
 */
export interface ObjectiveConfig {
  /** Unique objective identifier */
  id: string;
  /** Objective type: collect all flags, kill all enemies, or reach exit */
  type: 'collect-flag' | 'kill-all' | 'reach-exit';
  /** Scene this objective applies to */
  sceneId: string;
  /** For collect-flag: the objectiveId on flag entities to collect */
  targetId?: string;
}

export interface GameConfig {
  /** Optional description shown in playground */
  description?: string;
  /** ID of the starting scene */
  initialScene: string;
  /** System names to instantiate */
  systems?: string[];
  /** Ticks per second (default: 10) */
  tickRate?: number;
  /**
   * Input configuration (platform-specific)
   *
   * @example
   * ```typescript
   * input: {
   *   type: 'keyboard',
   *   preset: 'twin-stick',  // 'classic' | 'twin-stick' | 'separated'
   *   options: { bufferInput: true }
   * }
   * ```
   */
  input?: {
    type: 'keyboard' | 'headless' | 'none';
    /** Input preset for mapping controls (default: 'classic') */
    preset?: 'classic' | 'twin-stick' | 'separated';
    options?: Record<string, unknown>;
  };
  /** Scene definitions */
  scenes: SceneDefinition[];
  /** Game objectives (tracked by ObjectiveSystem) */
  objectives?: ObjectiveConfig[];
}

import type { InputProvider } from './input-provider';
export type { InputProvider } from './input-provider';

import { createAllSystems } from './system-registry';

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

  // Optional input manager attached by SceneLoader
  public inputManager?: unknown;
  public inputCleanup?: () => void;

  // Optional input provider for beginFrame() calls
  private inputProvider?: InputProvider;

  private constructor(
    game: GameManager,
    systems: GameSystem[],
    tickRate: number,
    initialConfig: GameRuntimeConfig,
    initialTickCount = 0,
    inputProvider?: InputProvider
  ) {
    this.game = game;
    this.systems = systems;
    this.tickInterval = 1000 / tickRate;
    this.initialConfig = initialConfig;
    this._tickCount = initialTickCount;
    this.inputProvider = inputProvider;

    // Initialize loop for active scene
    const activeScene = game.sceneManager.getActiveScene();
    if (!activeScene) {
      throw new Error('No active scene');
    }
    this.gameLoop = new GameLoop(activeScene.spatial, game);
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
   * Create a game from complete JSON configuration.
   *
   * Three-phase initialization:
   * 1. STRUCTURE - Create all scenes (empty grids)
   * 2. HYDRATION - Spawn all entities across all scenes
   * 3. GLOBAL INDEXING - Register scene connections (teleporters, etc.)
   *
   * This ensures GameState.connections is populated before first tick.
   *
   * All game systems are automatically initialized using the built-in
   * system registry. Pass an InputProvider to enable player-controlled
   * systems (PlayerInputSystem, MeleeSystem, PlayerWeaponSystem).
   *
   * @param config - Complete game configuration from JSON
   * @param inputProvider - Optional input provider for player-controlled systems
   * @returns GameRuntime ready to start
   *
   * @example
   * ```typescript
   * const config = JSON.parse(fs.readFileSync('level.json'));
   * const runtime = GameRuntime.fromConfig(config, inputProvider);
   * runtime.start();
   * ```
   */
  static fromConfig(
    config: GameConfig,
    inputProvider?: InputProvider
  ): GameRuntime {
    const game = new GameManager();

    // === PHASE 1: STRUCTURE ===
    // Create all scenes (empty grids)
    for (const sceneDef of config.scenes) {
      game.sceneManager.createScene(
        sceneDef.id,
        sceneDef.width,
        sceneDef.height,
        {
          ...sceneDef.metadata,
          name: sceneDef.name,
        }
      );
    }

    // === PHASE 2: HYDRATION ===
    // Spawn all entities across all scenes
    let playerId: number | null = null;
    const initialSceneId = config.initialScene || config.scenes[0]?.id;

    for (const sceneDef of config.scenes) {
      const scene = game.sceneManager.getScene(sceneDef.id);
      if (!scene) {
        throw new Error(`Scene "${sceneDef.id}" not found after creation`);
      }

      for (const entityDef of sceneDef.entities || []) {
        // Skip comment/section objects (used for documentation in JSON files)
        if (
          !entityDef.type ||
          entityDef.x === undefined ||
          entityDef.y === undefined ||
          entityDef.layer === undefined
        ) {
          continue;
        }

        // Handle legacy 'props' field (deprecated, use 'data' instead)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawDef = entityDef as any;
        if (rawDef.props && !entityDef.data) {
          console.error(
            `[GameRuntime.fromConfig] SCHEMA ERROR: Entity '${entityDef.type}' at (${entityDef.x}, ${entityDef.y}) in scene '${sceneDef.id}' uses 'props' instead of 'data'.\n` +
            `  FIX: Change "props": {...} to "data": {...} in your JSON file.`
          );
          // Fallback to props for backward compatibility
          entityDef.data = rawDef.props;
        }

        // Add sceneId to entity data
        const entityData = {
          ...(entityDef.data || {}),
          sceneId: sceneDef.id,
        };

        const id = scene.spatial.spawn(
          entityDef.type,
          entityDef.x,
          entityDef.y,
          entityDef.layer,
          entityData
        );

        // Track player entity (only in initial scene)
        if (entityDef.type === 'player' && sceneDef.id === initialSceneId) {
          playerId = id;
        }
      }

      // Commit all spawns for this scene
      scene.spatial.commit();
    }

    // === PHASE 2b: CHAIN FOLLOW WIRING ===
    // Wire chainFollowTargetId for chain segments based on chainId + chainIndex.
    // JSON entities cannot reference entity IDs at definition time, so we resolve
    // follow targets here by matching chainId and linking chainIndex N to N-1.
    for (const sceneDef of config.scenes) {
      const scene = game.sceneManager.getScene(sceneDef.id);
      if (!scene) continue;

      // Collect chain segments grouped by chainId
      const chains = new Map<string, Array<{ entityId: number; chainIndex: number }>>();

      for (const [entityId] of scene.spatial.getAllPositions()) {
        const data = scene.spatial.getEntityData(entityId);
        if (!data || typeof data.chainId !== 'string') continue;
        const chainId = data.chainId as string;
        const chainIndex = (data.chainIndex as number) ?? 0;

        if (!chains.has(chainId)) {
          chains.set(chainId, []);
        }
        chains.get(chainId)!.push({ entityId, chainIndex });
      }

      // Wire follow targets: segment N follows segment N-1
      for (const [, segments] of chains) {
        segments.sort((a, b) => a.chainIndex - b.chainIndex);
        for (let i = 1; i < segments.length; i++) {
          const followerData = game.gameState.entityStore.getData(segments[i].entityId);
          if (followerData && followerData.chainFollowTargetId === undefined) {
            game.gameState.entityStore.setData(segments[i].entityId, {
              chainFollowTargetId: segments[i - 1].entityId,
            });
          }
        }
      }
    }

    // Set player entity ID - warn if missing (some test scenarios don't need a player)
    if (playerId === null) {
      console.warn(
        `[GameRuntime.fromConfig] No player entity found in initial scene "${initialSceneId}". ` +
        `Game will start with playerEntityId=0.`
      );
    } else {
      game.gameState.playerEntityId = playerId;
    }

    // Track initial scene for fallback respawn (when no checkpoint)
    game.gameState.initialSceneId = initialSceneId;

    // === PHASE 3: GLOBAL INDEXING ===
    // Register scene connections (teleporters, linked switches, etc.)
    let connectionCount = 0;
    for (const sceneDef of config.scenes) {
      const scene = game.sceneManager.getScene(sceneDef.id);
      if (!scene) continue;

      for (const entityDef of sceneDef.entities || []) {
        if (!entityDef.type) continue;

        // Find the spawned entity at this location
        const entityId = scene.spatial.getEntityIdAt(
          entityDef.x,
          entityDef.y,
          entityDef.layer
        );

        if (entityId === null || entityId === undefined) continue;

        const entityData = scene.spatial.getEntityData(entityId);
        if (!entityData) continue;

        // Check for scene connection trait
        if (hasSceneConnection(entityData)) {
          game.gameState.addConnection(
            entityData.connectionKey,
            sceneDef.id,
            entityDef.x,
            entityDef.y,
            entityDef.layer
          );
          connectionCount++;
        }
      }
    }

    // Validation: warn about orphaned connections
    if (connectionCount > 0) {
      const allConnections = game.gameState.getAllConnections();
      for (const [key, endpoints] of allConnections) {
        if (endpoints.length === 1) {
          console.warn(
            `[GameRuntime.fromConfig] Connection "${key}" has only 1 endpoint - ` +
            `portal at ${endpoints[0].sceneId}(${endpoints[0].x},${endpoints[0].y}) has no destination!`
          );
        }
      }
    }

    // === PHASE 3b: ADJACENCIES ===
    // Index scene adjacencies for edge-based scene transitions
    const directionMap: Record<string, number> = {
      north: Direction.UP,
      south: Direction.DOWN,
      east: Direction.RIGHT,
      west: Direction.LEFT,
    };

    for (const sceneDef of config.scenes) {
      if (!sceneDef.adjacencies) continue;

      const sceneAdj = new Map<number, string>();
      for (const [dirName, neighborId] of Object.entries(sceneDef.adjacencies)) {
        if (neighborId && directionMap[dirName] !== undefined) {
          sceneAdj.set(directionMap[dirName], neighborId);
        }
      }

      if (sceneAdj.size > 0) {
        game.gameState.adjacencies.set(sceneDef.id, sceneAdj);
      }
    }

    // === PHASE 4: OBJECTIVES ===
    // Load objectives into GameState
    if (config.objectives) {
      game.gameState.objectives = config.objectives.map((obj) => ({
        ...obj,
        completed: false,
      }));
    }

    // === PHASE 5: SYSTEM INITIALIZATION ===
    // Use built-in system registry to create all systems
    const systems = createAllSystems(game, inputProvider);

    // Set initial/active scene
    if (!game.sceneManager.setActiveScene(initialSceneId)) {
      throw new Error(`Initial scene "${initialSceneId}" not found`);
    }

    // Initialize cell masks for all pre-spawned entities in all scenes
    for (const sceneDef of config.scenes) {
      const scene = game.sceneManager.getScene(sceneDef.id);
      if (scene) {
        scene.spatial.syncMasks();
      }
    }

    // Create minimal config for GameRuntime constructor
    const runtimeConfig: GameRuntimeConfig = {
      initialScene: {
        id: initialSceneId,
        width: config.scenes.find((s) => s.id === initialSceneId)?.width || 10,
        height:
          config.scenes.find((s) => s.id === initialSceneId)?.height || 10,
      },
      systems,
      tickRate: config.tickRate || 10,
    };

    return new GameRuntime(game, systems, config.tickRate || 10, runtimeConfig, 0, inputProvider);
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
    saveData: SaveData,
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
   * Add a system to the runtime.
   *
   * The system will be:
   * 1. Added to the persistent systems list (restored on scene transition)
   * 2. Registered with the current game loop immediately
   *
   * @param system - Game system to add
   */
  public addSystem(system: GameSystem): void {
    this.systems.push(system);
    this.gameLoop.addSystem(system);
  }

  /**
   * Add a system to the start of the execution list.
   *
   * @param system - Game system to add (e.g. PlayerInputSystem)
   */
  public prependSystem(system: GameSystem): void {
    this.systems.unshift(system);
    this.gameLoop.prependSystem(system);
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

    // 0. Begin input frame (caches input state for this tick)
    if (this.inputProvider?.beginFrame) {
      this.inputProvider.beginFrame();
    }

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
  save(): SaveData {
    const wasRunning = this._isRunning;
    if (wasRunning) {
      this.stop();
    }

    const saveData: SaveData = {
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
    const newGame = new GameManager();
    // Need to update readonly field via object mutation
    Object.assign(this, { game: newGame });

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
      this.gameLoop = new GameLoop(activeScene.spatial, this.game);
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
   * Get the FreeBodyStore for off-grid entities (projectiles, flying entities).
   *
   * Owned by the active GameLoop. Recreated on scene transitions.
   *
   * @returns FreeBodyStore from the current game loop
   */
  get freeBody(): import('./free-body-store').FreeBodyStore {
    return this.gameLoop.freeBody;
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

      // 0. Begin input frame (caches input state for this tick)
      if (this.inputProvider?.beginFrame) {
        this.inputProvider.beginFrame();
      }

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
    this.gameLoop = new GameLoop(newScene.spatial, this.game);
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
