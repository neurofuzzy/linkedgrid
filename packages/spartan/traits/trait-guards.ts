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
import type { HasNPCMovement } from './npc-movement.trait';
import type { HasPushable, HasPusher } from './pushable.trait';
import type { HasPlayerRole, HasTeam, Team } from './role.trait';
import type { HealthState, HasHealth } from './health.trait';
import type { HasArmor, HasShield, HasResistance, HasVulnerability } from './defense.trait';
import type { HasProjectile } from './projectile.trait';
import type { HasTurret, TurretWeaponType, TurretTargeting } from './turret.trait';
import type { HasSpawner } from './spawner.trait';
import type { HasSceneConnection } from './scene-connection.trait';
import type { HasBuff } from './buff.trait';
import type { HasTemperature } from './thermal.trait';
import type { HasScoreValue } from './objective.trait';
import type { Direction } from '../core/grid/direction';
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
  OscillatorData,
  PressureSwitchData,
  InverterData,
  ConductiveFloorData,
  TransceiverData,
  GateData,
  PathNodeData,
  SleepWakeData,
  SpawnerData,
  HealthPackData,
  ShieldPackData,
  SpeedBoostData,
  DamageBoostData,
  InvincibilityData,
  AmmoPackData,
  WeaponPickupData,
  CheckpointData,
  CoinData,
  FlagData,
  ExitData,
  RangeSensorData,
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
): entity is EntityData & HasHealth {
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
 * Check if entity has scene connection trait.
 *
 * Entities with scene connection trait can be registered in GameState.connections
 * for color-coded cross-scene portals.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses scene connection trait (connectionKey)
 */
export function hasSceneConnection(
  entity: EntityData
): entity is EntityData & HasSceneConnection {
  return 'connectionKey' in entity && typeof entity.connectionKey === 'string';
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
): entity is EntityData & { collectibleId: string } {
  return 'collectibleId' in entity && typeof entity.collectibleId === 'string';
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
): entity is EntityData & HasTemperature {
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
 * Check if entity is fire (visual effect).
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'fire-visual'
 */
export function isFire(entity: EntityData): entity is FireVisualData {
  return entity.type === 'fire-visual';
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

/**
 * Signal System Trait Guards
 *
 * These check for signal-related traits used by the signal propagation system.
 */

/**
 * Check if entity has signal emitter trait.
 *
 * Entities with signal emitter trait can generate and broadcast on/off signals.
 * Used by oscillators, pressure switches, and inverters.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses signal emitter trait
 */
export function hasSignalEmitter(
  entity: EntityData
): entity is OscillatorData | PressureSwitchData | InverterData | TransceiverData | RangeSensorData {
  if (!('signalType' in entity)) return false;
  const signalType = entity.signalType;
  return (
    (signalType === 'oscillator' || signalType === 'pressure' || signalType === 'inverter' || signalType === 'transceiver' || signalType === 'range-sensor') &&
    'signalState' in entity && typeof entity.signalState === 'boolean'
  );
}

/**
 * Check if entity has signal receiver trait.
 *
 * Entities with signal receiver trait can accept signals and respond to them.
 * Used by gates, inverters, path nodes, and sleep-wake entities.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses signal receiver trait
 */
export function hasSignalReceiver(
  entity: EntityData
): entity is GateData | InverterData | ConductiveFloorData | TransceiverData | PathNodeData | SleepWakeData {
  if (!('receiverType' in entity)) return false;
  const receiverType = entity.receiverType;
  return (
    (receiverType === 'gate' || receiverType === 'inverter' || receiverType === 'floor' || receiverType === 'transceiver' || receiverType === 'path' || receiverType === 'sleep-wake') &&
    'receivedSignal' in entity && typeof entity.receivedSignal === 'boolean'
  );
}

/**
 * Check if entity has conductive trait.
 *
 * Entities with conductive trait can carry signals between cells.
 * Used by conductive floors, path nodes, and sleep-wake entities.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses conductive trait
 */
export function hasConductive(
  entity: EntityData
): entity is EntityData & { isConductive?: boolean; conductiveType?: string } {
  if ('isConductive' in entity && entity.isConductive === true) return true;
  if (!('conductiveType' in entity)) return false;
  const conductiveType = entity.conductiveType;
  return conductiveType === 'floor' || conductiveType === 'path' || conductiveType === 'sleep-wake';
}

/**
 * Signal Entity Type Guards
 *
 * These check for specific signal entity types.
 */

/**
 * Check if entity is an oscillator.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'oscillator'
 */
export function isOscillator(entity: EntityData): entity is OscillatorData {
  return entity.type === 'oscillator';
}

/**
 * Check if entity is a pressure switch.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'pressure-switch'
 */
export function isPressureSwitch(entity: EntityData): entity is PressureSwitchData {
  return entity.type === 'pressure-switch';
}

/**
 * Check if entity is an inverter.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'inverter'
 */
export function isInverter(entity: EntityData): entity is InverterData {
  return entity.type === 'inverter';
}

/**
 * Check if entity is a conductive floor.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'conductive-floor'
 */
export function isConductiveFloor(entity: EntityData): entity is ConductiveFloorData {
  return entity.type === 'conductive-floor';
}

/**
 * Check if entity is a gate (any state).
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'gate', 'gate-open', or 'gate-closed'
 */
export function isGate(entity: EntityData): entity is GateData {
  return entity.type === 'gate' || entity.type === 'gate-open' || entity.type === 'gate-closed';
}

/**
 * Check if entity is a transceiver.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'transceiver'
 */
export function isTransceiver(entity: EntityData): entity is TransceiverData {
  return entity.type === 'transceiver';
}

/**
 * Check if entity is a range sensor.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'range-sensor'
 */
export function isRangeSensor(entity: EntityData): entity is RangeSensorData {
  return entity.type === 'range-sensor';
}

/**
 * Check if entity is a path node.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'path-node'
 */
export function isPathNode(entity: EntityData): entity is PathNodeData {
  return entity.type === 'path-node';
}

/**
 * Check if entity is a sleep-wake entity.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'sleep-wake'
 */
export function isSleepWake(entity: EntityData): entity is SleepWakeData {
  return entity.type === 'sleep-wake';
}

/**
 * NPC Movement Trait Guard
 *
 * Checks if an entity has NPC movement behavior.
 */

/**
 * Check if entity has NPC movement trait.
 *
 * Entities with NPC movement trait can be controlled by the NPCMovementSystem.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses NPC movement trait
 */
export function hasNPCMovement(
  entity: EntityData
): entity is EntityData & HasNPCMovement {
  if (!('movementMode' in entity)) return false;
  const mode = entity.movementMode;
  return mode === 'follow' || mode === 'flee' || mode === 'pursue' || mode === 'wander' || mode === 'patrol' || mode === 'guard';
}

// removed unused hasPathFollowing guard

/**
 * Role & Team Trait Guards
 *
 * These check for player role and team affiliation traits.
 */

/**
 * Check if entity is the player.
 *
 * Entities with player role trait are player-controlled.
 *
 * @param entity - Entity to check
 * @returns true if entity has player role
 */
export function hasPlayerRole(
  entity: EntityData
): entity is EntityData & HasPlayerRole {
  return 'isPlayer' in entity && entity.isPlayer === true;
}

/**
 * Check if entity has team affiliation.
 *
 * Entities with team trait belong to a faction (player, enemy, neutral).
 *
 * @param entity - Entity to check
 * @returns true if entity has team trait
 */
export function hasTeam(
  entity: EntityData
): entity is EntityData & HasTeam {
  if (!('team' in entity)) return false;
  const team = entity.team as Team;
  return team === 'player' || team === 'enemy' || team === 'neutral';
}

/**
 * Check if entity is on the player's team.
 *
 * @param entity - Entity to check
 * @returns true if entity team is 'player'
 */
export function isPlayerTeam(entity: EntityData): boolean {
  return hasTeam(entity) && entity.team === 'player';
}

/**
 * Check if entity is on the enemy team.
 *
 * @param entity - Entity to check
 * @returns true if entity team is 'enemy'
 */
export function isEnemyTeam(entity: EntityData): boolean {
  return hasTeam(entity) && entity.team === 'enemy';
}

/**
 * Check if entity has health state trait.
 *
 * Entities with health state can be in 'alive', 'dying', or 'dead' states.
 *
 * @param entity - Entity to check
 * @returns true if entity has health state
 */
export function hasHealthState(
  entity: EntityData
): entity is EntityData & { healthState: HealthState } {
  if (!('healthState' in entity)) return false;
  const state = entity.healthState as HealthState;
  return state === 'alive' || state === 'dying' || state === 'dead';
}

/**
 * Check if entity is alive (not dying or dead).
 *
 * @param entity - Entity to check
 * @returns true if entity is alive
 */
export function isEntityAlive(entity: EntityData): boolean {
  // If no health state, assume alive
  if (!('healthState' in entity)) return true;
  return entity.healthState === 'alive';
}

/**
 * Check if entity is dying (death animation playing).
 *
 * @param entity - Entity to check
 * @returns true if entity is in dying state
 */
export function isEntityDying(entity: EntityData): boolean {
  return 'healthState' in entity && entity.healthState === 'dying';
}

/**
 * Check if entity is dead (marked for removal).
 *
 * @param entity - Entity to check
 * @returns true if entity is dead
 */
export function isEntityDead(entity: EntityData): boolean {
  return 'healthState' in entity && entity.healthState === 'dead';
}

/**
 * Defense Trait Guards
 *
 * These check for armor, shields, and resistance traits.
 */

/**
 * Check if entity has armor.
 *
 * @param entity - Entity to check
 * @returns true if entity has armor trait
 */
export function hasArmor(
  entity: EntityData
): entity is EntityData & HasArmor {
  return 'armor' in entity && typeof entity.armor === 'number';
}

/**
 * Check if entity has shields.
 *
 * @param entity - Entity to check
 * @returns true if entity has shield trait
 */
export function hasShield(
  entity: EntityData
): entity is EntityData & HasShield {
  return (
    'shield' in entity &&
    typeof entity.shield === 'number' &&
    'maxShield' in entity &&
    typeof entity.maxShield === 'number'
  );
}

/**
 * Check if entity has resistance.
 *
 * @param entity - Entity to check
 * @returns true if entity has resistance trait
 */
export function hasResistance(
  entity: EntityData
): entity is EntityData & HasResistance {
  return 'resistance' in entity && typeof entity.resistance === 'number';
}

/**
 * Check if entity has vulnerability multipliers.
 *
 * @param entity - Entity to check
 * @returns true if entity has vulnerabilities trait
 */
export function hasVulnerability(
  entity: EntityData
): entity is EntityData & HasVulnerability {
  return (
    'vulnerabilities' in entity &&
    typeof entity.vulnerabilities === 'object' &&
    entity.vulnerabilities !== null
  );
}

/**
 * Projectile & Turret Trait Guards
 *
 * These check for projectile and turret combat traits.
 */

/**
 * Check if entity is a projectile.
 *
 * @param entity - Entity to check
 * @returns true if entity has projectile trait
 */
export function hasProjectile(
  entity: EntityData
): entity is EntityData & HasProjectile {
  return (
    'targetX' in entity &&
    typeof entity.targetX === 'number' &&
    'targetY' in entity &&
    typeof entity.targetY === 'number' &&
    'damage' in entity &&
    typeof entity.damage === 'number'
  );
}

/**
 * Check if entity is a turret.
 *
 * @param entity - Entity to check
 * @returns true if entity has turret trait
 */
export function hasTurret(
  entity: EntityData
): entity is EntityData & HasTurret {
  if (!('weaponType' in entity) || !('targeting' in entity)) return false;
  const weaponType = entity.weaponType as TurretWeaponType;
  const targeting = entity.targeting as TurretTargeting;
  const validWeapon = weaponType === 'projectile' || weaponType === 'ray';
  const validTargeting = targeting === 'nearest' || targeting === 'player' || targeting === 'fixed' || targeting === 'cardinal';
  return validWeapon && validTargeting && 'cooldown' in entity && 'range' in entity;
}

/**
 * Spawner Trait Guard
 *
 * Checks if an entity can spawn other entities.
 */

/**
 * Check if entity is a spawner.
 *
 * Entities with spawner trait can spawn other entities in adjacent cells.
 *
 * @param entity - Entity to check
 * @returns true if entity has spawner trait
 */
export function hasSpawner(
  entity: EntityData
): entity is EntityData & HasSpawner {
  return (
    'spawnType' in entity &&
    typeof entity.spawnType === 'string' &&
    'spawnLimit' in entity &&
    typeof entity.spawnLimit === 'number' &&
    'cooldown' in entity &&
    typeof entity.cooldown === 'number' &&
    'spawnLayer' in entity &&
    typeof entity.spawnLayer === 'number' &&
    'activationRange' in entity &&
    typeof entity.activationRange === 'number'
  );
}

/**
 * Check if entity is a spawner (type check).
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'spawner'
 */
export function isSpawner(entity: EntityData): entity is SpawnerData {
  return entity.type === 'spawner';
}

export function hasPushable(entity: EntityData): entity is EntityData & HasPushable {
  return 'isPushable' in entity && typeof entity.isPushable === 'boolean';
}

export function hasPusher(entity: EntityData): entity is EntityData & HasPusher {
  return 'pushStrength' in entity && typeof entity.pushStrength === 'number';
}

/**
 * Melee Trait Guard
 *
 * Checks if an entity can perform melee attacks.
 */

/**
 * Check if entity has melee attack capability.
 *
 * Entities with melee trait can attack adjacent cells.
 *
 * @param entity - Entity to check
 * @returns true if entity has melee trait
 */
export function hasMelee(
  entity: EntityData
): entity is EntityData & {
  meleeDamage: number;
  meleeCooldown: number;
  meleeRange: number;
  lastMeleeAttackTick?: number;
  meleeDirection?: Direction;
} {
  return (
    'meleeDamage' in entity &&
    typeof entity.meleeDamage === 'number' &&
    'meleeCooldown' in entity &&
    typeof entity.meleeCooldown === 'number' &&
    'meleeRange' in entity &&
    typeof entity.meleeRange === 'number'
  );
}

/**
 * Check if entity has ranged weapon capability.
 *
 * Entities with weapon trait can fire projectiles.
 *
 * @param entity - Entity to check
 * @returns true if entity has weapon trait
 */
export function hasWeapon(
  entity: EntityData
): entity is EntityData & {
  equippedWeapon: string;
  ammo: Record<string, number>;
  unlimitedAmmo?: boolean;
  lastFireTick?: number;
  fireDirection?: Direction;
} {
  return (
    'equippedWeapon' in entity &&
    typeof entity.equippedWeapon === 'string' &&
    'ammo' in entity &&
    typeof entity.ammo === 'object' &&
    entity.ammo !== null
  );
}

/**
 * Check if entity has checkpoint tracking capability.
 *
 * Entities with checkpoint trait can respawn at checkpoints.
 *
 * @param entity - Entity to check
 * @returns true if entity has checkpoint trait
 */
export function hasCheckpoint(
  entity: EntityData
): entity is EntityData & { lastCheckpointId?: number; lastCheckpointSceneId?: string; lastCheckpointX?: number; lastCheckpointY?: number } {
  // The trait is optional properties, so we check if ANY checkpoint property exists
  return (
    'lastCheckpointId' in entity ||
    'lastCheckpointSceneId' in entity ||
    'lastCheckpointX' in entity ||
    'lastCheckpointY' in entity
  );
}

/**
 * Check if entity is a player-start marker.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'player-start'
 */
export function isPlayerStart(entity: EntityData): boolean {
  return entity.type === 'player-start';
}

/**
 * Check if entity is a checkpoint.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'checkpoint'
 */
export function isCheckpoint(entity: EntityData): entity is CheckpointData {
  return entity.type === 'checkpoint';
}

/**
 * Buff Trait Guards
 *
 * These check for buff-related traits.
 */

/**
 * Check if entity can have buffs.
 *
 * Entities with buff trait can receive temporary status effects.
 *
 * @param entity - Entity to check
 * @returns true if entity has buff trait (activeBuffs array)
 */
export function hasBuff(
  entity: EntityData
): entity is EntityData & HasBuff {
  return 'activeBuffs' in entity && Array.isArray(entity.activeBuffs);
}

/**
 * Powerup Entity Type Guards
 *
 * These check for specific powerup entity types.
 */

/**
 * Check if entity is a health pack.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'health-pack'
 */
export function isHealthPack(entity: EntityData): entity is HealthPackData {
  return entity.type === 'health-pack';
}

/**
 * Check if entity is a shield pack.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'shield-pack'
 */
export function isShieldPack(entity: EntityData): entity is ShieldPackData {
  return entity.type === 'shield-pack';
}

/**
 * Check if entity is a speed boost.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'speed-boost'
 */
export function isSpeedBoost(entity: EntityData): entity is SpeedBoostData {
  return entity.type === 'speed-boost';
}

/**
 * Check if entity is a damage boost.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'damage-boost'
 */
export function isDamageBoost(entity: EntityData): entity is DamageBoostData {
  return entity.type === 'damage-boost';
}

/**
 * Check if entity is an invincibility powerup.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'invincibility'
 */
export function isInvincibility(entity: EntityData): entity is InvincibilityData {
  return entity.type === 'invincibility';
}

/**
 * Check if entity is an ammo pack.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'ammo-pack'
 */
export function isAmmoPack(entity: EntityData): entity is AmmoPackData {
  return entity.type === 'ammo-pack';
}

/**
 * Check if entity is a weapon pickup.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'weapon-pickup'
 */
export function isWeaponPickup(entity: EntityData): entity is WeaponPickupData {
  return entity.type === 'weapon-pickup';
}

/**
 * Check if entity is any powerup type.
 *
 * @param entity - Entity to check
 * @returns true if entity is a collectible powerup
 */
export function isPowerup(entity: EntityData): entity is HealthPackData | ShieldPackData | SpeedBoostData | DamageBoostData | InvincibilityData | AmmoPackData | WeaponPickupData {
  return (
    isHealthPack(entity) ||
    isShieldPack(entity) ||
    isSpeedBoost(entity) ||
    isDamageBoost(entity) ||
    isInvincibility(entity) ||
    isAmmoPack(entity) ||
    isWeaponPickup(entity)
  );
}

// === Objective Entity Guards ===

/**
 * Check if entity is a coin.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'coin'
 */
export function isCoin(entity: EntityData): entity is CoinData {
  return entity.type === 'coin';
}

/**
 * Check if entity is a flag.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'flag'
 */
export function isFlag(entity: EntityData): entity is FlagData {
  return entity.type === 'flag';
}

/**
 * Check if entity is an exit.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'exit'
 */
export function isExit(entity: EntityData): entity is ExitData {
  return entity.type === 'exit';
}

/**
 * Check if entity has a score value.
 *
 * @param entity - Entity to check
 * @returns true if entity has scoreValue property
 */
export function hasScoreValue(entity: EntityData): entity is EntityData & HasScoreValue {
  return typeof entity.scoreValue === 'number';
}
