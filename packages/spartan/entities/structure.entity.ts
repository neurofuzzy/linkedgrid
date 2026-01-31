import { BaseEntityData } from './base.entity';
import { IsLockable, HasColor, HasHealth, HasDamageable } from '../traits';

export type WallData = BaseEntityData & {
  type: 'wall';
};

export type DoorData = BaseEntityData & {
  type: 'door';
} & IsLockable &
  HasColor;

export type OpenDoorData = BaseEntityData & {
  type: 'open-door';
} & HasColor;

export type TorchData = BaseEntityData & {
  type: 'torch';
} & HasColor;

export type DestructibleWallData = BaseEntityData & {
  type: 'destructible-wall';
} & HasHealth & HasDamageable & HasColor;
