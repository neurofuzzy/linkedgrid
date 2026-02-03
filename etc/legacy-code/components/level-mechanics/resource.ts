/**
 * @component Resource
 * @icon plant
 * @description Renewable or depletable resource that can be harvested multiple times
 * 
 * Resource Component
 * 
 * Marks entities as harvestable resources that can be gathered multiple times.
 * Common in farming games, mining games, and survival games.
 * 
 * Examples:
 * - Grass patches (grazing)
 * - Ore deposits (mining)
 * - Trees (chopping)
 * - Berry bushes (foraging)
 * - Fish spawners (fishing)
 * 
 * @property {string} resourceType - Type of resource (grass, ore, wood, etc.)
 * @property {number} maxYields - Maximum number of harvests before depleted
 * @property {number} yieldsRemaining - Current number of harvests remaining
 * @property {number} yieldValue - Value/amount per harvest
 * @property {number} harvestCooldown - Ticks between harvests
 * @property {number} cooldownTimer - Internal timer for cooldown
 * @property {boolean} renewable - Whether resource regenerates
 * @property {number} regenTime - Ticks to regenerate one yield (if renewable)
 * @property {number} regenTimer - Internal timer for regeneration
 * @property {string[]} harvesterTags - Only entities with these tags can harvest
 * @property {number} depletionState - Current depletion state (0=full, 1-3=partial, 4=depleted)
 */

import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export interface Resource {
  /** Type of resource (grass, ore, wood, etc.) */
  resourceType: string;
  
  /** Maximum number of harvests */
  maxYields: number;
  
  /** Current harvests remaining */
  yieldsRemaining: number;
  
  /** Value/amount per harvest */
  yieldValue?: number;
  
  /** Ticks between harvests */
  harvestCooldown: number;
  
  /** Internal: Cooldown timer */
  cooldownTimer?: number;
  
  /** Whether resource regenerates over time */
  renewable?: boolean;
  
  /** Ticks to regenerate one yield (if renewable) */
  regenTime?: number;
  
  /** Internal: Regeneration timer */
  regenTimer?: number;
  
  /** Optional: Only entities with these tags can harvest */
  harvesterTags?: string[];
  
  /** Optional: Callback when harvested */
  onHarvest?: (harvester: Entity, resource: Entity, amount: number) => void;
  
  /** Optional: Callback when depleted */
  onDepleted?: (resource: Entity) => void;
  
  /** Optional: Callback when regenerates */
  onRegenerate?: (resource: Entity) => void;
  
  /** Current depletion state (0=full, 1-3=partial, 4=depleted) for visual feedback */
  depletionState?: number;
}

export const ResourceComponent = defineComponent<Resource>();

/**
 * @component Harvester
 * @icon pickaxe
 * @description Entity that can harvest resources
 * 
 * Harvester Component
 * 
 * Marks entities as harvesters that can gather from resources.
 * 
 * @property {string[]} harvestsTags - Tags of resources this harvester can gather
 * @property {number} harvestRadius - Maximum harvest radius
 * @property {boolean} active - Whether this harvester is actively harvesting
 */
export interface Harvester {
  /** Optional: Tags of resources this harvester can gather (if undefined, can harvest all) */
  harvestsTags?: string[];
  
  /** Optional: Callback when resource harvested */
  onHarvest?: (harvester: Entity, resource: Entity, resourceType: string, amount: number) => void;
  
  /** Optional: Maximum harvest radius (0 = must touch) */
  harvestRadius?: number;
  
  /** Optional: Inventory tracking */
  inventory?: Map<string, number>;
  
  /** Whether this harvester is actively harvesting */
  active?: boolean;
}

export const HarvesterComponent = defineComponent<Harvester>();
