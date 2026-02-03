import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component FogOfWar
 * @icon eye-off
 * @description Tracks explored and visible map areas (dungeon exploration, RTS)
 * 
 * Fog of War Component
 * 
 * Tracks explored and visible areas of the map.
 * Manages three states: unexplored, explored, and visible.
 * 
 * Examples:
 * - Dungeon exploration
 * - RTS fog of war
 * - Roguelike visibility
 * - Strategic map reveal
 * 
 * @property {number} width - Map width
 * @property {number} height - Map height
 * @property {number} revealRadius - Default reveal radius for entities
 * @property {boolean} shroudExplored - Whether fog shrouds explored areas
 * @property {number} updateInterval - Update interval (seconds)
 * @property {number} updateTimer - Internal update timer
 * 
 * @example
 * ```typescript
 * // Create fog of war tracker
 * const fog = world.createEntity();
 * world.addComponent(fog, FogOfWarComponent, {
 *   width: 50,
 *   height: 50,
 *   revealRadius: 8
 * });
 * 
 * // System reveals fog around player
 * const fogSystem = world.getSystem(FogOfWarSystem);
 * fogSystem.revealAround(player, 8);
 * ```
 */
export interface FogOfWar {
  /** Map width */
  width: number;
  
  /** Map height */
  height: number;
  
  /** Default reveal radius for entities */
  revealRadius?: number;
  
  /** Fog state grid: 0=unexplored, 1=explored, 2=visible */
  fogGrid?: Uint8Array;
  
  /** Entities providing vision */
  visionProviders?: Set<Entity>;
  
  /** Whether fog shrouds explored areas (false = permanent reveal) */
  shroudExplored?: boolean;
  
  /** Update interval (seconds, 0 = every frame) */
  updateInterval?: number;
  
  /** Internal: update timer */
  updateTimer?: number;
}

export const FogOfWarComponent = defineComponent<FogOfWar>();

/**
 * @component FogVision
 * @icon eye
 * @description Provides vision radius for fog of war system
 * 
 * Fog Vision Component
 * 
 * Marks entity as providing fog of war vision.
 * 
 * @property {number} radius - Vision radius (cells)
 * @property {boolean} active - Whether vision is currently active
 * 
 * @example
 * ```typescript
 * // Give player vision
 * world.addComponent(player, FogVisionComponent, {
 *   radius: 10
 * });
 * ```
 */
export interface FogVision {
  /** Vision radius (cells) */
  radius: number;
  
  /** Whether vision is currently active */
  active?: boolean;
}

export const FogVisionComponent = defineComponent<FogVision>();
