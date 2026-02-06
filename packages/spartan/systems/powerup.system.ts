/**
 * PowerupSystem - Manages powerup collection and buff lifecycle.
 *
 * Handles:
 * 1. Detecting powerup/collector overlaps
 * 2. Applying powerup effects (health, shield, buffs, ammo)
 * 3. Managing buff durations and expiration
 *
 * Works with HealthSystem for damage/heal effects.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext, EntityData } from '../core/types';
import type { HealthSystem } from './health.system';
import type { Buff, HasBuff } from '../traits/buff.trait';
import {
  hasHealth,
  hasWeapon,
  hasBuff,
  isHealthPack,
  isShieldPack,
  isSpeedBoost,
  isDamageBoost,
  isInvincibility,
  isAmmoPack,
  isWeaponPickup,
  isPowerup,
  isPlayer,
  hasShield,
} from '../traits/trait-guards';

/**
 * Configuration for PowerupSystem.
 */
export interface PowerupSystemConfig {
  /** Health system reference for applying heals */
  healthSystem?: HealthSystem;
}

/**
 * PowerupSystem - Manages powerup collection and buff expiration.
 *
 * Key responsibilities:
 * 1. Detect when collectors (players/NPCs) overlap with powerups
 * 2. Apply immediate effects (health, shield, ammo)
 * 3. Apply timed buffs (speed, damage, invincibility)
 * 4. Track and expire active buffs each tick
 *
 * @system
 * @phase post-commit - Runs after movement resolves
 * @modifies Entity health, shield, buffs, ammo
 *
 * @example
 * ```typescript
 * const healthSystem = new HealthSystem();
 * const powerupSystem = new PowerupSystem({ healthSystem });
 *
 * // Register both systems
 * gameLoop.addSystem(healthSystem);
 * gameLoop.addSystem(powerupSystem);
 *
 * // Powerups are collected automatically on overlap
 * ```
 */
export class PowerupSystem extends BaseReactiveSystem {
  // Run in 'main' phase so heal intents are staged before HealthSystem processes them
  readonly executionPhase = 'main' as const;

  private healthSystem?: HealthSystem;

  constructor(config: PowerupSystemConfig = {}) {
    super();
    this.healthSystem = config.healthSystem;
  }

  /**
   * Set the health system reference (for dependency injection after construction).
   */
  setHealthSystem(healthSystem: HealthSystem): void {
    this.healthSystem = healthSystem;
  }

  /**
   * Process powerup pickups and buff expiration.
   */
  update(context: GameContext): void {
    const currentTick = context.tick ?? 0;

    // Process powerup pickups from overlaps
    this.processPickups(context, currentTick);

    // Expire old buffs
    this.processBuffExpiration(context, currentTick);
  }

  /**
   * Process powerup/collector overlaps and apply effects.
   */
  private processPickups(context: GameContext, currentTick: number): void {
    for (const overlap of context.overlaps) {
      // Find powerup and collector in this overlap
      let powerupId: number | undefined;
      let powerupData: EntityData | undefined;
      let collectorId: number | undefined;
      let collectorData: EntityData | undefined;

      for (const entityId of overlap.entityIds) {
        const data = context.spatial.getEntityData(entityId);
        if (!data) continue;

        if (isPowerup(data)) {
          powerupId = entityId;
          powerupData = data;
        } else if (this.canCollect(data)) {
          collectorId = entityId;
          collectorData = data;
        }
      }

      // If we have both a powerup and collector, apply the pickup
      if (powerupId !== undefined && powerupData && collectorId !== undefined && collectorData) {
        this.applyPowerup(context, powerupId, powerupData, collectorId, collectorData, currentTick);
      }
    }
  }

  /**
   * Check if an entity can collect powerups.
   *
   * Currently only players can collect powerups.
   * Could be extended to include NPCs with collection ability.
   */
  private canCollect(entity: EntityData): boolean {
    return isPlayer(entity);
  }

  /**
   * Apply a powerup's effect to the collector.
   */
  private applyPowerup(
    context: GameContext,
    powerupId: number,
    powerupData: EntityData,
    collectorId: number,
    collectorData: EntityData,
    currentTick: number
  ): void {
    let consumed = false;

    if (isHealthPack(powerupData)) {
      consumed = this.applyHealthPack(collectorId, collectorData, powerupData.healAmount);
    } else if (isShieldPack(powerupData)) {
      consumed = this.applyShieldPack(collectorData, powerupData.shieldAmount, powerupData.duration, currentTick);
    } else if (isSpeedBoost(powerupData)) {
      consumed = this.applySpeedBoost(collectorData, powerupData.speedMultiplier, powerupData.duration, currentTick);
    } else if (isDamageBoost(powerupData)) {
      consumed = this.applyDamageBoost(collectorData, powerupData.damageMultiplier, powerupData.duration, currentTick);
    } else if (isInvincibility(powerupData)) {
      consumed = this.applyInvincibility(collectorData, powerupData.duration, currentTick);
    } else if (isAmmoPack(powerupData)) {
      consumed = this.applyAmmoPack(collectorData, powerupData.weaponType, powerupData.ammoAmount);
    } else if (isWeaponPickup(powerupData)) {
      consumed = this.applyWeaponPickup(collectorData, powerupData.weaponType, powerupData.ammoAmount);
    }

    // Remove the powerup if consumed
    if (consumed) {
      context.spatial.remove(powerupId);
    }
  }

  /**
   * Apply health pack - instant heal.
   */
  private applyHealthPack(collectorId: number, collectorData: EntityData, healAmount: number): boolean {
    if (!hasHealth(collectorData)) return false;

    // Skip if already at full health
    if (collectorData.hp >= collectorData.maxHp) return false;

    // Use health system if available, otherwise direct heal
    if (this.healthSystem) {
      this.healthSystem.heal(collectorId, healAmount);
    } else {
      collectorData.hp = Math.min(collectorData.maxHp, collectorData.hp + healAmount);
    }

    return true;
  }

  /**
   * Apply shield pack - grant or restore shield.
   */
  private applyShieldPack(
    collectorData: EntityData,
    shieldAmount: number,
    duration: number | undefined,
    currentTick: number
  ): boolean {
    // Initialize shield if not present
    if (!hasShield(collectorData)) {
      (collectorData as EntityData & { shield: number; maxShield: number }).shield = 0;
      (collectorData as EntityData & { shield: number; maxShield: number }).maxShield = shieldAmount;
    }

    const shieldData = collectorData as EntityData & { shield: number; maxShield: number };

    // Skip if already at max shield and no explicit duration (permanent)
    if (duration === undefined && shieldData.shield >= shieldData.maxShield) return false;

    if (duration) {
      // Temporary shield - add as buff
      this.addBuff(collectorData, {
        type: 'shield',
        magnitude: shieldAmount,
        expirationTick: currentTick + duration,
      });
      // Also grant the shield immediately
      shieldData.shield = Math.min(shieldData.maxShield, shieldData.shield + shieldAmount);
    } else {
      // Permanent shield restoration
      shieldData.shield = Math.min(shieldData.maxShield, shieldData.shield + shieldAmount);
    }

    return true;
  }

  /**
   * Apply speed boost - temporary speed multiplier.
   */
  private applySpeedBoost(
    collectorData: EntityData,
    speedMultiplier: number,
    duration: number,
    currentTick: number
  ): boolean {
    this.addBuff(collectorData, {
      type: 'speed',
      magnitude: speedMultiplier,
      expirationTick: currentTick + duration,
    });
    return true;
  }

  /**
   * Apply damage boost - temporary damage multiplier.
   */
  private applyDamageBoost(
    collectorData: EntityData,
    damageMultiplier: number,
    duration: number,
    currentTick: number
  ): boolean {
    this.addBuff(collectorData, {
      type: 'damage',
      magnitude: damageMultiplier,
      expirationTick: currentTick + duration,
    });
    return true;
  }

  /**
   * Apply invincibility - temporary immunity to damage.
   */
  private applyInvincibility(
    collectorData: EntityData,
    duration: number,
    currentTick: number
  ): boolean {
    this.addBuff(collectorData, {
      type: 'invincibility',
      magnitude: 1, // Binary - either invincible or not
      expirationTick: currentTick + duration,
    });
    return true;
  }

  /**
   * Apply ammo pack - add ammo to weapon.
   */
  private applyAmmoPack(collectorData: EntityData, weaponType: string, ammoAmount: number): boolean {
    if (!hasWeapon(collectorData)) return false;

    // Ensure ammo map exists (using index signature access)
    if (!collectorData.ammo) {
      collectorData.ammo = {};
    }
    // Initialize ammo for weapon type if not present
    if (!(collectorData.ammo[weaponType] >= 0)) {
      collectorData.ammo[weaponType] = 0;
    }

    collectorData.ammo[weaponType] += ammoAmount;
    return true;
  }

  /**
   * Apply weapon pickup - switch weapon and add starting ammo.
   */
  private applyWeaponPickup(collectorData: EntityData, weaponType: string, ammoAmount: number): boolean {
    // Initialize weapon trait if not present (using index signature access)
    if (!hasWeapon(collectorData)) {
      collectorData.equippedWeapon = weaponType;
      collectorData.ammo = {};
    }

    const weaponData = collectorData as EntityData & { equippedWeapon: string; ammo: Record<string, number> };

    // Switch to the new weapon
    weaponData.equippedWeapon = weaponType;

    // Initialize ammo for weapon type if not present
    if (!(weaponData.ammo[weaponType] >= 0)) {
      weaponData.ammo[weaponType] = 0;
    }

    // Add starting ammo (defensive - normalize to non-negative integer)
    const normalizedAmmo = Number.isFinite(ammoAmount) ? Math.max(0, Math.floor(ammoAmount)) : 0;
    weaponData.ammo[weaponType] += normalizedAmmo;

    return true;
  }

  /**
   * Add a buff to an entity.
   *
   * Initializes activeBuffs array if not present.
   * Replaces existing buff of same type (refresh/upgrade).
   */
  private addBuff(entity: EntityData, buff: Buff): void {
    // Initialize activeBuffs if needed
    if (!hasBuff(entity)) {
      (entity as EntityData & HasBuff).activeBuffs = [];
    }

    const buffEntity = entity as EntityData & HasBuff;

    // Check for existing buff of same type
    const existingIndex = buffEntity.activeBuffs.findIndex(b => b.type === buff.type);

    if (existingIndex >= 0) {
      // Replace/refresh existing buff
      buffEntity.activeBuffs[existingIndex] = buff;
    } else {
      // Add new buff
      buffEntity.activeBuffs.push(buff);
    }
  }

  /**
   * Process buff expiration for all entities.
   */
  private processBuffExpiration(context: GameContext, currentTick: number): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasBuff(entityData)) continue;

      // Filter out expired buffs
      const activeBefore = entityData.activeBuffs.length;
      entityData.activeBuffs = entityData.activeBuffs.filter(buff => {
        // Permanent buffs (expirationTick === -1) never expire
        if (buff.expirationTick === -1) return true;

        // Check if buff has expired
        if (buff.expirationTick <= currentTick) {
          this.onBuffExpired(entityData, buff);
          return false;
        }
        return true;
      });

      // Log if buffs were removed (for debugging)
      if (entityData.activeBuffs.length < activeBefore) {
        // Buff(s) expired
      }
    }
  }

  /**
   * Handle buff expiration cleanup.
   *
   * Called when a buff expires. Can be used to remove
   * any persistent effects the buff applied.
   */
  private onBuffExpired(entity: EntityData, buff: Buff): void {
    if (buff.type === 'shield') {
      if (hasShield(entity)) {
        // Reduce shield and maxShield by the buff's magnitude
        entity.shield = Math.max(0, entity.shield - buff.magnitude);
        entity.maxShield = Math.max(0, entity.maxShield - buff.magnitude);
      }
    }
    // Other buff types like speed, damage, and invincibility are handled by
    // other systems checking for active buffs each tick, so no specific
    // cleanup is needed here for them.
  }

  /**
   * Check if entity has an active buff of a given type.
   *
   * Utility function for other systems to check buff status.
   */
  static hasActiveBuff(entity: EntityData, buffType: Buff['type']): boolean {
    if (!hasBuff(entity)) return false;
    return entity.activeBuffs.some(b => b.type === buffType);
  }

  /**
   * Get the magnitude of an active buff.
   *
   * Returns the magnitude if buff exists, 0 otherwise.
   * For stacking buffs, returns the highest magnitude.
   */
  static getBuffMagnitude(entity: EntityData, buffType: Buff['type']): number {
    if (!hasBuff(entity)) return 0;
    const buff = entity.activeBuffs.find(b => b.type === buffType);
    return buff?.magnitude ?? 0;
  }

  public override resetState(): void {
    // No internal state to reset
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      hasHealthSystem: !!this.healthSystem,
    };
  }
}
