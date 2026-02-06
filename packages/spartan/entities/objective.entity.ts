/**
 * Objective entity definitions.
 *
 * Entities used by the Score and Objective systems:
 * - Coin: Collectible that awards score points
 * - Flag: Collectible objective marker
 * - Exit: Reach-target objective marker
 */
import { BaseEntityData } from './base.entity';
import { IsCollectible, HasColor } from '../traits';
import type { HasScoreValue } from '../traits/objective.trait';

/**
 * CoinData - Collectible score pickup.
 *
 * Awards scoreValue points to GameState.score when collected by the player.
 * Placed on COLLECTIBLES layer.
 *
 * @example
 * ```typescript
 * spatial.spawn('coin', 5, 5, GameLayers.COLLECTIBLES, {
 *   scoreValue: 10,
 *   collectibleId: 'coin',
 *   color: '#ffd700',
 * });
 * ```
 */
export type CoinData = BaseEntityData & {
  type: 'coin';
} & IsCollectible &
  HasColor &
  HasScoreValue;

/**
 * FlagData - Objective collectible marker.
 *
 * Used by ObjectiveSystem to track 'collect-flag' objectives.
 * The objectiveId links this flag to an ObjectiveDefinition's targetId.
 *
 * @example
 * ```typescript
 * spatial.spawn('flag', 10, 10, GameLayers.COLLECTIBLES, {
 *   objectiveId: 'red-flag',
 *   collectibleId: 'flag',
 *   color: '#ff0000',
 * });
 * ```
 */
export type FlagData = BaseEntityData & {
  type: 'flag';
  /** Objective identifier - links to ObjectiveDefinition.targetId */
  objectiveId: string;
} & IsCollectible &
  HasColor;

/**
 * ExitData - Reach-target objective marker.
 *
 * Player overlapping an exit triggers 'reach-exit' objectives for the scene.
 * Placed on FLOOR layer (non-blocking, walkable).
 *
 * @example
 * ```typescript
 * spatial.spawn('exit', 15, 15, GameLayers.FLOOR, {
 *   color: '#00ff00',
 * });
 * ```
 */
export type ExitData = BaseEntityData & {
  type: 'exit';
} & HasColor;
