/**
 * @component ResourceDrop
 * @icon package
 * @description Loot table for items dropped on death (enemies, crates, chests)
 * 
 * Resource Drop Component
 * 
 * Defines what items/resources an entity drops when killed or destroyed.
 * Common in RPGs, action games, and roguelikes.
 * 
 * Examples:
 * - Enemy drops loot on death
 * - Crate drops items when broken
 * - Boss drops special items
 * - Chest spawns treasure
 * 
 * @property {DropItem[]} items - List of items that can drop
 * @property {boolean} dropAll - Whether to drop all items or pick randomly
 * @property {number} maxDrops - Maximum number of items to drop if not dropAll
 * @property {number} scatterRadius - Offset range for drop position
 * @property {string[]} requireKillerTags - Only drop if killed by entity with these tags
 * @property {boolean} dropped - Whether drops have been processed
 * @property {number} dropDelay - Delay before dropping (ticks)
 * @property {number} dropTimer - Timer for delayed drops
 */

import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export interface DropItem {
  /** Type/ID of the item to drop */
  itemType: string;
  
  /** Number of items to drop */
  quantity?: number;
  
  /** Probability of dropping (0-1, default 1.0) */
  dropChance?: number;
  
  /** Optional: Specific sprite/visual for dropped item */
  sprite?: number;
  
  /** Optional: Custom data for this drop */
  data?: any;
}

export interface ResourceDrop {
  /** List of items that can drop */
  items: DropItem[];
  
  /** Whether to drop all items or pick randomly */
  dropAll?: boolean;
  
  /** Maximum number of items to drop if not dropAll */
  maxDrops?: number;
  
  /** Optional: Offset range for drop position (randomize X/Y within this range) */
  scatterRadius?: number;
  
  /** Optional: Only drop if killed by entity with these tags */
  requireKillerTags?: string[];
  
  /** Optional: Callback when drops are created */
  onDrop?: (drops: Entity[], killer?: Entity) => void;
  
  /** Optional: Whether drops have been processed (internal flag) */
  dropped?: boolean;
  
  /** Optional: Delay before dropping (in ticks) */
  dropDelay?: number;
  
  /** Internal: Timer for delayed drops */
  dropTimer?: number;
}

export const ResourceDropComponent = defineComponent<ResourceDrop>();
