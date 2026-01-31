import { BaseEntityData } from './base.entity';
import { HasPropagation, HasFloorEffect, HasColor, HasDensity, HasLiquid, HasHealth, HasTemperature } from '../traits';

export type FireVisualData = BaseEntityData & {
  type: 'fire-visual';
} & HasColor;

export type PoisonGasData = BaseEntityData & {
  type: 'poison-gas';
} & HasPropagation & HasFloorEffect & HasColor & HasDensity;

export type WaterData = BaseEntityData & {
  type: 'water';
} & HasPropagation & HasColor & HasLiquid;

export type AshData = BaseEntityData & {
  type: 'ash';
} & HasColor;

export type GrassData = BaseEntityData & {
  type: 'grass';
} & HasHealth & HasTemperature & HasColor;

export type ExplosionVisualData = BaseEntityData & {
  type: 'explosion-visual';
  lifetime: number;
} & HasColor;
