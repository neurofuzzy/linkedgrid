/**
 * Stun Trait
 *
 * Tracks stun/freeze status on entities. Stunned entities cannot move or attack.
 * Used by StunSystem to manage stun timers and by movement/combat systems to
 * skip stunned entities.
 */

/**
 * HasStunnable - Trait for entities that can be stunned or frozen.
 *
 * When stunned:
 * - NPCMovementSystem skips the entity (no movement)
 * - NPCBrainSystem skips the entity (no attacks)
 * - PlayerInputSystem skips the entity (no input)
 * - Visual state set to 'frozen'
 *
 * Stun is applied via StunSystem.applyStun() and expires when
 * the current tick reaches stunEndTick.
 *
 * @example
 * ```typescript
 * const enemy: EnemyData & HasStunnable = {
 *   type: 'enemy',
 *   stunnable: true,
 *   stunned: false,
 *   stunEndTick: 0,
 * };
 * ```
 */
export interface HasStunnable {
  /** Whether this entity can be stunned */
  stunnable: boolean;
  /** Whether entity is currently stunned (managed by system) */
  stunned?: boolean;
  /** Tick when stun expires (managed by system) */
  stunEndTick?: number;
}
