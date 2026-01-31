/**
 * System Configuration - Single Source of Truth
 *
 * Defines temporal behavior and dependencies for all game systems.
 * Used by both system implementations and documentation generation.
 */

export const SYSTEM_CONFIG = {
  PlayerInput: {
    tickRate: 1,
    executionPhase: 'input' as const,
    dependencies: [] as const,
    description: 'Translates player input into movement intents',
  },

  Door: {
    tickRate: 1,
    executionPhase: 'pre-commit' as const,
    dependencies: ['SpatialSystem'] as const,
    description: 'Unlocks doors when player has matching key',
  },

  Collection: {
    tickRate: 1,
    executionPhase: 'post-commit' as const,
    dependencies: ['SpatialSystem'] as const,
    description: 'Handles picking up collectible items',
  },

  Fire: {
    tickRate: 1, // FIRE_SPREAD_RATE in FireSystem
    executionPhase: 'main' as const,
    dependencies: ['SpatialSystem'] as const,
    description: 'Spreads fire, applies temperature logic, and consumes fuel',
  },

  Liquid: {
    tickRate: 1,
    executionPhase: 'main' as const,
    dependencies: ['SpatialSystem'] as const,
    description: 'Simulates volumetric liquid flow and depth diffusion',
  },

  Poison: {
    tickRate: 1,
    executionPhase: 'main' as const,
    dependencies: ['SpatialSystem'] as const,
    description: 'Handles density-based gas dispersion and damage application',
  },

  Explosion: {
    tickRate: 1,
    executionPhase: 'main' as const,
    dependencies: ['SpatialSystem'] as const,
    description: 'Processes chain explosions and destructive force',
  },

  FloorEffect: {
    tickRate: 1,
    executionPhase: 'main' as const,
    dependencies: ['SpatialSystem'] as const,
    description: 'Applies generic floor effects (damage/healing) based on presence',
  },

  Teleporter: {
    tickRate: 1,
    executionPhase: 'post-commit' as const,
    dependencies: ['SpatialSystem'] as const,
    description: 'Handles player teleportation between scenes',
  },

  ChainReaction: {
    tickRate: 1,
    executionPhase: 'main' as const,
    dependencies: ['SpatialSystem'] as const,
    description: 'Handles domino-like chain reactions',
  },
} as const;

// Timing constants extracted from config
export const FIRE_SPREAD_DELAY = SYSTEM_CONFIG.Fire.tickRate;
export const LIQUID_FLOW_DELAY = SYSTEM_CONFIG.Liquid.tickRate;
export const GAS_DISPERSION_DELAY = SYSTEM_CONFIG.Poison.tickRate;

// Entity constants
export const GameLayers = {
  FLOOR: 1,
  FLOOR_EFFECTS: 2, // Liquids, Fire, Gas, Ash
  COLLECTIBLES: 3,
  WALLS: 4,
  ACTORS: 5,
  EPHEMERALS: 6, // Visuals, particles
} as const;

// Type-safe access
export type SystemName = keyof typeof SYSTEM_CONFIG;
export type SystemConfig = (typeof SYSTEM_CONFIG)[SystemName];
export type ExecutionPhase = SystemConfig['executionPhase'];
