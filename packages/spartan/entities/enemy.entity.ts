/**
 * @brief Enemy entity definitions.
 */
import { BaseEntityData } from './base.entity';
import { HasHealth, CanDealDamage, HasAI } from '../traits';

export type EnemyData = BaseEntityData & {
  type: 'enemy';
} & HasHealth &
  CanDealDamage &
  HasAI;
