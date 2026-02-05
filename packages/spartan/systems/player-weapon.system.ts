/**
 * Player Weapon System - Handles ranged combat for entities with HasWeapon trait.
 *
 * Processes shooting on secondary input, manages ammo, and integrates with
 * ProjectileSystem for projectile spawning. Falls back to melee when out of ammo.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { InputProvider } from '../core/input-provider';
import type { GameManager } from '../core/game-manager';
import type { ProjectileSystem } from './projectile.system';
import type { MeleeSystem } from './melee.system';
import { Direction } from '../core/grid/direction';
import { hasWeapon, hasMelee } from '../traits/trait-guards';
import { DEFAULT_WEAPONS, type WeaponConfig } from '../traits/weapon.trait';

/**
 * PlayerWeaponSystem - Manages ranged weapon firing for the player.
 *
 * Key responsibilities:
 * 1. Detect secondary input for weapon firing
 * 2. Check cooldown and ammo before firing
 * 3. Spawn projectiles via ProjectileSystem
 * 4. Fall back to melee attack when out of ammo (if entity has melee)
 *
 * Fire direction is determined by:
 * - Last movement direction (tracked by this system)
 * - Explicit fireDirection property (set by AI for NPCs)
 *
 * @system
 * @reactsTo Secondary input (player)
 * @modifies Projectile spawning, ammo consumption
 *
 * @example
 * ```typescript
 * const weaponSystem = new PlayerWeaponSystem(
 *   gameManager,
 *   inputProvider,
 *   projectileSystem,
 *   meleeSystem
 * );
 * gameLoop.addSystem(weaponSystem);
 * ```
 */
export class PlayerWeaponSystem extends BaseReactiveSystem {
  readonly executionPhase = 'pre-commit' as const;

  /** Custom weapon configurations (merged with defaults) */
  private weaponConfigs: Record<string, WeaponConfig>;

  /** Track last movement direction for player aiming */
  private lastPlayerDirection: Direction = Direction.DOWN;

  /** Debug stats */
  private debugStats = {
    shotsFiredThisTick: 0,
    totalShotsFired: 0,
    meleeFallbacksThisTick: 0,
  };

  constructor(
    private gameManager: GameManager,
    private inputProvider: InputProvider,
    private projectileSystem: ProjectileSystem,
    private meleeSystem?: MeleeSystem,
    customWeapons?: Record<string, WeaponConfig>
  ) {
    super();
    this.weaponConfigs = { ...DEFAULT_WEAPONS, ...customWeapons };
  }

  update(context: GameContext): void {
    this.debugStats.shotsFiredThisTick = 0;
    this.debugStats.meleeFallbacksThisTick = 0;

    const currentTick = context.tick ?? 0;

    // Update player aiming direction from movement
    this.updatePlayerAiming();

    // Process player weapon fire
    this.processPlayerFire(context, currentTick);
  }

  /**
   * Update player aiming direction based on movement input.
   */
  private updatePlayerAiming(): void {
    const dir = this.inputProvider.getDirection();
    if (dir !== Direction.NONE) {
      this.lastPlayerDirection = dir;
    }
  }

  /**
   * Process player weapon fire when secondary button is pressed.
   */
  private processPlayerFire(context: GameContext, currentTick: number): void {
    // Check if secondary button is pressed
    if (!this.inputProvider.getSecondary()) return;

    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    const playerData = context.spatial.getEntityData(playerId);
    if (!playerData || !hasWeapon(playerData)) return;

    // Get weapon configuration
    const weaponConfig = this.weaponConfigs[playerData.equippedWeapon];
    if (!weaponConfig) {
      console.warn(`Unknown weapon: ${playerData.equippedWeapon}`);
      return;
    }

    // Check cooldown (undefined means never fired, so allow first shot)
    const lastFire = playerData.lastFireTick;
    if (lastFire !== undefined && currentTick - lastFire < weaponConfig.fireRate) {
      return;
    }

    // Check ammo
    const currentAmmo = playerData.ammo[playerData.equippedWeapon] ?? 0;
    const hasAmmo = playerData.unlimitedAmmo || currentAmmo >= weaponConfig.ammoCost;

    if (!hasAmmo) {
      // Fall back to melee if available
      this.fallbackToMelee(context, playerId, playerData);
      return;
    }

    // Determine fire direction
    const fireDir = playerData.fireDirection ?? this.lastPlayerDirection;
    if (fireDir === Direction.NONE) return;

    // Get player position
    const pos = context.spatial.getEntityPosition(playerId);
    if (!pos) return;

    // Calculate target position based on direction and range
    const delta = this.directionToDelta(fireDir);
    const range = weaponConfig.range ?? 10;
    const targetX = pos.x + delta.dx * range;
    const targetY = pos.y + delta.dy * range;

    // Spawn projectile
    this.projectileSystem.spawnProjectile(
      context,
      pos.x + delta.dx, // Start one cell in front of player
      pos.y + delta.dy,
      targetX,
      targetY,
      weaponConfig.damage,
      {
        speed: weaponConfig.projectileSpeed ?? 2,
        ownerId: playerId,
        damageType: weaponConfig.name,
        color: weaponConfig.projectileColor ?? '#ffff00',
      }
    );

    // Consume ammo
    if (!playerData.unlimitedAmmo) {
      playerData.ammo[playerData.equippedWeapon] = currentAmmo - weaponConfig.ammoCost;
    }

    // Update cooldown
    playerData.lastFireTick = currentTick;

    this.debugStats.shotsFiredThisTick++;
    this.debugStats.totalShotsFired++;
  }

  /**
   * Fall back to melee attack when out of ammo.
   */
  private fallbackToMelee(
    context: GameContext,
    entityId: number,
    entityData: { meleeDamage?: number; meleeDirection?: Direction }
  ): void {
    if (!this.meleeSystem) return;
    if (!hasMelee(entityData as Parameters<typeof hasMelee>[0])) return;

    // Set melee direction to trigger attack in MeleeSystem
    entityData.meleeDirection = this.lastPlayerDirection;
    this.debugStats.meleeFallbacksThisTick++;
  }

  /**
   * Add ammo to an entity.
   *
   * @param context - Game context
   * @param entityId - Entity to add ammo to
   * @param weaponType - Weapon type to add ammo for
   * @param amount - Amount of ammo to add
   */
  addAmmo(context: GameContext, entityId: number, weaponType: string, amount: number): void {
    const entityData = context.spatial.getEntityData(entityId);
    if (!entityData || !hasWeapon(entityData)) return;

    const currentAmmo = entityData.ammo[weaponType] ?? 0;
    entityData.ammo[weaponType] = currentAmmo + amount;
  }

  /**
   * Switch equipped weapon.
   *
   * @param context - Game context
   * @param entityId - Entity to switch weapon for
   * @param weaponType - Weapon to equip
   */
  switchWeapon(context: GameContext, entityId: number, weaponType: string): boolean {
    const entityData = context.spatial.getEntityData(entityId);
    if (!entityData || !hasWeapon(entityData)) return false;

    if (!this.weaponConfigs[weaponType]) {
      console.warn(`Unknown weapon: ${weaponType}`);
      return false;
    }

    entityData.equippedWeapon = weaponType;
    return true;
  }

  /**
   * Get weapon configuration.
   */
  getWeaponConfig(weaponType: string): WeaponConfig | undefined {
    return this.weaponConfigs[weaponType];
  }

  /**
   * Convert direction to dx/dy delta.
   */
  private directionToDelta(dir: Direction): { dx: number; dy: number } {
    switch (dir) {
      case Direction.UP:
        return { dx: 0, dy: -1 };
      case Direction.DOWN:
        return { dx: 0, dy: 1 };
      case Direction.LEFT:
        return { dx: -1, dy: 0 };
      case Direction.RIGHT:
        return { dx: 1, dy: 0 };
      default:
        return { dx: 0, dy: 0 };
    }
  }

  public override resetState(): void {
    this.lastPlayerDirection = Direction.DOWN;
    this.debugStats = {
      shotsFiredThisTick: 0,
      totalShotsFired: 0,
      meleeFallbacksThisTick: 0,
    };
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      lastPlayerDirection: this.lastPlayerDirection,
      weaponCount: Object.keys(this.weaponConfigs).length,
      ...this.debugStats,
    };
  }
}
