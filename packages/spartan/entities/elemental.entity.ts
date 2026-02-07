/**
 * @brief Elemental effect entities.
 */
import { BaseEntityData } from './base.entity';
import { HasPropagation, HasFloorEffect, HasColor, HasDensity, HasLiquid, HasHealth, HasTemperature } from '../traits';
import { HasProjectile } from '../traits/projectile.trait';
import type { HasFreeBody } from '../traits/free-body.trait';

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

/**
 * ProjectileData - Moving projectile entity.
 * Used for bullets, arrows, fireballs, etc.
 *
 * Projectiles are free-body entities: they do NOT occupy grid cells.
 * Position is tracked via FreeBodyStore with sub-cell float precision.
 */
export type ProjectileData = BaseEntityData & {
  type: 'projectile';
  ephemeral?: boolean;
} & HasProjectile & HasFreeBody & Partial<HasColor>;

/**
 * RayEffectData - Visual ray/beam effect.
 * Used for instant-hit weapon visuals.
 */
export type RayEffectData = BaseEntityData & {
  type: 'ray-effect';
  lifetime: number;
  spawnTick?: number;
  ephemeral?: boolean;
} & Partial<HasColor>;
