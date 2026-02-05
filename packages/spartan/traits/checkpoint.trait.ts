/**
 * Checkpoint Trait
 *
 * Tracks checkpoint activation state for respawn system.
 * Used by RespawnSystem to determine where to respawn the player.
 */

/**
 * HasCheckpoint - Trait for entities that track checkpoint progress.
 *
 * Typically applied to the player entity to remember their last
 * activated checkpoint for respawning after death.
 *
 * @example
 * ```typescript
 * const player: PlayerData & HasCheckpoint = {
 *   type: 'player',
 *   lastCheckpointId: 42,
 *   lastCheckpointSceneId: 'level-2',
 *   // ...other properties
 * };
 * ```
 */
export interface HasCheckpoint {
  /** Entity ID of the last activated checkpoint (or undefined for player-start) */
  lastCheckpointId?: number;
  /** Scene ID where the checkpoint is located */
  lastCheckpointSceneId?: string;
  /** X position of the checkpoint (cached for cross-scene respawn) */
  lastCheckpointX?: number;
  /** Y position of the checkpoint (cached for cross-scene respawn) */
  lastCheckpointY?: number;
}
