/**
 * @component Pickup
 * @icon box
 * @description Collectible item that can be picked up by other entities
 * 
 * Pickup Component
 * 
 * Marks entities as collectible items that can be picked up by other entities.
 * Common in platformers, RPGs, and arcade games.
 * 
 * Examples:
 * - Coins
 * - Power-ups
 * - Keys
 * - Health packs
 * - Ammunition
 * 
 * @property {string} itemType - Type of pickup (coin, health, ammo, etc.)
 * @property {number} value - Value/amount of the pickup
 * @property {string[]} collectorTags - Only entities with these tags can pick up this item
 * @property {boolean} collectible - Whether this pickup can be collected
 * @property {number} magnetRadius - Auto-collect radius (0 = must touch, >0 = attract)
 * @property {number} lifetime - Lifetime in ticks (disappears after this time)
 * @property {number} lifetimeTimer - Internal timer for lifetime
 * @property {number} spawnDelay - Delay before pickup becomes collectible (ticks)
 * @property {number} spawnTimer - Internal timer for spawn delay
 */

import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export interface Pickup {
  /** Type of pickup (coin, health, ammo, etc.) */
  itemType: string;
  
  /** Value/amount of the pickup */
  value?: number;
  
  /** Optional: Only entities with these tags can pick up this item */
  collectorTags?: string[];
  
  /** Whether this pickup can be collected */
  collectible?: boolean;
  
  /** Optional: Callback when collected */
  onCollect?: (collector: Entity, pickup: Entity) => void;
  
  /** Optional: Auto-collect radius (0 = must touch, >0 = attract nearby collectors) */
  magnetRadius?: number;
  
  /** Optional: Lifetime of pickup in ticks (disappears after this time) */
  lifetime?: number;
  
  /** Internal: Timer for lifetime */
  lifetimeTimer?: number;
  
  /** Optional: Delay before pickup becomes collectible (in ticks) */
  spawnDelay?: number;
  
  /** Internal: Timer for spawn delay */
  spawnTimer?: number;
  
  /** Optional: Custom data for this pickup */
  data?: any;
}

export const PickupComponent = defineComponent<Pickup>();

/**
 * @component Collector
 * @icon hand
 * @description Entity that can collect and pick up items
 * 
 * Collector Component
 * 
 * Marks entities as collectors that can pick up items.
 * 
 * @property {string[]} collectsTags - Tags of items this collector can pick up
 * @property {number} collectRadius - Maximum collection radius
 * @property {boolean} active - Whether this collector is actively collecting
 */
export interface Collector {
  /** Optional: Tags of items this collector can pick up (if undefined, can collect all) */
  collectsTags?: string[];
  
  /** Optional: Callback when item collected */
  onCollect?: (collector: Entity, pickup: Entity, itemType: string, value: number) => void;
  
  /** Optional: Maximum collection radius */
  collectRadius?: number;
  
  /** Optional: Inventory tracking */
  inventory?: Map<string, number>;
  
  /** Whether this collector is actively collecting */
  active?: boolean;
}

export const CollectorComponent = defineComponent<Collector>();
