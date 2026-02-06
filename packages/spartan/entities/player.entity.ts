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
  HasWeapon;
