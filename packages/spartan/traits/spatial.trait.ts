import { GameLayers } from "../core/types";

export interface HasFloorEffect {
  effectType: 'damage' | 'heal' | 'slide' | 'slow';
  triggerMode?: 'on-entry' | 'continuous'; // Optional - inferred from effectType if omitted
  
  // Damage properties
  damage?: number;           // Damage per application
  
  // Healing properties
  healRate?: number;         // HP restored per application
  cooldown?: number;         // Milliseconds before healing can apply again (per entity)
  
  // Movement modifier properties (for on-entry effects)
  slideDistance?: number;    // Number of ticks to slide (ice)
  slowFactor?: number;       // Movement speed multiplier 0-1 (mud)
  
  // Timing (for continuous effects)
  cadence?: number;          // Milliseconds between applications (damage/heal)
}

export interface HasPropagation {
  propagationType: 'fire' | 'liquid' | 'gas' | 'chain';
  spreadRate: number;         // Ticks between spread attempts
  spreadLayer: number;        // Target layer for spawned entities
  spreadType: string;         // Entity type to spawn when propagating
  spreadProbability?: number; // 0.0-1.0 chance to spread to each neighbor (default 1.0)
  maxDistance?: number;       // Optional max spread radius from origin (Manhattan distance)
  lifetime?: number;          // Optional duration in ticks before auto-despawn
  blockedByLayers?: number[]; // Optional layers that block spread (e.g., [GameLayers.WALLS])
}

export interface HasDensity {
  density: number;    // Current density
  minDensity: number; // Minimum density threshold
}

export interface HasLiquid {
  depth: number;
}
