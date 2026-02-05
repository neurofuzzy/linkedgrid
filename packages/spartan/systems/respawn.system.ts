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
  /** Initial number of lives (0 = infinite) */
  initialLives: number;
  /** Callback when player respawns */
  onRespawn?: (context: GameContext, playerId: number) => void;
  /** Callback when game is over (no lives remaining) */
  onGameOver?: (context: GameContext) => void;
}

const DEFAULT_CONFIG: RespawnSystemConfig = {
  respawnDelay: 5,
  initialLives: 3,
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
    currentLives: 0,
  };

  constructor(
    private gameManager: GameManager,
    config: Partial<RespawnSystemConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.debugStats.currentLives = this.config.initialLives;
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

    // Check lives
    if (this.config.initialLives > 0) {
      this.debugStats.currentLives--;

      if (this.debugStats.currentLives <= 0) {
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
   */
  private findRespawnLocation(
    context: GameContext,
    playerId: number,
    playerData: any
  ): { sceneId: string; x: number; y: number } | null {
    // Check for saved checkpoint
    if (hasCheckpoint(playerData) && playerData.lastCheckpointSceneId) {
      return {
        sceneId: playerData.lastCheckpointSceneId,
        x: playerData.lastCheckpointX ?? 0,
        y: playerData.lastCheckpointY ?? 0,
      };
    }

    // Get current scene ID (may be undefined in tests without full scene setup)
    const sceneManager = context.gameManager?.sceneManager;
    const currentSceneId = sceneManager?.getActiveScene()?.id ?? playerData.sceneId ?? 'default';

    // Find player-start entity
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !isPlayerStart(entityData)) continue;

      const pos = context.spatial.getEntityPosition(entityId);
      if (pos) {
        return {
          sceneId: currentSceneId,
          x: pos.x,
          y: pos.y,
        };
      }
    }

    // Last resort: respawn at (1,1)
    return {
      sceneId: currentSceneId,
      x: 1,
      y: 1,
    };
  }

  /**
   * Execute the pending respawn.
   */
  private executeRespawn(context: GameContext): void {
    if (!this.pendingRespawn) return;

    const { playerId, targetSceneId, targetX, targetY, cachedPlayerData } = this.pendingRespawn;
    const sceneManager = context.gameManager?.sceneManager;
    const currentSceneId = sceneManager?.getActiveScene()?.id;

    // Use cached player data (entity was removed by HealthSystem)
    const respawnData = {
      hp: cachedPlayerData.maxHp,
      maxHp: cachedPlayerData.maxHp,
      healthState: 'alive' as const,
      damage: cachedPlayerData.damage,
      sceneId: targetSceneId,
      inventory: [],
      pushStrength: 1,
      // Preserve checkpoint info
      lastCheckpointId: cachedPlayerData.lastCheckpointId,
      lastCheckpointSceneId: cachedPlayerData.lastCheckpointSceneId,
      lastCheckpointX: cachedPlayerData.lastCheckpointX,
      lastCheckpointY: cachedPlayerData.lastCheckpointY,
    };

    if (currentSceneId && currentSceneId !== targetSceneId) {
      // Cross-scene respawn - use GameManager
      this.gameManager.movePlayerToScene(targetSceneId, targetX, targetY, GameLayers.ACTORS);
    } else {
      // Same-scene respawn (or no scene manager) - spawn at checkpoint location
      context.spatial.spawnWithId(playerId, 'player', targetX, targetY, GameLayers.ACTORS, respawnData);

      // Commit immediately since we're in post-commit phase
      // This ensures the player is available immediately after respawn
      context.spatial.commit();
    }

    this.debugStats.respawnsThisSession++;

    // Call respawn callback
    if (this.config.onRespawn) {
      this.config.onRespawn(context, playerId);
    }

    this.pendingRespawn = null;
  }

  /**
   * Get remaining lives.
   */
  getLives(): number {
    return this.debugStats.currentLives;
  }

  /**
   * Add lives.
   */
  addLives(count: number): void {
    this.debugStats.currentLives += count;
  }

  /**
   * Reset lives to initial value.
   */
  resetLives(): void {
    this.debugStats.currentLives = this.config.initialLives;
  }

  public override resetState(): void {
    this.pendingRespawn = null;
    this.debugStats = {
      respawnsThisSession: 0,
      checkpointsActivated: 0,
      currentLives: this.config.initialLives,
    };
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      ...this.debugStats,
      pendingRespawn: this.pendingRespawn !== null,
      respawnDelay: this.config.respawnDelay,
    };
  }
}
