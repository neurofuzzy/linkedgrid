/**
 * @brief Structural entity definitions.
 */
import { BaseEntityData } from './base.entity';
import { IsLockable, HasColor, HasHealth, HasDamageable, HasSpawner } from '../traits';

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

/**
 * Spawner - Entity that spawns other entities in adjacent cells.
 *
 * Spawners:
 * - Spawn entities when player is in range and has line of sight
 * - Or activate via sleep-wake zone signals
 * - Have spawn limits and cooldowns
 * - Can be grouped with adjacent spawners for coordination
 * - Optionally damageable (can be destroyed)
 */
export type SpawnerData = BaseEntityData & {
  type: 'spawner';
} & HasSpawner & HasColor;
