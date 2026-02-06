/**
 * EntityData - Discriminated union of all entity types.
 */
import type { BaseEntityData } from './base.entity';
import type { PlayerData } from './player.entity';
import type { EnemyData, GuardData } from './enemy.entity';
import type { TeleporterData } from './teleporter.entity';
import type { ItemData, KeyData, GasolineData, FuseData } from './collectible.entity';
import type { WallData, DoorData, OpenDoorData, TorchData, DestructibleWallData, SpawnerData } from './structure.entity';
import type { LavaData, AcidData, MedbayData, IceData, MudData, BarrelData } from './hazard.entity';
import type { FireVisualData, PoisonGasData, WaterData, AshData, GrassData, ExplosionVisualData, ProjectileData, RayEffectData } from './elemental.entity';
import type { ChainLinkData, PathNodeData, SleepWakeData } from './logic.entity';
import type { OscillatorData, PressureSwitchData, InverterData, ConductiveFloorData, GateData, TransceiverData, RangeSensorData } from './signal.entity';
import type { PlayerStartData, CheckpointData } from './spawning.entity';
import type { HealthPackData, HealthPotionData, ShieldPackData, SpeedBoostData, DamageBoostData, InvincibilityData, AmmoPackData, WeaponPickupData } from './powerup.entity';
import type { CoinData, FlagData, ExitData } from './objective.entity';

// Re-export commonly used types for external consumption
export type { BaseEntityData, TeleporterData, PlayerData, EnemyData, GuardData };
export type { ItemData, KeyData, GasolineData, FuseData };
export type { WallData, DoorData, OpenDoorData, TorchData, DestructibleWallData, SpawnerData };
export type { LavaData, AcidData, MedbayData, IceData, MudData, BarrelData };
export type { FireVisualData, PoisonGasData, WaterData, AshData, GrassData, ExplosionVisualData, ProjectileData, RayEffectData };
export type { ChainLinkData, PathNodeData, SleepWakeData };
export type { OscillatorData, PressureSwitchData, InverterData, ConductiveFloorData, GateData, TransceiverData, RangeSensorData };
export type { PlayerStartData, CheckpointData };
export type { HealthPackData, HealthPotionData, ShieldPackData, SpeedBoostData, DamageBoostData, InvincibilityData, AmmoPackData, WeaponPickupData };
export type { CoinData, FlagData, ExitData };

export type EntityData = PlayerData |
  EnemyData |
  TeleporterData |
  ItemData |
  WallData |
  DoorData |
  KeyData |
  OpenDoorData |
  LavaData |
  AcidData |
  MedbayData |
  IceData |
  MudData |
  PoisonGasData |
  WaterData |
  AshData |
  GrassData |
  GasolineData |
  FuseData |
  TorchData |
  BarrelData |
  ExplosionVisualData |
  DestructibleWallData |
  ChainLinkData |
  PathNodeData |
  SleepWakeData |
  FireVisualData |
  OscillatorData |
  PressureSwitchData |
  InverterData |
  ConductiveFloorData |
  GateData |
  TransceiverData |
  SpawnerData |
  PlayerStartData |
  CheckpointData |
  HealthPackData |
  HealthPotionData |
  ShieldPackData |
  SpeedBoostData |
  DamageBoostData |
  InvincibilityData |
  AmmoPackData |
  WeaponPickupData |
  GuardData |
  ProjectileData |
  RayEffectData |
  CoinData |
  FlagData |
  ExitData |
  RangeSensorData;