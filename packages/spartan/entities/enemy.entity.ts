/**
 * @brief Enemy entity definitions.
 */
import { BaseEntityData } from './base.entity';
import { HasHealth, CanDealDamage, HasAI } from '../traits';
import { HasNPCMovement } from '../traits/npc-movement.trait';

export type EnemyData = BaseEntityData & {
  type: 'enemy';
} & HasHealth &
  CanDealDamage &
  HasAI;

/**
 * GuardData - NPC guard entity with autonomous movement.
 * Uses HasNPCMovement for patrol/guard behavior.
 */
export type GuardData = BaseEntityData & {
  type: 'guard';
} & Partial<HasHealth> &
  HasNPCMovement;
