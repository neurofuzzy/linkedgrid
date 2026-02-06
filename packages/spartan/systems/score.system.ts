/**
 * Score System - Tracks player score from kills and coin collection.
 *
 * Reads death events from HealthSystem to award kill points.
 * Detects coin collection via entity overlaps.
 * Updates GameState.score as single source of truth.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import type { HealthSystem } from './health.system';
import { isPlayer, isCoin, hasScoreValue } from '../traits/trait-guards';

/**
 * ScoreSystemConfig - Configuration for score tracking.
 */
export interface ScoreSystemConfig {
  /** Callback when score changes */
  onScoreChange?: (newScore: number, delta: number) => void;
}

/**
 * ScoreSystem - Manages player score from kills and collectibles.
 *
 * Key responsibilities:
 * 1. Read death events from HealthSystem and award kill points
 * 2. Detect coin collection from overlaps and award coin points
 * 3. Update GameState.score
 *
 * Score sources:
 * - Kill: Awards scoreValue from killed entity (if present)
 * - Coin: Awards scoreValue from collected coin entity
 *
 * @system
 * @reactsTo HealthSystem death events, entity overlaps
 * @modifies GameState.score
 *
 * @example
 * ```typescript
 * const scoreSystem = new ScoreSystem(gameManager, healthSystem);
 * gameLoop.addSystem(scoreSystem);
 * ```
 */
export class ScoreSystem extends BaseReactiveSystem {
  readonly executionPhase = 'post-commit' as const;

  private config: ScoreSystemConfig;

  constructor(
    private gameManager: GameManager,
    private healthSystem: HealthSystem,
    config: Partial<ScoreSystemConfig> = {}
  ) {
    super();
    this.config = { ...config };
  }

  update(context: GameContext): void {
    const scoreBefore = this.gameManager.gameState.score;

    // Award points for kills
    this.processKillScore(context);

    // Award points for coin collection
    this.processCoinCollection(context);

    // Fire callback if score changed
    const delta = this.gameManager.gameState.score - scoreBefore;
    if (delta > 0 && this.config.onScoreChange) {
      this.config.onScoreChange(this.gameManager.gameState.score, delta);
    }
  }

  /**
   * Award points for entity deaths.
   *
   * Reads death events from HealthSystem and checks if the killed
   * entity has a scoreValue property. Only awards points if the
   * killer was the player (or player-controlled).
   */
  private processKillScore(context: GameContext): void {
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId) return;

    const deathEvents = this.healthSystem.getDeathEvents();

    for (const event of deathEvents) {
      // Only award points for player kills
      if (event.killerEntityId !== playerId) continue;

      // Check if the dead entity had a scoreValue
      const entityData = context.spatial.getEntityData(event.entityId);
      if (entityData && hasScoreValue(entityData)) {
        this.gameManager.gameState.score += entityData.scoreValue;
      }
    }
  }

  /**
   * Award points for coin collection.
   *
   * Detects player/coin overlaps and awards scoreValue points.
   * Removes collected coins from the game.
   */
  private processCoinCollection(context: GameContext): void {
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId) return;

    for (const overlap of context.overlaps) {
      let hasPlayer = false;
      let coinEntityId: number | null = null;
      let coinScoreValue = 0;

      for (const entityId of overlap.entityIds) {
        if (entityId === playerId) {
          hasPlayer = true;
          continue;
        }

        const entityData = context.spatial.getEntityData(entityId);
        if (entityData && isCoin(entityData)) {
          coinEntityId = entityId;
          coinScoreValue = entityData.scoreValue;
        }
      }

      if (hasPlayer && coinEntityId !== null) {
        this.gameManager.gameState.score += coinScoreValue;
        context.spatial.remove(coinEntityId);
      }
    }
  }

  /**
   * Get current score.
   */
  getScore(): number {
    return this.gameManager.gameState.score;
  }

  public override resetState(): void {
    // Score persists in GameState - no local state to reset
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      currentScore: this.gameManager.gameState.score,
    };
  }
}
