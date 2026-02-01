import { BaseEntityData } from './base.entity';
import { HasHealth, CanDealDamage, HasSceneLocation, HasInventory } from '../traits';

export type PlayerData = BaseEntityData & {
  type: 'player';
} & HasHealth &
  CanDealDamage &
  HasSceneLocation &
  HasInventory;
