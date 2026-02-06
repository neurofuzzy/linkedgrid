/**
 * @brief Health System - Intent-based health management with death states.
 *
 * Only the HealthSystem can modify entity health. Other systems stage
 * damage/heal intents which are processed atomically each tick.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext, EntityData } from '../core/types';
import { hasHealth, hasHealthState, hasShield, hasVulnerability } from '../traits/trait-guards';
import type { HasHealth } from '../traits/health.trait';
import type { HasShield } from '../traits/defense.trait';

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
 * DeathEvent - Emitted when an entity transitions to 'dead' state.
 *
 * Available for one tick via getDeathEvents() before being cleared.
 * Used by ScoreSystem and ObjectiveSystem to react to kills.
 *
 * Contains a snapshot of entity data at time of death, so consumers
 * don't rely on the entity still existing in the spatial system
 * (which may have removed it by the time post-commit systems run).
 */
export interface DeathEvent {
  /** Entity ID that died */
  entityId: number;
  /** Entity type string */
  entityType: string;
  /** Entity ID that dealt the killing blow (if tracked) */
  killerEntityId?: number;
  /** Snapshot of entity data at time of death (shallow copy) */
  entityData: EntityData;
}

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
  readonly executionPhase = 'post-commit' as const;

  private intents: HealthIntent[] = [];
  private config: HealthSystemConfig;

  /** Death events from the current tick. Cleared at start of next update(). */
  private deathEvents: DeathEvent[] = [];

  /** Tracks the last damage source per entity (for kill attribution). */
  private lastDamageSource: Map<number, number> = new Map();

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
   * Get death events from the current tick.
   *
   * Available after HealthSystem.update() runs and before the next update() clears them.
   * Used by ScoreSystem and ObjectiveSystem to react to kills.
   */
  getDeathEvents(): ReadonlyArray<DeathEvent> {
    return this.deathEvents;
  }

  /**
   * Process all health intents and handle death states.
   */
  update(context: GameContext): void {
    const currentTick = context.tick ?? 0;

    // Clear death events from previous tick
    this.deathEvents = [];

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
    _entityId: number,
    entityData: EntityData & HasHealth,
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
    if (intent.damageType && hasVulnerability(entityData)) {
      const multiplier = entityData.vulnerabilities[intent.damageType];
      if (multiplier !== undefined) {
        damage = Math.floor(damage * multiplier);
      }
    }

    // Apply to shield first
    if (hasShield(entityData) && entityData.shield > 0) {
      const shieldDamage = Math.min(entityData.shield, damage);
      entityData.shield -= shieldDamage;
      damage -= shieldDamage;

      // Track when shield was last damaged for regen delay
      entityData.lastShieldDamageTick = context.tick ?? 0;
    }

    // Apply remaining damage to HP
    if (damage > 0) {
      entityData.hp = Math.max(0, entityData.hp - damage);
    }

    // Track damage source for kill attribution
    if (intent.sourceId !== undefined) {
      this.lastDamageSource.set(intent.targetId, intent.sourceId);
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
    entityData: EntityData & HasHealth,
    intent: HealIntent
  ): void {
    entityData.hp = Math.min(entityData.maxHp, entityData.hp + intent.amount);
  }

  /**
   * Transition entity to dying state.
   */
  private startDying(entityData: EntityData & HasHealth): void {
    entityData.healthState = 'dying';
    entityData.dyingTicks = this.config.dyingDuration;
  }

  /**
   * Process entities in dying state (countdown to dead).
   */
  private processDyingEntities(context: GameContext, _currentTick: number): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasHealth(entityData)) continue;

      if (entityData.healthState === 'dying') {
        const dyingTicks = entityData.dyingTicks ?? 0;

        if (dyingTicks <= 1) {
          // Transition to dead - emit death event with data snapshot
          entityData.healthState = 'dead';

          this.deathEvents.push({
            entityId,
            entityType: entityData.type as string,
            killerEntityId: this.lastDamageSource.get(entityId),
            entityData: { ...entityData } as EntityData,
          });
          this.lastDamageSource.delete(entityId);
        } else {
          // Countdown
          entityData.dyingTicks = dyingTicks - 1;
        }
      }

      // Process shield regeneration
      if (hasShield(entityData)) {
        this.processShieldRegen(entityData, context.tick ?? 0);
      }
    }
  }

  /**
   * Handle shield regeneration.
   */
  private processShieldRegen(entityData: EntityData & HasShield, currentTick: number): void {
    const { shield, maxShield, shieldRegenRate = 0, shieldRegenDelay = 0, lastShieldDamageTick = 0 } = entityData;

    if (shieldRegenRate <= 0 || shield >= maxShield) return;

    // Check if we've waited long enough since last damage
    if (currentTick - lastShieldDamageTick >= shieldRegenDelay) {
      entityData.shield = Math.min(maxShield, shield + shieldRegenRate);
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
    this.deathEvents = [];
    this.lastDamageSource.clear();
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      queuedIntents: this.intents.length,
      config: this.config,
    };
  }
}
