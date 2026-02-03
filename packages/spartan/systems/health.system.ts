/**
 * @brief Health System - Intent-based health management with death states.
 *
 * Only the HealthSystem can modify entity health. Other systems stage
 * damage/heal intents which are processed atomically each tick.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext, EntityData } from '../core/types';
import { hasHealth, hasHealthState } from '../traits/trait-guards';
import type { HealthState } from '../traits/health.trait';

/**
 * Damage intent - Request to deal damage to an entity.
 */
export interface DamageIntent {
  type: 'damage';
  /** Target entity ID */
  targetId: number;
  /** Base damage amount (before mitigation) */
  amount: number;
  /** Optional damage type for vulnerability/resistance calculations */
  damageType?: string;
  /** Source entity ID (for tracking who dealt the damage) */
  sourceId?: number;
}

/**
 * Heal intent - Request to heal an entity.
 */
export interface HealIntent {
  type: 'heal';
  /** Target entity ID */
  targetId: number;
  /** Heal amount */
  amount: number;
  /** Source entity ID (for tracking) */
  sourceId?: number;
}

export type HealthIntent = DamageIntent | HealIntent;

/**
 * Configuration for death animation/delay.
 */
export interface HealthSystemConfig {
  /** Number of ticks to remain in 'dying' state before transitioning to 'dead' (default: 3) */
  dyingDuration: number;
}

const DEFAULT_CONFIG: HealthSystemConfig = {
  dyingDuration: 3,
};

/**
 * HealthSystem - Manages entity health through intent-based damage/healing.
 *
 * Key responsibilities:
 * 1. Process damage/heal intents staged by other systems
 * 2. Apply damage mitigation (armor, shields, resistance)
 * 3. Manage death state transitions (alive → dying → dead)
 * 4. Remove dead entities from the game
 *
 * Intent-based architecture (similar to SpatialSystem):
 * - Other systems call healthSystem.damage() or healthSystem.heal()
 * - Intents are queued and processed during update()
 * - Final HP changes are applied atomically
 *
 * @system
 * @reactsTo Health intents from other systems
 * @modifies Entity hp, healthState, dyingTicks
 *
 * @example
 * ```typescript
 * // Other systems stage damage intents
 * healthSystem.damage(targetId, 25, 'fire', attackerId);
 *
 * // HealthSystem processes during update
 * // - Applies armor/shield/resistance
 * // - Updates HP
 * // - Handles death if HP <= 0
 * ```
 */
export class HealthSystem extends BaseReactiveSystem {
  private intents: HealthIntent[] = [];
  private config: HealthSystemConfig;

  constructor(config: Partial<HealthSystemConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Stage a damage intent.
   *
   * The damage will be processed during the next update() call,
   * after mitigation (armor, shields, resistance).
   *
   * @param targetId - Entity to damage
   * @param amount - Base damage amount (before mitigation)
   * @param damageType - Optional damage type for vulnerabilities
   * @param sourceId - Optional source entity ID
   */
  damage(targetId: number, amount: number, damageType?: string, sourceId?: number): void {
    this.intents.push({
      type: 'damage',
      targetId,
      amount,
      damageType,
      sourceId,
    });
  }

  /**
   * Stage a heal intent.
   *
   * The heal will be processed during the next update() call.
   * Healing cannot exceed maxHp.
   *
   * @param targetId - Entity to heal
   * @param amount - Heal amount
   * @param sourceId - Optional source entity ID
   */
  heal(targetId: number, amount: number, sourceId?: number): void {
    this.intents.push({
      type: 'heal',
      targetId,
      amount,
      sourceId,
    });
  }

  /**
   * Get queued intents (for debugging).
   */
  getQueuedIntents(): ReadonlyArray<HealthIntent> {
    return this.intents;
  }

  /**
   * Process all health intents and handle death states.
   */
  update(context: GameContext): void {
    const currentTick = context.tick ?? 0;

    // Process all staged intents
    this.processIntents(context);

    // Handle death state transitions
    this.processDyingEntities(context, currentTick);

    // Remove dead entities
    this.removeDeadEntities(context);

    // Clear intents for next tick
    this.intents = [];
  }

  /**
   * Process all damage and heal intents.
   */
  private processIntents(context: GameContext): void {
    for (const intent of this.intents) {
      const entityData = context.spatial.getEntityData(intent.targetId);
      if (!entityData || !hasHealth(entityData)) continue;

      // Skip dead/dying entities
      if (hasHealthState(entityData) && entityData.healthState !== 'alive') {
        continue;
      }

      if (intent.type === 'damage') {
        this.applyDamage(context, intent.targetId, entityData, intent);
      } else {
        this.applyHeal(entityData, intent);
      }
    }
  }

  /**
   * Apply damage to an entity after mitigation.
   */
  private applyDamage(
    context: GameContext,
    entityId: number,
    entityData: EntityData & { hp: number; maxHp: number; healthState?: HealthState },
    intent: DamageIntent
  ): void {
    let damage = intent.amount;

    // Apply armor (flat reduction)
    if ('armor' in entityData && typeof entityData.armor === 'number') {
      damage = Math.max(1, damage - entityData.armor); // Minimum 1 damage
    }

    // Apply resistance (percentage reduction)
    if ('resistance' in entityData && typeof entityData.resistance === 'number') {
      damage = Math.floor(damage * (1 - entityData.resistance));
    }

    // Apply vulnerabilities
    if (intent.damageType && 'vulnerabilities' in entityData) {
      const vuln = entityData.vulnerabilities as Record<string, number>;
      if (vuln[intent.damageType] !== undefined) {
        damage = Math.floor(damage * vuln[intent.damageType]);
      }
    }

    // Apply to shield first
    if ('shield' in entityData && typeof entityData.shield === 'number' && entityData.shield > 0) {
      const shieldDamage = Math.min(entityData.shield, damage);
      entityData.shield -= shieldDamage;
      damage -= shieldDamage;

      // Track when shield was last damaged for regen delay
      if ('lastShieldDamageTick' in entityData || 'shieldRegenDelay' in entityData) {
        (entityData as { lastShieldDamageTick?: number }).lastShieldDamageTick = context.tick ?? 0;
      }
    }

    // Apply remaining damage to HP
    if (damage > 0) {
      entityData.hp = Math.max(0, entityData.hp - damage);
    }

    // Check for death
    if (entityData.hp <= 0) {
      this.startDying(entityData);
    }
  }

  /**
   * Apply healing to an entity.
   */
  private applyHeal(
    entityData: EntityData & { hp: number; maxHp: number },
    intent: HealIntent
  ): void {
    entityData.hp = Math.min(entityData.maxHp, entityData.hp + intent.amount);
  }

  /**
   * Transition entity to dying state.
   */
  private startDying(entityData: EntityData & { hp: number; maxHp: number; healthState?: HealthState }): void {
    entityData.healthState = 'dying';
    (entityData as { dyingTicks?: number }).dyingTicks = this.config.dyingDuration;
  }

  /**
   * Process entities in dying state (countdown to dead).
   */
  private processDyingEntities(context: GameContext, _currentTick: number): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasHealth(entityData)) continue;

      if (hasHealthState(entityData) && entityData.healthState === 'dying') {
        const dyingTicks = (entityData as { dyingTicks?: number }).dyingTicks ?? 0;

        if (dyingTicks <= 1) {
          // Transition to dead
          entityData.healthState = 'dead';
        } else {
          // Countdown
          (entityData as { dyingTicks?: number }).dyingTicks = dyingTicks - 1;
        }
      }

      // Process shield regeneration
      this.processShieldRegen(entityData, context.tick ?? 0);
    }
  }

  /**
   * Handle shield regeneration.
   */
  private processShieldRegen(entityData: EntityData, currentTick: number): void {
    if (!('shield' in entityData) || !('maxShield' in entityData)) return;

    const shield = entityData.shield as number;
    const maxShield = entityData.maxShield as number;
    const regenRate = (entityData as { shieldRegenRate?: number }).shieldRegenRate ?? 0;
    const regenDelay = (entityData as { shieldRegenDelay?: number }).shieldRegenDelay ?? 0;
    const lastDamage = (entityData as { lastShieldDamageTick?: number }).lastShieldDamageTick ?? 0;

    if (regenRate <= 0 || shield >= maxShield) return;

    // Check if we've waited long enough since last damage
    if (currentTick - lastDamage >= regenDelay) {
      (entityData as { shield: number }).shield = Math.min(maxShield, shield + regenRate);
    }
  }

  /**
   * Remove dead entities from the game.
   */
  private removeDeadEntities(context: GameContext): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData) continue;

      if (hasHealthState(entityData) && entityData.healthState === 'dead') {
        context.spatial.remove(entityId);
      }
    }
  }

  public override resetState(): void {
    this.intents = [];
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      queuedIntents: this.intents.length,
      config: this.config,
    };
  }
}
