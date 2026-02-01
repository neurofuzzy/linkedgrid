/**
 * EntityData - Discriminated union of all entity types.
 */

import { BaseEntityData } from './base.entity';
import { PlayerData } from './player.entity';
import { EnemyData } from './enemy.entity';
import { TeleporterData } from './teleporter.entity';
import { ItemData, KeyData, GasolineData, FuseData } from './collectible.entity';
import { WallData, DoorData, OpenDoorData, TorchData, DestructibleWallData } from './structure.entity';
import { LavaData, AcidData, MedbayData, IceData, MudData, BarrelData } from './hazard.entity';
import { FireVisualData, PoisonGasData, WaterData, AshData, GrassData, ExplosionVisualData } from './elemental.entity';
import { ChainLinkData } from './logic.entity';
import { OscillatorData, PressureSwitchData, InverterData, ConductiveFloorData, BollardData, TransceiverData } from './signal.entity';

// Re-export commonly used types for external consumption
export { BaseEntityData, TeleporterData, PlayerData, EnemyData };
export { ItemData, KeyData, GasolineData, FuseData };
export { WallData, DoorData, OpenDoorData, TorchData, DestructibleWallData };
export { LavaData, AcidData, MedbayData, IceData, MudData, BarrelData };
export { FireVisualData, PoisonGasData, WaterData, AshData, GrassData, ExplosionVisualData };
export { ChainLinkData };
export { OscillatorData, PressureSwitchData, InverterData, ConductiveFloorData, BollardData, TransceiverData };

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
  FireVisualData |
  OscillatorData |
  PressureSwitchData |
  InverterData |
  ConductiveFloorData |
  BollardData |
  TransceiverData;