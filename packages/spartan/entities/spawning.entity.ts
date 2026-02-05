/**
 * Player spawning entity definitions.
 *
 * Defines player-start and checkpoint entities for the respawn system.
 */
import type { BaseEntityData } from './base.entity';
import type { HasColor, HasSceneLocation } from '../traits';

/**
 * PlayerStartData - Marks the initial player spawn location in a scene.
 *
 * When a game starts or the player enters a scene for the first time,
 * this entity determines where the player spawns.
 *
 * Placed on FLOOR layer (non-blocking).
 */
export type PlayerStartData = BaseEntityData & {
  type: 'player-start';
} & HasSceneLocation &
  HasColor;

/**
 * CheckpointData - Activatable respawn point.
 *
 * When a player overlaps a checkpoint, it becomes their active
 * respawn location. If the player dies, they respawn at the most
 * recently activated checkpoint.
 *
 * Checkpoints can be in different scenes for cross-scene respawn.
 *
 * Placed on FLOOR layer (non-blocking).
 */
export type CheckpointData = BaseEntityData & {
  type: 'checkpoint';
  /** Whether this checkpoint has been activated by the player */
  activated: boolean;
} & HasSceneLocation &
  HasColor;
