/**
 * @brief Enemy entity definitions.
 *
 * EnemyData is the base hostile entity with health, damage, and AI.
 * GuardData adds autonomous NPC movement (patrol, guard, pursue, etc.).
 *
 * Both support optional persona properties (armor, hardness, scoreValue, shield)
 * for tiered NPC configuration via CHARACTER_PERSONAS.
 */
import { BaseEntityData } from './base.entity';
import { HasHealth, CanDealDamage, HasAI } from '../traits';
import { HasNPCMovement } from '../traits/npc-movement.trait';
import type { HasArmor, HasShield, HasResistance } from '../traits/defense.trait';
import type { HasDamageable } from '../traits/combat.trait';
import type { HasScoreValue } from '../traits/objective.trait';
import type { HasMelee } from '../traits/melee.trait';

export type EnemyData = BaseEntityData & {
  type: 'enemy';
} & HasHealth &
  CanDealDamage &
  HasAI &
  Partial<HasArmor> &
  Partial<HasDamageable> &
  Partial<HasScoreValue> &
  Partial<HasShield> &
  Partial<HasResistance> &
  Partial<HasMelee> &
  Partial<HasNPCMovement>;

/**
 * GuardData - NPC guard entity with autonomous movement.
 * Uses HasNPCMovement for patrol/guard behavior.
 * Supports full persona properties for tiered NPC configuration.
 */
export type GuardData = BaseEntityData & {
  type: 'guard';
} & HasHealth &
  HasNPCMovement &
  Partial<CanDealDamage> &
  Partial<HasArmor> &
  Partial<HasDamageable> &
  Partial<HasScoreValue> &
  Partial<HasShield> &
  Partial<HasResistance> &
  Partial<HasMelee>;
