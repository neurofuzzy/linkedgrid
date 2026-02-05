/**
 * Melee System - Handles close-range combat for entities with HasMelee trait.
 *
 * Processes melee attack intents triggered by action input or AI behavior.
 * Attacks target adjacent cells based on attack direction.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { InputProvider } from '../core/input-provider';
import type { GameManager } from '../core/game-manager';
import type { HealthSystem } from './health.system';
import { Direction } from '../core/grid/direction';
import { hasMelee, hasHealth, isPlayer, hasTeam, isPlayerTeam, isEnemyTeam, hasWeapon } from '../traits/trait-guards';
import { GameLayers } from '../config/layers.config';

/**
 * MeleeSystem - Manages melee combat for entities.
 *
 * Key responsibilities:
 * 1. Detect action input for player melee attacks
 * 2. Check cooldown before allowing attacks
 * 3. Find targets in attack direction within range
 * 4. Apply damage to valid targets via HealthSystem
 *
 * Attack direction is determined by:
 * - Player: Last movement direction or explicit meleeDirection
 * - NPCs: Set by AI systems via meleeDirection property
 *
 * @system
 * @reactsTo Action input (player), meleeDirection property (NPCs)
 * @modifies Target entity health via HealthSystem
 *
 * @example
 * ```typescript
 * const meleeSystem = new MeleeSystem(gameManager, inputProvider, healthSystem);
 * gameLoop.addSystem(meleeSystem);
 * ```
 */
export class MeleeSystem extends BaseReactiveSystem {
  readonly executionPhase = 'pre-commit' as const;

  /** Track last movement direction for player facing (default DOWN so melee works at start) */
  private lastPlayerDirection: Direction = Direction.DOWN;

  /** Debug stats */
  private debugStats = {
    attacksThisTick: 0,
    totalAttacks: 0,
    totalDamageDealt: 0,
  };

  constructor(
    private gameManager: GameManager,
    private inputProvider: InputProvider,
    private healthSystem: HealthSystem
  ) {
    super();
  }

  update(context: GameContext): void {
    this.debugStats.attacksThisTick = 0;

    const currentTick = context.tick ?? 0;

    // Update player facing direction from movement
    this.updatePlayerFacing(context);

    // Process player melee attack
    this.processPlayerMelee(context, currentTick);

    // Process NPC melee attacks (NPCs with meleeDirection set by AI)
    this.processNPCMelee(context, currentTick);
  }

  /**
   * Update player facing direction based on aim input.
   */
  private updatePlayerFacing(_context: GameContext): void {
    const dir = this.inputProvider.getAimDirection();
    if (dir !== Direction.NONE) {
      this.lastPlayerDirection = dir;
    }
  }

  /**
   * Process player melee attacks when action button is pressed, meleeDirection is set,
   * or isAiming() returns true (for separated mode WASD attacks).
   *
   * meleeDirection can be set by other systems (like PlayerWeaponSystem for fallback).
   */
  private processPlayerMelee(context: GameContext, currentTick: number): void {
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    const playerData = context.spatial.getEntityData(playerId);
    if (!playerData || !hasMelee(playerData)) return;

    // Check if action button is pressed OR meleeDirection is explicitly set (fallback from weapon system)
    const actionPressed = this.inputProvider.getPrimaryAction();
    const hasExplicitDirection = playerData.meleeDirection && playerData.meleeDirection !== Direction.NONE;

    // In separated/twin-stick mode, isAiming() returns true when WASD is pressed
    // This allows WASD to trigger melee directly if no weapon is equipped or out of ammo
    const aimingForMelee = this.inputProvider.isAiming();

    // If isAiming is true but player has a weapon with ammo, let weapon system handle it
    // Only trigger melee if:
    // 1. Space pressed (actionPressed), OR
    // 2. Explicit meleeDirection set (from fallback), OR
    // 3. isAiming AND (no weapon equipped OR out of ammo)
    let shouldMelee = actionPressed || hasExplicitDirection;

    if (!shouldMelee && aimingForMelee) {
      // Check if player has weapon with ammo - if so, weapon system should handle
      const hasWorkingWeapon = hasWeapon(playerData) &&
        playerData.equippedWeapon &&
        (playerData.unlimitedAmmo || (playerData.ammo?.[playerData.equippedWeapon] ?? 0) > 0);

      if (!hasWorkingWeapon) {
        // No weapon or out of ammo - melee on WASD
        shouldMelee = true;
      }
    }

    if (!shouldMelee) return;

    // Check cooldown (undefined means never attacked, so allow first attack)
    const lastAttack = playerData.lastMeleeAttackTick;
    if (lastAttack !== undefined && currentTick - lastAttack < playerData.meleeCooldown) {
      // Clear pending direction if on cooldown
      if (hasExplicitDirection) {
        playerData.meleeDirection = Direction.NONE;
      }
      return;
    }

    // Determine attack direction (explicit direction takes priority)
    const attackDir = playerData.meleeDirection ?? this.lastPlayerDirection;
    if (attackDir === Direction.NONE) return;

    // Get player position
    const pos = context.spatial.getEntityPosition(playerId);
    if (!pos) return;

    // Perform attack
    this.performAttack(
      context,
      playerId,
      pos.x,
      pos.y,
      attackDir,
      playerData.meleeDamage,
      playerData.meleeRange,
      currentTick,
      'player'
    );

    // Update cooldown and clear explicit direction
    playerData.lastMeleeAttackTick = currentTick;
    if (hasExplicitDirection) {
      playerData.meleeDirection = Direction.NONE;
    }
  }

  /**
   * Process NPC melee attacks for entities with meleeDirection set.
   */
  private processNPCMelee(context: GameContext, currentTick: number): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData) continue;

      // Skip player (handled separately)
      if (isPlayer(entityData)) continue;

      // Check if entity has melee capability and a pending attack direction
      if (!hasMelee(entityData)) continue;
      if (!entityData.meleeDirection || entityData.meleeDirection === Direction.NONE) continue;

      // Check cooldown (undefined means never attacked, so allow first attack)
      const lastAttack = entityData.lastMeleeAttackTick;
      if (lastAttack !== undefined && currentTick - lastAttack < entityData.meleeCooldown) {
        // Clear the pending attack direction since we're on cooldown
        entityData.meleeDirection = Direction.NONE;
        continue;
      }

      const pos = context.spatial.getEntityPosition(entityId);
      if (!pos) continue;

      // Determine team for target filtering
      const team = hasTeam(entityData) ? entityData.team : 'enemy';

      // Perform attack
      this.performAttack(
        context,
        entityId,
        pos.x,
        pos.y,
        entityData.meleeDirection,
        entityData.meleeDamage,
        entityData.meleeRange,
        currentTick,
        team
      );

      // Update cooldown and clear pending direction
      entityData.lastMeleeAttackTick = currentTick;
      entityData.meleeDirection = Direction.NONE;
    }
  }

  /**
   * Perform a melee attack in a direction.
   *
   * @param context - Game context
   * @param attackerId - Entity performing the attack
   * @param x - Attacker X position
   * @param y - Attacker Y position
   * @param direction - Attack direction
   * @param damage - Damage to deal
   * @param range - Attack range in cells
   * @param currentTick - Current game tick
   * @param attackerTeam - Team of attacker for filtering targets
   */
  private performAttack(
    context: GameContext,
    attackerId: number,
    x: number,
    y: number,
    direction: Direction,
    damage: number,
    range: number,
    _currentTick: number,
    attackerTeam: string
  ): void {
    const delta = this.directionToDelta(direction);
    const grid = context.spatial.grid;

    // Check each cell in range
    for (let i = 1; i <= range; i++) {
      const targetX = x + delta.dx * i;
      const targetY = y + delta.dy * i;

      // Bounds check
      if (targetX < 0 || targetX >= grid.width || targetY < 0 || targetY >= grid.height) {
        break;
      }

      // Check if cell is blocked by wall (stop attack at walls)
      const cell = grid.cell(targetX, targetY);
      if (context.spatial.isBlocked(cell)) {
        break;
      }

      // Find targets on ACTORS layer
      const targetIds = context.spatial.getEntityIdsInCell(targetX, targetY, GameLayers.ACTORS);

      for (const targetId of targetIds) {
        // Skip self
        if (targetId === attackerId) continue;

        const targetData = context.spatial.getEntityData(targetId);
        if (!targetData) continue;

        // Skip entities without health
        if (!hasHealth(targetData)) continue;

        // Skip same team (players don't hit players, enemies don't hit enemies)
        if (attackerTeam === 'player' && isPlayerTeam(targetData)) continue;
        if (attackerTeam === 'enemy' && isEnemyTeam(targetData)) continue;

        // Deal damage
        this.healthSystem.damage(targetId, damage, 'melee', attackerId);
        this.debugStats.attacksThisTick++;
        this.debugStats.totalAttacks++;
        this.debugStats.totalDamageDealt += damage;
      }
    }
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
    this.lastPlayerDirection = Direction.NONE;
    this.debugStats = {
      attacksThisTick: 0,
      totalAttacks: 0,
      totalDamageDealt: 0,
    };
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      lastPlayerDirection: this.lastPlayerDirection,
      ...this.debugStats,
    };
  }
}
