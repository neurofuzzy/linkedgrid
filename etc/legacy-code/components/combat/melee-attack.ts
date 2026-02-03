import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';

/**
 * @component MeleeAttack
 * @icon sword
 * @description Enables close-range melee attacks with cooldown and knockback
 * 
 * Melee Attack Component
 * 
 * Allows entities to perform close-range attacks.
 * Common in action games, beat-em-ups, and RPGs.
 * 
 * Examples:
 * - Player sword attacks
 * - Enemy melee strikes
 * - Boss melee combos
 * - Directional attacks
 * 
 * @property {number} damage - Base damage dealt
 * @property {number} range - Attack range in cells (default: 1)
 * @property {number} cooldown - Cooldown between attacks in ticks
 * @property {number} cooldownTimer - Current cooldown timer
 * @property {boolean} attacking - Whether currently attacking
 * @property {Direction} attackDirection - Direction of attack (uses facing if undefined)
 * @property {number} windupTime - Wind-up time before damage is dealt (ticks)
 * @property {number} windupTimer - Wind-up timer
 * @property {number} attackDuration - How long the attack hitbox is active
 * @property {number} durationTimer - Attack duration timer
 * @property {string[]} affectsTags - Tags of entities that can be hit
 * @property {string[]} ignoreTags - Tags of entities immune to this attack
 * @property {number} knockbackForce - Knockback force applied on hit
 * @property {boolean} piercing - Whether attack hits multiple enemies or stops on first hit
 * 
 * @example
 * ```typescript
 * // Create melee attacker
 * const player = world.createEntity();
 * world.addComponent(player, MeleeAttackComponent, {
 *   damage: 5,
 *   range: 1,
 *   cooldown: 30,  // 0.5s at 60 FPS
 *   knockbackForce: 2,
 *   affectsTags: ['enemy']
 * });
 * 
 * // Trigger attack
 * const melee = world.getComponent(player, MeleeAttackComponent)!;
 * melee.attacking = true;
 * melee.attackDirection = Direction.RT;
 * ```
 */
export interface MeleeAttack {
  /** Base damage dealt */
  damage: number;
  
  /** Attack range in cells (default: 1) */
  range?: number;
  
  /** Cooldown between attacks in ticks */
  cooldown: number;
  
  /** Internal: Current cooldown timer */
  cooldownTimer?: number;
  
  /** Whether currently attacking */
  attacking?: boolean;
  
  /** Direction of attack (if undefined, uses facing direction) */
  attackDirection?: Direction;
  
  /** Wind-up time before damage is dealt (in ticks) */
  windupTime?: number;
  
  /** Internal: Wind-up timer */
  windupTimer?: number;
  
  /** Attack duration (how long the attack hitbox is active) */
  attackDuration?: number;
  
  /** Internal: Attack duration timer */
  durationTimer?: number;
  
  /** Tags of entities that can be hit */
  affectsTags?: string[];
  
  /** Tags of entities immune to this attack */
  ignoreTags?: string[];
  
  /** Knockback force applied on hit */
  knockbackForce?: number;
  
  /** Whether attack hits multiple enemies or stops on first hit */
  piercing?: boolean;
  
  /** Optional: Custom hit effect */
  onHit?: (attacker: Entity, target: Entity, damage: number) => void;
  
  /** Optional: Callback when attack starts */
  onAttackStart?: (attacker: Entity) => void;
  
  /** Optional: Callback when attack completes */
  onAttackComplete?: (attacker: Entity) => void;
  
  /** Internal: Set of entities already hit this attack (for piercing) */
  hitEntities?: Set<Entity>;
}

export const MeleeAttackComponent = defineComponent<MeleeAttack>();

/**
 * Melee Target Component
 * 
 * Marks entities that can be targeted by melee attacks.
 */
export interface MeleeTarget {
  /** Whether this entity can currently be hit */
  vulnerable?: boolean;
  
  /** Optional: Callback when hit by melee attack */
  onMeleeHit?: (target: Entity, attacker: Entity, damage: number) => void;
}

export const MeleeTargetComponent = defineComponent<MeleeTarget>();
