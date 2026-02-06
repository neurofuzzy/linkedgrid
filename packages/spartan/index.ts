/**
 * Spartan Framework - Cell-centric game framework built on LinkedGrid
 *
 * Architecture B: Sparse entity system with spatial-first operations.
 *
 * Core principles:
 * - Entities stored primarily in cell layers
 * - Minimal external metadata storage
 * - Spatial queries are first-class
 * - Rule-based entity interactions
 *
 * @example
 * ```typescript
 * import { LinkedGrid } from '../grid';
 * import { SparseEntityStore, SpatialSystem } from '@spartan';
 *
 * const grid = new LinkedGrid(20, 20);
 * const store = new SparseEntityStore();
 * const spatial = new SpatialSystem(grid, store);
 *
 * // Spawn entities
 * const player = spatial.spawn('player', 10, 10, 1, { hp: 100 });
 * const enemy = spatial.spawn('enemy', 15, 10, 2, { hp: 50 });
 *
 * // Move entities
 * const entityId = spatial.getEntityIdAt(10, 10, 1);
 * if (entityId) spatial.move(entityId, 11, 10);
 *
 * // Spatial queries
 * const nearby = spatial.getEntityIdsInRadius(11, 10, 5);
 * ```
 */

// Core framework
export * from './core';

export {
  GameLayers,
  BLOCKING_LAYERS,
  VISION_BLOCKING_LAYERS,
  GAMEPLAY_VISIBLE_LAYERS,
  ALL_LAYERS,
  CellMasks,
} from './config/layers.config';

export type {
  GameLayer,
  CellMask,
} from './config/layers.config';

// Layers

/**
 * Entity Traits and Archetypes
 *
 * Trait-based entity system for composable, type-safe entity patterns.
 *
 * - Traits: Passive data contracts (HasHealth, CanDealDamage, etc.)
 * - Entities: Archetypes composed of traits (PlayerData, EnemyData, etc.)
 * - Guards: Runtime type guards for traits and entity types
 * - Helpers: Type-safe spawn functions for entity archetypes
 *
 * See entities/README.md for full documentation.
 */

// Entity traits (passive data contracts)
export type {
  HasHealth,
  CanDealDamage,
  HasAI,
  HasSceneLocation,
  HasTeleportTarget,
  HasInventory,
  IsLockable,
  IsCollectible,
  HasColor,
  HasFloorEffect,
  HasPropagation,
  HasTemperature,
  HasExplosion,
  HasDamageable,
} from './traits/traits';

// Visual traits
export type {
  HasVisualState,
  HasFacing,
  HasAnimation,
  VisualStateName,
} from './traits/visual.trait';

export { VISUAL_STATES } from './traits/visual.trait';

// Visual config presets
export {
  VISUAL_STATE_PRESETS,
  EFFECT_PRESETS,
  VISUAL_LAYERS,
} from './config/visual.config';
export type {
  VisualStatePreset,
  EffectPreset,
} from './config/visual.config';

export type { HasSceneConnection } from './traits/scene-connection.trait';

// Entity archetypes (example patterns)
export * from './entities/entity.types';

// Trait guards (runtime checks)
export {
  hasHealth,
  canDealDamage,
  hasAI,
  hasSceneLocation,
  hasTeleportTarget,
  hasSceneConnection,
  hasInventory,
  isLockable,
  isCollectible,
  hasColor,
  hasFloorEffect,
  hasPropagation,
  hasTemperature,
  hasExplosion,
  hasDamageable,
  isPlayer,
  isEnemy,
  isTeleporter,
  isItem,
  isWall,
  isDoor,
  isKey,
  isLava,
  isAcid,
  isMedbay,
  isIce,
  isMud,
  isPoisonGas,
  isWater,
  isAsh,
  isGrass,
  isGasoline,
  isFuse,
  isTorch,
  isBarrel,
  isExplosionVisual,
  isDestructibleWall,
  isPlayerWithHealth,
  isEnemyWithAI,
  isTeleporterWithTarget,
  isCoin,
  isFlag,
  isExit,
  hasScoreValue,
  isRangeSensor,
  isHealthPotion,
  hasNPCBrain,
  hasVisualState,
  hasFacing,
  hasAnimation,
} from './traits/trait-guards';

// Spawn helpers (type-safe entity creation)
export {
  spawnPlayer,
  spawnEnemy,
  spawnTeleporter,
  spawnItem,
  spawnWall,
  spawnPlayerWithId,
  spawnNPC,
  spawnNPCFromPersona,
  spawnCoin,
  spawnFlag,
  spawnExit,
  spawnRangeSensor,
} from './entities/spawn-helpers';

// Helpers
export * from './helpers';

// Systems
export {
  ChainReactionSystem,
  CollectionSystem,
  DoorSystem,
  ExplosionSystem,
  FireSystem,
  FloorEffectSystem,
  LiquidSystem,
  PlayerInputSystem,
  PoisonSystem,
  ScoreSystem,
  ObjectiveSystem,
  TeleporterSystem,
  VisualStateSystem,
} from './systems';

// Character Personas
export { CHARACTER_PERSONAS, getPersona } from './config/personas.config';
export type { CharacterPersona } from './config/personas.config';

// Objective types
export type { ObjectiveDefinition, ObjectiveType, HasScoreValue } from './traits/objective.trait';

// NPC Brain trait
export type { HasNPCBrain, NPCPosture } from './traits/npc-brain.trait';

// Visual system types
export type { VisualEvent, VisualEventType } from './core/visual-event-bus';
export type {
  VisualEffect,
  ShakeEffect,
  FlashEffect,
  ParticleEffect,
  AreaEffect,
} from './core/effects-queue';

