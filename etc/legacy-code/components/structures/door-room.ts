import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component Door
 * @icon door-open
 * @description Openable/lockable passage between areas
 * 
 * Door Component
 * 
 * Manages door state and room connections.
 * Handles opening, closing, locking, and transitions.
 * 
 * Examples:
 * - Automatic doors
 * - Locked doors requiring keys
 * - Boss room doors
 * - Secret passages
 * 
 * @property {string} state - Current door state (open, closed, opening, closing)
 * @property {boolean} locked - Whether door is locked
 * @property {string} requiredKey - Key required to unlock
 * @property {string} fromRoom - Room this door leads from
 * @property {string} toRoom - Room this door leads to
 * @property {number} autoCloseDelay - Auto-close timer (seconds, 0 = never)
 * @property {number} autoCloseTimer - Time until auto-close
 * @property {number} animationDuration - Animation duration for opening/closing
 * @property {number} animationTimer - Animation timer
 * 
 * @example
 * ```typescript
 * // Create locked door
 * const door = world.createEntity();
 * world.addComponent(door, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(door, DoorComponent, {
 *   state: 'closed',
 *   locked: true,
 *   requiredKey: 'red-key',
 *   fromRoom: 'hallway',
 *   toRoom: 'treasury'
 * });
 * ```
 */
export interface Door {
  /** Current door state */
  state: 'open' | 'closed' | 'opening' | 'closing';
  
  /** Whether door is locked */
  locked?: boolean;
  
  /** Key required to unlock (if locked) */
  requiredKey?: string;
  
  /** Room this door leads from */
  fromRoom?: string;
  
  /** Room this door leads to */
  toRoom?: string;
  
  /** Auto-close timer (seconds, 0 = never) */
  autoCloseDelay?: number;
  
  /** Internal: time until auto-close */
  autoCloseTimer?: number;
  
  /** Animation duration for opening/closing (seconds) */
  animationDuration?: number;
  
  /** Internal: animation timer */
  animationTimer?: number;
  
  /** Optional: Callback when door opens */
  onOpen?: (entity: Entity, opener?: Entity) => void;
  
  /** Optional: Callback when door closes */
  onClose?: (entity: Entity) => void;
  
  /** Optional: Callback when door is unlocked */
  onUnlock?: (entity: Entity, unlocker: Entity) => void;
}

export const DoorComponent = defineComponent<Door>();

/**
 * @component Room
 * @icon layout
 * @description Defines a room/area with bounds and entity tracking
 * 
 * Room Component
 * 
 * Defines a room or area in the game world.
 * Tracks entities in the room and room properties.
 * 
 * @property {string} id - Unique room identifier
 * @property {object} bounds - Room bounds (x, y, width, height)
 * @property {boolean} active - Whether room is currently active/loaded
 * 
 * @example
 * ```typescript
 * // Create room tracker
 * const room = world.createEntity();
 * world.addComponent(room, RoomComponent, {
 *   id: 'boss-arena',
 *   bounds: { x: 0, y: 0, width: 20, height: 20 },
 *   active: true
 * });
 * ```
 */
export interface Room {
  /** Unique room identifier */
  id: string;
  
  /** Room bounds */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  /** Whether room is currently active/loaded */
  active?: boolean;
  
  /** Entities currently in this room */
  entitiesInRoom?: Set<Entity>;
  
  /** Connected rooms (by room ID) */
  connectedRooms?: string[];
  
  /** Optional: Callback when entity enters room */
  onEnter?: (room: Entity, entity: Entity) => void;
  
  /** Optional: Callback when entity exits room */
  onExit?: (room: Entity, entity: Entity) => void;
}

export const RoomComponent = defineComponent<Room>();
