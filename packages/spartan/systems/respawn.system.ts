/**
 * Respawn System - Handles player death and respawning at checkpoints.
 *
 * Monitors player health state and respawns at the last activated checkpoint.
 * Supports cross-scene respawning and life tracking.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import { isEntityDead, isCheckpoint, isPlayerStart, hasCheckpoint } from '../traits/trait-guards';
import { GameLayers } from '../config/layers.config';

/**
 * RespawnSystemConfig - Configuration options for respawn behavior.
 */
export interface RespawnSystemConfig {
  /** Number of ticks to wait before respawning (for death animation) */
  respawnDelay: number;
  /** Maximum number of lives (0 = infinite). Sets GameState.maxLives and GameState.lives on init. */
  maxLives: number;
  /** Callback when player respawns */
  onRespawn?: (context: GameContext, playerId: number) => void;
  /** Callback when game is over (no lives remaining) */
  onGameOver?: (context: GameContext) => void;
}

const DEFAULT_CONFIG: RespawnSystemConfig = {
  respawnDelay: 5,
  maxLives: 3,
};

/**
 * RespawnSystem - Handles player respawning at checkpoints.
 *
 * Key responsibilities:
 * 1. Detect player death (healthState === 'dead')
 * 2. Activate checkpoints on player overlap
 * 3. Find appropriate respawn location (checkpoint or player-start)
 * 4. Execute respawn (same-scene or cross-scene)
 * 5. Track lives and handle game-over
 *
 * @system
 * @reactsTo Player death, checkpoint overlaps
 * @modifies Player position, lives, checkpoint activation state
 *
 * @example
 * ```typescript
 * const respawnSystem = new RespawnSystem(gameManager, {
 *   respawnDelay: 5,
 *   initialLives: 3,
 *   onGameOver: (ctx) => console.log('Game Over!'),
 * });
 * gameLoop.addSystem(respawnSystem);
 * ```
 */
export class RespawnSystem extends BaseReactiveSystem {
  readonly executionPhase = 'post-commit' as const;

  private config: RespawnSystemConfig;

  /** Pending respawn info with cached player data */
  private pendingRespawn: {
    playerId: number;
    targetSceneId: string;
    targetX: number;
    targetY: number;
    respawnTick: number;
    /** Cached player data for respawn */
    cachedPlayerData: {
      maxHp: number;
      damage: number;
      lastCheckpointId?: number;
      lastCheckpointSceneId?: string;
      lastCheckpointX?: number;
      lastCheckpointY?: number;
    };
  } | null = null;

  /** Debug stats */
  private debugStats = {
    respawnsThisSession: 0,
    checkpointsActivated: 0,
  };

  constructor(
    private gameManager: GameManager,
    config: Partial<RespawnSystemConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize GameState lives from config
    // Note: We always set lives from config on construction.
    // To preserve lives across scene reloads, the caller should manage
    // gameState persistence externally before creating new RespawnSystem.
    const gs = this.gameManager.gameState;
    gs.maxLives = this.config.maxLives;
    gs.lives = this.config.maxLives;
  }

  update(context: GameContext): void {
    const currentTick = context.tick ?? 0;

    // Process checkpoint activation
    this.processCheckpointActivation(context);

    // Check for pending respawn
    if (this.pendingRespawn) {
      if (currentTick >= this.pendingRespawn.respawnTick) {
        this.executeRespawn(context);
      }
      return; // Don't process death while respawning
    }

    // Check for player death
    this.checkPlayerDeath(context, currentTick);
  }

  /**
   * Activate checkpoints when player overlaps them.
   */
  private processCheckpointActivation(context: GameContext): void {
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    const playerPos = context.spatial.getEntityPosition(playerId);
    if (!playerPos) return;

    // Check for checkpoint at player position
    const entitiesAtPos = context.spatial.getEntityIdsInCell(playerPos.x, playerPos.y);

    for (const entityId of entitiesAtPos) {
      if (entityId === playerId) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !isCheckpoint(entityData)) continue;

      // Check if already activated
      const checkpointData = entityData as { activated?: boolean; sceneId: string };
      if (checkpointData.activated) continue;

      // Activate checkpoint
      checkpointData.activated = true;
      this.debugStats.checkpointsActivated++;

      // Update player's checkpoint tracking
      const playerData = context.spatial.getEntityData(playerId);
      if (playerData) {
        (playerData as any).lastCheckpointId = entityId;
        (playerData as any).lastCheckpointSceneId = checkpointData.sceneId;
        (playerData as any).lastCheckpointX = playerPos.x;
        (playerData as any).lastCheckpointY = playerPos.y;
      }
    }
  }

  /**
   * Check if player is dead and schedule respawn.
   */
  private checkPlayerDeath(context: GameContext, currentTick: number): void {
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) {
      return;
    }

    const playerData = context.spatial.getEntityData(playerId);
    if (!playerData) {
      return;
    }

    // Check if player is dead
    if (!isEntityDead(playerData)) {
      return;
    }

    // Check lives (use GameState as single source of truth)
    const gameState = this.gameManager.gameState;
    if (this.config.maxLives > 0) {
      gameState.lives--;

      if (gameState.lives <= 0) {
        // Game over
        if (this.config.onGameOver) {
          this.config.onGameOver(context);
        }
        return;
      }
    }

    // Find respawn location
    const respawnInfo = this.findRespawnLocation(context, playerId, playerData);
    if (!respawnInfo) {
      console.warn('No respawn location found for player');
      return;
    }

    // Cache player data for respawn (entity will be removed by HealthSystem)
    const cachedPlayerData = {
      maxHp: (playerData as any).maxHp ?? 100,
      damage: (playerData as any).damage ?? 10,
      lastCheckpointId: (playerData as any).lastCheckpointId,
      lastCheckpointSceneId: (playerData as any).lastCheckpointSceneId,
      lastCheckpointX: (playerData as any).lastCheckpointX,
      lastCheckpointY: (playerData as any).lastCheckpointY,
    };

    // Schedule respawn
    this.pendingRespawn = {
      playerId,
      targetSceneId: respawnInfo.sceneId,
      targetX: respawnInfo.x,
      targetY: respawnInfo.y,
      respawnTick: currentTick + this.config.respawnDelay,
      cachedPlayerData,
    };
  }

  /**
   * Find the appropriate respawn location for the player.
   *
   * Priority order:
   * 1. Last activated checkpoint (may be in different scene)
   * 2. Player-start in initial scene
   * 3. Player-start in any scene
   * 4. Fallback to (1,1) in initial scene
   */
  private findRespawnLocation(
    _context: GameContext,
    _playerId: number,
    playerData: any
  ): { sceneId: string; x: number; y: number } | null {
    // Priority 1: Check for saved checkpoint
    if (hasCheckpoint(playerData) && playerData.lastCheckpointSceneId) {
      return {
        sceneId: playerData.lastCheckpointSceneId,
        x: playerData.lastCheckpointX ?? 0,
        y: playerData.lastCheckpointY ?? 0,
      };
    }

    // Get scene manager and initial scene ID
    const sceneManager = this.gameManager.sceneManager;
    const initialSceneId = this.gameManager.gameState.initialSceneId;

    // Priority 2: Find player-start in initial scene first
    if (initialSceneId) {
      const initialScene = sceneManager.getScene(initialSceneId);
      if (initialScene) {
        const startPos = this.findPlayerStartInScene(initialScene);
        if (startPos) {
          return {
            sceneId: initialSceneId,
            x: startPos.x,
            y: startPos.y,
          };
        }
      }
    }

    // Priority 3: Search all scenes for player-start
    for (const sceneId of sceneManager.getAllSceneIds()) {
      const scene = sceneManager.getScene(sceneId);
      if (!scene) continue;

      const startPos = this.findPlayerStartInScene(scene);
      if (startPos) {
        return {
          sceneId,
          x: startPos.x,
          y: startPos.y,
        };
      }
    }

    // Priority 4: Fallback to (1,1) in initial scene or first available scene
    const fallbackSceneId = initialSceneId || sceneManager.getAllSceneIds()[0] || 'default';
    return {
      sceneId: fallbackSceneId,
      x: 1,
      y: 1,
    };
  }

  /**
   * Find player-start entity in a specific scene.
   */
  private findPlayerStartInScene(scene: { spatial: { getAllPositions(): IterableIterator<[number, { x: number; y: number; layer: number }]>; getEntityData(id: number): any; getEntityPosition(id: number): { x: number; y: number } | null } }): { x: number; y: number } | null {
    for (const [entityId] of scene.spatial.getAllPositions()) {
      const entityData = scene.spatial.getEntityData(entityId);
      if (!entityData || !isPlayerStart(entityData)) continue;

      const pos = scene.spatial.getEntityPosition(entityId);
      if (pos) {
        return { x: pos.x, y: pos.y };
      }
    }
    return null;
  }

  /**
   * Execute the pending respawn.
   *
   * Uses GameManager.spawnPlayerInScene() as the single entry point for
   * player placement, ensuring proper scene transitions and GameLoop rebuilds.
   */
  private executeRespawn(context: GameContext): void {
    if (!this.pendingRespawn) return;

    const { playerId, targetSceneId, targetX, targetY, cachedPlayerData } = this.pendingRespawn;

    // Build respawn data from cached player info (entity was removed by HealthSystem)
    const respawnData = {
      hp: cachedPlayerData.maxHp,
      maxHp: cachedPlayerData.maxHp,
      healthState: 'alive' as const,
      damage: cachedPlayerData.damage,
      inventory: [],
      pushStrength: 1,
      // Preserve checkpoint info
      lastCheckpointId: cachedPlayerData.lastCheckpointId,
      lastCheckpointSceneId: cachedPlayerData.lastCheckpointSceneId,
      lastCheckpointX: cachedPlayerData.lastCheckpointX,
      lastCheckpointY: cachedPlayerData.lastCheckpointY,
    };

    // Use centralized player placement API
    // This handles both same-scene and cross-scene respawns correctly,
    // and queues scene transitions for GameRuntime to rebuild GameLoop
    const success = this.gameManager.spawnPlayerInScene(
      targetSceneId,
      targetX,
      targetY,
      GameLayers.ACTORS,
      respawnData
    );

    if (!success) {
      console.warn(`[RespawnSystem] Failed to spawn player in scene '${targetSceneId}' at (${targetX}, ${targetY})`);
    }

    this.debugStats.respawnsThisSession++;

    // Call respawn callback
    if (this.config.onRespawn) {
      this.config.onRespawn(context, playerId);
    }

    this.pendingRespawn = null;
  }

  /**
   * Get remaining lives from GameState.
   */
  getLives(): number {
    return this.gameManager.gameState.lives;
  }

  /**
   * Add lives to GameState.
   */
  addLives(count: number): void {
    this.gameManager.gameState.lives += count;
  }

  /**
   * Reset lives to max value in GameState.
   */
  resetLives(): void {
    this.gameManager.gameState.lives = this.gameManager.gameState.maxLives;
  }

  public override resetState(): void {
    this.pendingRespawn = null;
    this.debugStats = {
      respawnsThisSession: 0,
      checkpointsActivated: 0,
    };
    // Reset lives in GameState
    this.resetLives();
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      ...this.debugStats,
      currentLives: this.gameManager.gameState.lives,
      maxLives: this.gameManager.gameState.maxLives,
      pendingRespawn: this.pendingRespawn !== null,
      respawnDelay: this.config.respawnDelay,
    };
  }
}
