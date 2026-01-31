import { BaseEntityData } from './base.entity';
import { HasFloorEffect, HasColor, HasHealth, HasExplosion, HasTemperature } from '../traits';

export type LavaData = BaseEntityData & {
  type: 'lava';
} & HasFloorEffect & HasColor;

export type AcidData = BaseEntityData & {
  type: 'acid';
} & HasFloorEffect & HasColor;

export type MedbayData = BaseEntityData & {
  type: 'medbay';
} & HasFloorEffect & HasColor;

export type IceData = BaseEntityData & {
  type: 'ice';
} & HasFloorEffect & HasColor;

export type MudData = BaseEntityData & {
  type: 'mud';
} & HasFloorEffect & HasColor;

export type BarrelData = BaseEntityData & {
  type: 'barrel';
} & HasHealth & HasExplosion & HasTemperature & HasColor;
