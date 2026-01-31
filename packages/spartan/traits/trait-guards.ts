/**
 * Type Guards for Entity Traits
 *
 * Provides runtime checks for entity traits and types.
 * Used by systems to safely narrow entity types and access trait properties.
 *
 * Design principles:
 * - Structural checking: Verify properties exist with correct types
 * - Type predicates: Enable TypeScript narrowing
 * - Trait-based: Generic checks work with any entity possessing trait
 * - Type-based: Specific checks for concrete entity archetypes
 *
 * @example
 * ```typescript
 * // Trait-based (generic) - works with any entity having the trait
 * if (hasHealth(entity)) {
 *   entity.hp -= 10; // Type-safe: entity is EntityData & HasHealth
 * }
 *
 * // Type-based (specific) - works only with player archetype
 * if (isPlayer(entity)) {
 *   entity.damage += 5; // Type-safe: entity is PlayerData
 * }
 * ```
 */

import type { EntityData } from '../entities/entity.types';
import type {
  PlayerData,
  EnemyData,
  TeleporterData,
  ItemData,
  WallData,
  DoorData,
  KeyData,
  OpenDoorData,
  LavaData,
  AcidData,
  MedbayData,
  IceData,
  MudData,
  PoisonGasData,
  WaterData,
  AshData,
  GrassData,
  GasolineData,
  FuseData,
  TorchData,
  BarrelData,
  ExplosionVisualData,
  DestructibleWallData,
  ChainLinkData,
  FireVisualData,
} from '../entities';

/**
 * Trait Guards
 *
 * These check if an entity possesses a specific trait.
 * Enable generic system logic that works with any entity having the trait.
 */

/**
 * Check if entity has health trait.
 *
 * Entities with health can take damage and be destroyed.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses health trait (hp and maxHp)
 */
export function hasHealth(
  entity: EntityData
): entity is PlayerData | EnemyData | GrassData | GasolineData | FuseData | BarrelData | DestructibleWallData {
  return (
    'hp' in entity && typeof entity.hp === 'number' &&
    'maxHp' in entity && typeof entity.maxHp === 'number'
  );
}

/**
 * Check if entity can deal damage.
 *
 * Entities with damage trait can harm other entities.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses damage trait
 */
export function canDealDamage(
  entity: EntityData
): entity is PlayerData | EnemyData {
  return 'damage' in entity && typeof entity.damage === 'number';
}

/**
 * Check if entity has AI trait.
 *
 * Entities with AI trait can be controlled by autonomous behavior systems.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses AI trait
 */
export function hasAI(entity: EntityData): entity is EnemyData {
  if (!('aiState' in entity)) return false;
  const state = entity.aiState;
  return state === 'idle' || state === 'chase' || state === 'attack';
}

/**
 * Check if entity tracks scene location.
 *
 * Entities with scene location trait know which scene they belong to.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses scene location trait
 */
export function hasSceneLocation(
  entity: EntityData
): entity is PlayerData | TeleporterData {
  return 'sceneId' in entity && typeof entity.sceneId === 'string';
}

/**
 * Check if entity has teleport target trait.
 *
 * Entities with teleport target trait are teleporters with connection keys.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses teleport target trait
 */
export function hasTeleportTarget(
  entity: EntityData
): entity is TeleporterData {
  return 'targetKey' in entity && typeof entity.targetKey === 'string';
}

/**
 * Check if entity has inventory trait.
 *
 * Entities with inventory can hold collected items.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses inventory trait
 */
export function hasInventory(
  entity: EntityData
): entity is PlayerData {
  return 'inventory' in entity && Array.isArray(entity.inventory);
}

/**
 * Check if entity is lockable.
 *
 * Entities with lockable trait can be locked/unlocked with keys.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses lockable trait
 */
export function isLockable(
  entity: EntityData
): entity is DoorData {
  return (
    'isLocked' in entity && typeof entity.isLocked === 'boolean' &&
    'requiredKey' in entity && typeof entity.requiredKey === 'string'
  );
}

/**
 * Check if entity is collectible.
 *
 * Entities with collectible trait can be picked up.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses collectible trait
 */
export function isCollectible(
  entity: EntityData
): entity is KeyData {
  return (
    'collectibleType' in entity && typeof entity.collectibleType === 'string' &&
    'collectibleId' in entity && typeof entity.collectibleId === 'string'
  );
}

/**
 * Check if entity has color trait.
 *
 * Entities with color trait have a display color for rendering.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses color trait
 */
export function hasColor(
  entity: EntityData
): entity is DoorData | KeyData | OpenDoorData | LavaData | AcidData | MedbayData | IceData | MudData | 
              PoisonGasData | WaterData | AshData | GrassData | GasolineData | FuseData | TorchData | 
              BarrelData | ExplosionVisualData | DestructibleWallData | ChainLinkData | FireVisualData {
  return 'color' in entity && typeof entity.color === 'string';
}

/**
 * Check if entity has floor effect trait.
 *
 * Entities with floor effect trait provide gameplay effects when entities stand on them.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses floor effect trait
 */
export function hasFloorEffect(
  entity: EntityData
): entity is LavaData | AcidData | MedbayData | IceData | MudData | PoisonGasData {
  if (!('effectType' in entity)) return false;
  const effectType = entity.effectType;
  return (
    effectType === 'damage' ||
    effectType === 'heal' ||
    effectType === 'slide' ||
    effectType === 'slow'
  );
}

/**
 * Check if entity has propagation trait.
 *
 * Entities with propagation trait can spread to adjacent cells over time.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses propagation trait
 */
export function hasPropagation(
  entity: EntityData
): entity is PoisonGasData | WaterData | ChainLinkData {
  if (!('propagationType' in entity)) return false;
  const propagationType = entity.propagationType;
  return (
    (propagationType === 'fire' ||
      propagationType === 'liquid' ||
      propagationType === 'gas' ||
      propagationType === 'chain') &&
    'spreadRate' in entity && typeof entity.spreadRate === 'number' &&
    'spreadLayer' in entity && typeof entity.spreadLayer === 'number' &&
    'spreadType' in entity && typeof entity.spreadType === 'string'
  );
}

/**
 * Check if entity has temperature trait.
 *
 * Entities with temperature trait can catch fire and burn when heated.
 * Used by FireSystem to track burning entities and spread fire.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses temperature trait
 */
export function hasTemperature(
  entity: EntityData
): entity is GrassData | GasolineData | FuseData | BarrelData {
  return (
    'temperature' in entity && typeof entity.temperature === 'number' &&
    'flammable' in entity && typeof entity.flammable === 'boolean' &&
    'flamePoint' in entity && typeof entity.flamePoint === 'number'
  );
}

/**
 * Check if entity has explosion trait.
 *
 * Entities with explosion trait can detonate, dealing area damage.
 * Used by ExplosionSystem to detect and trigger explosions.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses explosion trait
 */
export function hasExplosion(
  entity: EntityData
): entity is BarrelData {
  return (
    'explosionDamage' in entity && typeof entity.explosionDamage === 'number' &&
    'explosionRadius' in entity && typeof entity.explosionRadius === 'number'
  );
}

/**
 * Check if entity has damageable trait.
 *
 * Entities with damageable trait have damage resistance thresholds.
 * Used by damage systems to check minimum damage requirements.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses damageable trait
 */
export function hasDamageable(
  entity: EntityData
): entity is DestructibleWallData {
  return 'hardness' in entity && typeof entity.hardness === 'number';
}

/**
 * Check if entity has density trait.
 *
 * Entities with density trait have concentration for fluid simulation.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses density trait
 */
export function hasDensity(
  entity: EntityData
): entity is PoisonGasData {
  return (
    'density' in entity && typeof entity.density === 'number' &&
    'minDensity' in entity && typeof entity.minDensity === 'number'
  );
}

/**
 * Check if entity has liquid trait.
 *
 * Entities with liquid trait have volumetric depth.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses liquid trait
 */
export function hasLiquid(
  entity: EntityData
): entity is WaterData {
  return 'depth' in entity && typeof entity.depth === 'number';
}

/**
 * Entity Type Guards
 *
 * These check for specific entity archetypes and narrow to full type contracts.
 * Use when system needs the complete entity archetype definition.
 */

/**
 * Check if entity is a player.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'player'
 */
export function isPlayer(entity: EntityData): entity is PlayerData {
  return entity.type === 'player';
}

/**
 * Check if entity is an enemy.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'enemy'
 */
export function isEnemy(entity: EntityData): entity is EnemyData {
  return entity.type === 'enemy';
}

/**
 * Check if entity is a teleporter.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'teleporter'
 */
export function isTeleporter(entity: EntityData): entity is TeleporterData {
  return entity.type === 'teleporter';
}

/**
 * Check if entity is an item.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'item'
 */
export function isItem(entity: EntityData): entity is ItemData {
  return entity.type === 'item';
}

/**
 * Check if entity is a wall.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'wall'
 */
export function isWall(entity: EntityData): entity is WallData {
  return entity.type === 'wall';
}

/**
 * Check if entity is a door.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'door'
 */
export function isDoor(entity: EntityData): entity is DoorData {
  return entity.type === 'door';
}

/**
 * Check if entity is a key.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'key'
 */
export function isKey(entity: EntityData): entity is KeyData {
  return entity.type === 'key';
}

/**
 * Check if entity is lava.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'lava'
 */
export function isLava(entity: EntityData): entity is LavaData {
  return entity.type === 'lava';
}

/**
 * Check if entity is acid.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'acid'
 */
export function isAcid(entity: EntityData): entity is AcidData {
  return entity.type === 'acid';
}

/**
 * Check if entity is medbay.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'medbay'
 */
export function isMedbay(entity: EntityData): entity is MedbayData {
  return entity.type === 'medbay';
}

/**
 * Check if entity is ice.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'ice'
 */
export function isIce(entity: EntityData): entity is IceData {
  return entity.type === 'ice';
}

/**
 * Check if entity is mud.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'mud'
 */
export function isMud(entity: EntityData): entity is MudData {
  return entity.type === 'mud';
}

/**
 * Check if entity is poison gas.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'poison-gas'
 */
export function isPoisonGas(entity: EntityData): entity is PoisonGasData {
  return entity.type === 'poison-gas';
}

/**
 * Check if entity is water.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'water'
 */
export function isWater(entity: EntityData): entity is WaterData {
  return entity.type === 'water';
}

export function isAsh(entity: EntityData): entity is AshData {
  return entity.type === 'ash';
}

/**
 * Check if entity is an open door.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'open-door'
 */
export function isOpenDoor(entity: EntityData): entity is OpenDoorData {
  return entity.type === 'open-door';
}

/**
 * Check if entity is grass.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'grass'
 */
export function isGrass(entity: EntityData): entity is GrassData {
  return entity.type === 'grass';
}

/**
 * Check if entity is gasoline.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'gasoline'
 */
export function isGasoline(entity: EntityData): entity is GasolineData {
  return entity.type === 'gasoline';
}

/**
 * Check if entity is fuse.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'fuse'
 */
export function isFuse(entity: EntityData): entity is FuseData {
  return entity.type === 'fuse';
}

/**
 * Check if entity is torch.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'torch'
 */
export function isTorch(entity: EntityData): entity is TorchData {
  return entity.type === 'torch';
}

/**
 * Check if entity is a barrel.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'barrel'
 */
export function isBarrel(entity: EntityData): entity is BarrelData {
  return entity.type === 'barrel';
}

/**
 * Check if entity is an explosion visual.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'explosion-visual'
 */
export function isExplosionVisual(entity: EntityData): entity is ExplosionVisualData {
  return entity.type === 'explosion-visual';
}

/**
 * Check if entity is a destructible wall.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'destructible-wall'
 */
export function isDestructibleWall(entity: EntityData): entity is DestructibleWallData {
  return entity.type === 'destructible-wall';
}

/**
 * Check if entity is a chain link.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'chain-link'
 */
export function isChainLink(entity: EntityData): entity is ChainLinkData {
  return entity.type === 'chain-link';
}

/**
 * Check if entity is a fire visual.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'fire-visual'
 */
export function isFireVisual(entity: EntityData): entity is FireVisualData {
  return entity.type === 'fire-visual';
}

/**
 * Combined Trait + Type Guards
 *
 * Convenience guards that check both entity type and trait possession.
 * More strict verification - useful for critical operations.
 */

/**
 * Check if entity is fire (legacy or visual).
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'fire' or 'fire-visual'
 */
export function isFire(entity: EntityData): entity is FireVisualData {
  return entity.type === 'fire' || entity.type === 'fire-visual';
}

/**
 * Check if entity is a player with health trait.
 *
 * More strict than isPlayer() - also verifies health trait exists.
 *
 * @param entity - Entity to check
 * @returns true if entity is player type and possesses health trait
 */
export function isPlayerWithHealth(entity: EntityData): entity is PlayerData {
  return isPlayer(entity) && hasHealth(entity);
}

/**
 * Check if entity is an enemy with AI trait.
 *
 * More strict than isEnemy() - also verifies AI trait exists.
 *
 * @param entity - Entity to check
 * @returns true if entity is enemy type and possesses AI trait
 */
export function isEnemyWithAI(entity: EntityData): entity is EnemyData {
  return isEnemy(entity) && hasAI(entity);
}

/**
 * Check if entity is a teleporter with target trait.
 *
 * More strict than isTeleporter() - also verifies teleport target trait exists.
 *
 * @param entity - Entity to check
 * @returns true if entity is teleporter type and possesses teleport target trait
 */
export function isTeleporterWithTarget(
  entity: EntityData
): entity is TeleporterData {
  return isTeleporter(entity) && hasTeleportTarget(entity);
}
