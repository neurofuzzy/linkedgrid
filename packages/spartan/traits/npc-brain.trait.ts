/**
 * NPC Brain Trait
 *
 * Defines combat AI configuration and runtime state for NPCs.
 * Used by NPCBrainSystem to coordinate movement, attack posture,
 * and prey/threat identification.
 *
 * The brain does NOT replace movement or attack systems -- it sets
 * intent fields (movementMode, meleeDirection, fireDirection) that
 * existing systems already consume. Entities remain dumb.
 */

/**
 * Combat posture determines how the NPC behaves relative to threats.
 * - aggressive: Approach and attack. Movement set to pursue.
 * - defensive: Maintain distance, attack when in range. Movement set to follow.
 * - retreating: Flee and don't attack. Movement set to flee.
 * - idle: No threats detected. Reverts to base movement mode.
 */
export type NPCPosture = 'aggressive' | 'defensive' | 'retreating' | 'idle';

/**
 * HasNPCBrain - Trait for NPCs with autonomous combat decision-making.
 *
 * The NPCBrainSystem reads this trait each tick to:
 * 1. Scan for threats/prey based on team affiliation
 * 2. Evaluate posture based on HP, distance, and available weapons
 * 3. Set movement and attack intents on the entity data
 *
 * @example
 * ```typescript
 * // Aggressive melee enemy
 * const grunt: HasNPCBrain = {
 *   posture: 'aggressive',
 *   attackRange: 1,
 *   threatRange: 8,
 * };
 *
 * // Defensive ranged enemy that retreats when hurt
 * const archer: HasNPCBrain = {
 *   posture: 'defensive',
 *   attackRange: 6,
 *   threatRange: 10,
 *   retreatHealthPct: 0.3,
 *   preferRanged: true,
 * };
 * ```
 */
export interface HasNPCBrain {
  // ========== Config (set by game designer) ==========

  /** Combat posture (default: 'aggressive') */
  posture?: NPCPosture;

  /** Range at which NPC will attempt to attack (1 = melee adjacent, >1 = ranged) */
  attackRange?: number;

  /** Range to scan for threats (default: 8) */
  threatRange?: number;

  /** Switch to retreating below this HP percentage (0-1, default: 0.25) */
  retreatHealthPct?: number;

  /** Prefer ranged attacks over melee when both available (default: false) */
  preferRanged?: boolean;

  // ========== Runtime State (managed by system) ==========

  /** Entity ID of current target (managed by system) */
  currentTargetId?: number;

  /** Current brain state (managed by system) */
  brainState?: 'idle' | 'engaging' | 'retreating' | 'dead';

  /** Tick when NPC last performed an attack action (managed by system) */
  lastBrainAttackTick?: number;

  /** Movement mode to restore when returning to idle (managed by system) */
  baseMovementModeBeforeBrain?: string;
}
