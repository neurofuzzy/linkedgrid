import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';

/**
 * Pushable Component
 * 
 * @component Pushable
 * @category level-mechanics
 * @icon box
 * @description Entity can be pushed by other entities (crates, boxes, ice blocks, boulders)
 * 
 * Marks entities that can be pushed by other entities.
 * Used for crates, boxes, ice blocks, boulders, etc.
 * 
 * @property {boolean} pushable - Whether entity can be pushed
 * @property {number[]} blockedBy - Cell values that block pushing
 * @property {boolean} canPushOthers - Whether entity can push other pushables
 * @property {number} maxChainLength - Maximum push chain length
 * @property {string[]} requiredPusherTags - Require specific tags to push
 * @property {number} weight - Weight (affects push difficulty)
 * 
 * @example
 * ```typescript
 * // Create pushable crate
 * const crate = world.createEntity();
 * world.addComponent(crate, GridPositionComponent, { x: 5, y: 5, grid });
 * world.addComponent(crate, PushableComponent, {
 *   pushable: true,
 *   blockedBy: [WALL],
 *   onPush: (entity, direction) => console.log('Pushed!')
 * });
 * 
 * // Player pushes crate
 * const pushSystem = world.getSystem(PushSystem);
 * pushSystem.tryPush(player, Direction.RT);
 * ```
 */
export interface Pushable {
  /** Whether entity can be pushed */
  pushable?: boolean;
  
  /** Cell values that block pushing */
  blockedBy?: number[];
  
  /** Whether entity can push other pushables */
  canPushOthers?: boolean;
  
  /** Maximum push chain length */
  maxChainLength?: number;
  
  /** Optional: Callback when pushed */
  onPush?: (entity: Entity, direction: Direction, pusher?: Entity) => void;
  
  /** Optional: Callback when push is blocked */
  onPushBlocked?: (entity: Entity, direction: Direction) => void;
  
  /** Optional: Require specific tags to push */
  requiredPusherTags?: string[];
  
  /** Optional: Weight (affects push difficulty) */
  weight?: number;
}

export const PushableComponent = defineComponent<Pushable>();

/**
 * Pusher Component
 * 
 * @component Pusher
 * @category level-mechanics
 * @icon hand
 * @description Entity can push other pushable entities
 * 
 * Marks entities that can push other entities.
 * 
 * @property {boolean} canPush - Whether entity can push
 * @property {number} pushStrength - Push strength (can push entities up to this weight)
 * 
 * @example
 * ```typescript
 * // Create player that can push
 * const player = world.createEntity();
 * world.addComponent(player, PusherComponent, {
 *   canPush: true,
 *   pushStrength: 1
 * });
 * ```
 */
export interface Pusher {
  /** Whether entity can push */
  canPush?: boolean;
  
  /** Push strength (can push entities up to this weight) */
  pushStrength?: number;
  
  /** Optional: Callback when successfully pushes */
  onPushSuccess?: (pusher: Entity, pushed: Entity, direction: Direction) => void;
  
  /** Optional: Callback when push fails */
  onPushFail?: (pusher: Entity, target: Entity, direction: Direction) => void;
}

export const PusherComponent = defineComponent<Pusher>();
