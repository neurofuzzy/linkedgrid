/**
 * EntityData - Discriminated union of all entity types.
 */
import { HasPushable, HasPusher } from '../traits/pushable.trait';

import { BaseEntityData } from './base.entity';
import { PlayerData } from './player.entity';
import { EnemyData } from './enemy.entity';
import { TeleporterData } from './teleporter.entity';
import { ItemData, KeyData, GasolineData, FuseData } from './collectible.entity';
import { WallData, DoorData, OpenDoorData, TorchData, DestructibleWallData, SpawnerData } from './structure.entity';
import { LavaData, AcidData, MedbayData, IceData, MudData, BarrelData } from './hazard.entity';
import { FireVisualData, PoisonGasData, WaterData, AshData, GrassData, ExplosionVisualData } from './elemental.entity';
import { ChainLinkData, PathNodeData, SleepWakeData } from './logic.entity';
import { OscillatorData, PressureSwitchData, InverterData, ConductiveFloorData, GateData, TransceiverData } from './signal.entity';
import { PlayerStartData, CheckpointData } from './spawning.entity';
import { HealthPackData, ShieldPackData, SpeedBoostData, DamageBoostData, InvincibilityData, AmmoPackData } from './powerup.entity';

// Re-export commonly used types for external consumption
export { BaseEntityData, TeleporterData, PlayerData, EnemyData };
export { ItemData, KeyData, GasolineData, FuseData };
export { WallData, DoorData, OpenDoorData, TorchData, DestructibleWallData, SpawnerData };
export { LavaData, AcidData, MedbayData, IceData, MudData, BarrelData };
export { FireVisualData, PoisonGasData, WaterData, AshData, GrassData, ExplosionVisualData };
export { ChainLinkData, PathNodeData, SleepWakeData };
export { OscillatorData, PressureSwitchData, InverterData, ConductiveFloorData, GateData, TransceiverData };
export { PlayerStartData, CheckpointData };
export { HealthPackData, ShieldPackData, SpeedBoostData, DamageBoostData, InvincibilityData, AmmoPackData };

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
  ShieldPackData |
  SpeedBoostData |
  DamageBoostData |
  InvincibilityData |
  AmmoPackData;