/**
 * @brief Player entity definition.
 */
import { BaseEntityData } from './base.entity';
import { HasHealth, CanDealDamage, HasSceneLocation, HasInventory, HasPusher } from '../traits';
import { HasWeapon } from '../traits/weapon.trait';

export type PlayerData = BaseEntityData & {
  type: 'player';
} & HasHealth &
  CanDealDamage &
  HasSceneLocation &
  HasInventory &
  HasPusher &
  HasWeapon & {
    /** ID of the last activated checkpoint entity */
    lastCheckpointId?: number;
    /** Scene ID of the last activated checkpoint */
    lastCheckpointSceneId?: string;
    /** X coordinate of the last activated checkpoint */
    lastCheckpointX?: number;
    /** Y coordinate of the last activated checkpoint */
    lastCheckpointY?: number;
  };
