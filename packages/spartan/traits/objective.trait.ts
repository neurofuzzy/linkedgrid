/**
 * Objective Trait
 *
 * Defines game objective types and tracking for scene/game completion.
 * Used by ObjectiveSystem to evaluate win conditions.
 */

/**
 * Objective types supported by the ObjectiveSystem.
 * - collect-flag: All flag entities with matching targetId must be collected
 * - kill-all: All enemies in the scene must be eliminated
 * - reach-exit: Player must overlap an exit entity
 */
export type ObjectiveType = 'collect-flag' | 'kill-all' | 'reach-exit';

/**
 * ObjectiveDefinition - Defines a single game objective.
 *
 * Stored in GameState.objectives and tracked by ObjectiveSystem.
 *
 * @example
 * ```typescript
 * const objectives: ObjectiveDefinition[] = [
 *   { id: 'clear-arena', type: 'kill-all', sceneId: 'arena' },
 *   { id: 'get-flag', type: 'collect-flag', sceneId: 'arena', targetId: 'red-flag' },
 *   { id: 'escape', type: 'reach-exit', sceneId: 'arena' },
 * ];
 * ```
 */
export interface ObjectiveDefinition {
  /** Unique objective identifier */
  id: string;
  /** Type of objective */
  type: ObjectiveType;
  /** Scene this objective applies to */
  sceneId: string;
  /** For collect-flag: the objectiveId on flag entities to collect */
  targetId?: string;
  /** Whether this objective has been completed */
  completed: boolean;
}

/**
 * HasScoreValue - Trait for entities that award points when killed or collected.
 *
 * Used by ScoreSystem to determine point values.
 *
 * @example
 * ```typescript
 * const enemy: EnemyData & HasScoreValue = {
 *   type: 'enemy',
 *   scoreValue: 50,
 *   // ...
 * };
 * ```
 */
export interface HasScoreValue {
  /** Points awarded when this entity is killed or collected */
  scoreValue: number;
}
