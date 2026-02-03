import { defineComponent, type Entity } from '@basegrid/ecs';

/**
 * @component AOEBuff
 * @icon circle-dot
 * @description Area buff aura (speed, damage, defense, health)
 * 
 * AOE Buff Component
 * 
 * Applies buffs to entities in an area of effect.
 * Can modify speed, damage, defense, etc.
 * 
 * @property {number} radius - Radius of effect (Manhattan distance)
 * @property {string} buffType - Type of buff to apply (speed, damage, defense, health, custom)
 * @property {number} multiplier - Multiplier for the buff
 * @property {number} flatValue - Flat value to add/subtract
 * @property {string[]} targetTags - Tags to affect (empty = all entities)
 * @property {string[]} ignoreTags - Tags to ignore
 * @property {boolean} active - Whether the buff is currently active
 * 
 * @example
 * ```typescript
 * const aura = world.createEntity();
 * world.addComponent(aura, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(aura, AOEBuffComponent, {
 *   radius: 5,
 *   buffType: 'speed',
 *   multiplier: 1.5, // 50% speed boost
 *   targetTags: ['ally']
 * });
 * ```
 */
export type BuffType = 'speed' | 'damage' | 'defense' | 'health' | 'custom';

export interface AOEBuff {
  /** Radius of effect (Manhattan distance) */
  radius: number;
  
  /** Type of buff to apply */
  buffType: BuffType;
  
  /** Multiplier for the buff (default: 1.0) */
  multiplier?: number;
  
  /** Flat value to add/subtract */
  flatValue?: number;
  
  /** Tags to affect (empty = all entities) */
  targetTags?: string[];
  
  /** Tags to ignore */
  ignoreTags?: string[];
  
  /** Whether the buff is currently active */
  active?: boolean;
  
  /** Custom buff function */
  customBuff?: (target: Entity, source: Entity) => void;
  
  /** Callback when entity enters buff area */
  onEnter?: (target: Entity, source: Entity) => void;
  
  /** Callback when entity exits buff area */
  onExit?: (target: Entity, source: Entity) => void;
  
  /** Set of currently buffed entities (internal) */
  buffedEntities?: Set<Entity>;
}

export const AOEBuffComponent = defineComponent<AOEBuff>();
