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

export { BaseEntityData };

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
  FireVisualData;