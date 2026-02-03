import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';

/**
 * @component KnockbackSource
 * @icon move
 * @description Pushes entities back on collision or attack
 * 
 * Knockback Source Component
 * 
 * Causes entities to be pushed back when taking damage or colliding.
 * Common in action games, beat-em-ups, and combat systems.
 * 
 * Examples:
 * - Enemy attacks knock player back
 * - Explosions push entities away
 * - Projectiles with knockback
 * - Collision impacts
 * 
 * @property {number} force - Force of knockback (cells pushed)
 * @property {Direction} direction - Direction of knockback (auto if undefined)
 * @property {string[]} affectsTags - Tags of entities that can be knocked back
 * @property {string[]} ignoreTags - Tags of entities immune to this knockback
 * @property {boolean} active - Whether this source is currently active
 * 
 * @example
 * ```typescript
 * // Create enemy with knockback attack
 * const enemy = world.createEntity();
 * world.addComponent(enemy, KnockbackSourceComponent, {
 *   force: 2,
 *   affectsTags: ['player']
 * });
 * 
 * // Create player that can be knocked back
 * const player = world.createEntity();
 * world.addComponent(player, KnockbackableComponent, {
 *   resistance: 0.5  // Half knockback distance
 * });
 * ```
 */

/**
 * @component Knockbackable
 * @icon shield-off
 * @description Entity that can be pushed back by knockback sources
 * 
 * Knockbackable Component
 * 
 * Marks entities that can be knocked back.
 * 
 * @property {number} resistance - Resistance to knockback (0 = full, 1 = immune)
 * @property {number} threshold - Minimum force required to knockback
 * @property {boolean} active - Whether currently being knocked back
 * @property {number} remainingDistance - Remaining knockback distance
 * @property {Direction} direction - Direction of current knockback
 * @property {number} delayTimer - Delay timer to prevent same-frame processing
 * @property {boolean} canMove - Whether entity can move while being knocked back
 */
export interface KnockbackSource {
  /** Force of knockback (cells pushed) */
  force: number;
  
  /** Direction of knockback (if undefined, uses attacker->target direction) */
  direction?: Direction;
  
  /** Tags of entities that can be knocked back */
  affectsTags?: string[];
  
  /** Tags of entities immune to this knockback */
  ignoreTags?: string[];
  
  /** Whether this source is currently active */
  active?: boolean;
  
  /** Callback when knockback is applied */
  onKnockback?: (source: Entity, target: Entity, distance: number) => void;
}

export const KnockbackSourceComponent = defineComponent<KnockbackSource>();

/**
 * Knockbackable Component
 * 
 * Marks entities that can be knocked back.
 */
export interface Knockbackable {
  /** Resistance to knockback (0 = full knockback, 1 = immune) */
  resistance?: number;
  
  /** Minimum force required to knockback this entity */
  threshold?: number;
  
  /** Whether currently being knocked back */
  active?: boolean;
  
  /** Remaining knockback distance */
  remainingDistance?: number;
  
  /** Direction of current knockback */
  direction?: Direction;
  
  /** Internal: Delay timer to prevent processing on same frame as application */
  delayTimer?: number;
  
  /** Callback when knocked back */
  onKnockback?: (entity: Entity, source: Entity, force: number) => void;
  
  /** Callback when knockback completes */
  onKnockbackComplete?: (entity: Entity) => void;
  
  /** Whether entity can move while being knocked back */
  canMove?: boolean;
}

export const KnockbackableComponent = defineComponent<Knockbackable>();
