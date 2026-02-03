/**
 * @component RespawnPoint
 * @icon flag
 * @description Spawn point where entities return after death (checkpoints)
 * 
 * Respawn Point Component
 * 
 * Defines spawn points where entities return when killed or reset.
 * Essential for checkpoints, ghost houses, and respawn mechanics.
 * 
 * Examples:
 * - Player checkpoints (save progress)
 * - Enemy spawn points (return after death)
 * - Ghost house (Pac-Man style respawn)
 * - Respawn beacons
 * 
 * @property {number} x - X coordinate of respawn location
 * @property {number} y - Y coordinate of respawn location
 * @property {boolean} active - Whether this respawn point is currently active
 * @property {string[]} affectsTags - Only affects entities with these tags
 * @property {number} priority - Priority (higher priority checkpoints override lower)
 * @property {string} id - Unique identifier for this respawn point
 * @property {boolean} isCheckpoint - Whether this is a checkpoint that activates on touch
 * @property {number} maxUses - Maximum number of times this respawn point can be used
 * @property {number} useCount - Current use count
 */

import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export interface RespawnPoint {
  /** X coordinate of respawn location */
  x: number;
  
  /** Y coordinate of respawn location */
  y: number;
  
  /** Whether this respawn point is currently active */
  active?: boolean;
  
  /** Optional: Only affects entities with these tags */
  affectsTags?: string[];
  
  /** Optional: Priority (higher priority checkpoints override lower ones) */
  priority?: number;
  
  /** Optional: Unique identifier for this respawn point */
  id?: string;
  
  /** Optional: Callback when entity respawns here */
  onRespawn?: (entity: Entity) => void;
  
  /** Optional: Callback when this checkpoint is activated */
  onActivate?: (activator: Entity) => void;
  
  /** Optional: Whether this is a "checkpoint" that can be activated by touching */
  isCheckpoint?: boolean;
  
  /** Optional: Maximum number of times this respawn point can be used */
  maxUses?: number;
  
  /** Internal: Current use count */
  useCount?: number;
}

export const RespawnPointComponent = defineComponent<RespawnPoint>();

/**
 * @component Respawnable
 * @icon refresh-ccw
 * @description Entity that can respawn at checkpoints after death
 * 
 * Respawnable Component
 * 
 * Marks an entity as respawnable and tracks its current respawn point.
 * 
 * @property {string} respawnPointId - Current respawn point ID or coordinates
 * @property {number} homeX - Default spawn X (if no respawn point assigned)
 * @property {number} homeY - Default spawn Y (if no respawn point assigned)
 * @property {number} respawnDelay - Delay before respawn (in ticks)
 * @property {number} respawnTimer - Timer for delayed respawn
 * @property {boolean} restoreHealthOnRespawn - Whether to restore health on respawn
 */
export interface Respawnable {
  /** Current respawn point ID or coordinates */
  respawnPointId?: string;
  
  /** Default spawn X (if no respawn point assigned) */
  homeX: number;
  
  /** Default spawn Y (if no respawn point assigned) */
  homeY: number;
  
  /** Optional: Delay before respawn (in ticks) */
  respawnDelay?: number;
  
  /** Internal: Timer for delayed respawn */
  respawnTimer?: number;
  
  /** Optional: Callback when entity is marked for respawn */
  onDeath?: (entity: Entity) => void;
  
  /** Optional: Callback when entity completes respawn */
  onRespawnComplete?: (entity: Entity, x: number, y: number) => void;
  
  /** Optional: Whether to restore health on respawn */
  restoreHealthOnRespawn?: boolean;
}

export const RespawnableComponent = defineComponent<Respawnable>();
