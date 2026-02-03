import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component ChainReactive
 * @icon git-branch-plus
 * @description Cascading trigger that spreads to adjacent entities (dominos, chain lightning)
 * 
 * Chain reactive component for entities that trigger adjacent reactions.
 * 
 * When activated, chain reactive entities trigger other chain reactive
 * entities in adjacent cells, creating cascading chain reactions.
 * 
 * Similar to explosives chaining, but more generic:
 * - Explosives deal damage and destroy
 * - Chain reactives just trigger and propagate
 * 
 * Use cases:
 * - Domino effects
 * - Virus spreading
 * - Magical chain lightning
 * - Alarm cascades
 * - Telegraph relay
 * 
 * @property {boolean} triggered - Whether this entity has been triggered
 * @property {number} triggerDelay - Delay in ticks before triggering adjacent entities
 * @property {number} delayTimer - Current delay timer
 * @property {boolean} remainTriggered - Whether to remain triggered after activation
 * @property {string} triggerType - Only trigger entities of same type
 * @property {boolean} canTrigger - Whether this entity can be triggered
 * @property {boolean} directional - Whether propagation is directional or omnidirectional
 * @property {string[]} propagationDirections - If directional, which directions to propagate
 * 
 * @example
 * ```typescript
 * // Create chain of reactive blocks
 * for (let x = 5; x <= 15; x++) {
 *   const block = world.createEntity();
 *   world.addComponent(block, ChainReactiveComponent, {
 *     triggered: false,
 *     triggerDelay: 3,  // Wait 3 ticks before triggering neighbors
 *     remainTriggered: true,  // Stay triggered after activating
 *     onTrigger: (entity) => {
 *       console.log('Block triggered!');
 *       // Add visual effect, sound, etc.
 *     }
 *   });
 *   world.addComponent(block, GridPositionComponent, { x, y: 7, grid });
 * }
 * 
 * // Manually trigger first block - watch chain reaction spread!
 * world.getComponent(firstBlock, ChainReactiveComponent)!.triggered = true;
 * ```
 */
export interface ChainReactive {
  /** Whether this entity has been triggered */
  triggered: boolean;
  
  /** Delay in ticks before triggering adjacent entities */
  triggerDelay: number;
  
  /** Internal: Current delay timer */
  delayTimer?: number;
  
  /** Whether to remain triggered after activation (true) or reset (false) */
  remainTriggered?: boolean;
  
  /** Optional: Only trigger entities of same type */
  triggerType?: string;
  
  /** Whether this entity can be triggered (can be disabled) */
  canTrigger?: boolean;
  
  /** Optional: Callback when triggered */
  onTrigger?: (entity: Entity) => void;
  
  /** Optional: Callback when triggering neighbors */
  onPropagate?: (entity: Entity, neighbor: Entity) => void;
  
  /** Whether propagation is directional (only forward) or omnidirectional */
  directional?: boolean;
  
  /** If directional, which directions to propagate to */
  propagationDirections?: string[];
}

export const ChainReactiveComponent = defineComponent<ChainReactive>();
