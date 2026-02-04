/**
 * @brief Player entity definition.
 */
import { BaseEntityData } from './base.entity';
import { HasHealth, CanDealDamage, HasSceneLocation, HasInventory, HasPusher } from '../traits';

export type PlayerData = BaseEntityData & {
  type: 'player';
} & HasHealth &
  CanDealDamage &
  HasSceneLocation &
  HasInventory &
  HasPusher;
