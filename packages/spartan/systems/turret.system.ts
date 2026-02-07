/**
 * @brief Turret System - Handles stationary shooters that fire projectiles or rays.
 *
 * Turrets can target the nearest enemy, the player, or fire in a fixed direction.
 * Integrates with ProjectileSystem for projectile spawning and HealthSystem for ray damage.
 */
import { BaseTickedSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import { hasTurret, hasHealth, hasTeam } from '../traits/trait-guards';
import { LinkedCellUtils } from '../core/grid/linked-cell-utils';
import { Direction } from '../core/grid/direction';
import { GameLayers } from '../config/layers.config';
import type { HealthSystem } from './health.system';
import type { ProjectileSystem } from './projectile.system';
import type { HasTurret } from '../traits/turret.trait';

/**
 * TurretSystem - Manages stationary shooting entities.
 *
 * Features:
 * - Multiple targeting modes (nearest, player, fixed)
 * - Projectile or ray weapon types
 * - Cooldown management
 * - Range-based target detection
 * - Team filtering (won't target same team)
 * - Integration with HealthSystem for ray damage
 * - Integration with ProjectileSystem for projectile spawning
 *
 * @system
 * @reactsTo Entities with HasTurret trait
 * @spawns Projectile entities
 * @modifies Entity lastFireTick
 *
 * @example
 * ```typescript
 * const healthSystem = new HealthSystem();
 * const projectileSystem = new ProjectileSystem(healthSystem);
 * const turretSystem = new TurretSystem(healthSystem, projectileSystem);
 * gameLoop.addSystem(turretSystem);
 * ```
 */
export class TurretSystem extends BaseTickedSystem {
  readonly executionPhase = 'main' as const;

  protected tickRate = 1; // Run every tick for cooldown tracking

  constructor(
    private healthSystem: HealthSystem,
    private projectileSystem: ProjectileSystem
  ) {
    super();
  }

  protected onTick(context: GameContext): void {
    const currentTick = context.tick ?? 0;
    const playerEntityId = context.gameManager?.gameState?.playerEntityId;

    // Clean up expired ray effects
    this.cleanupRayEffects(context, currentTick);

    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasTurret(entityData)) continue;

      const turret = entityData as typeof entityData & HasTurret;
      const pos = context.spatial.getEntityPosition(entityId);
      if (!pos) continue;

      // Check cooldown
      // If lastFireTick is undefined, turret has never fired - allow first shot
      const lastFireTick = turret.lastFireTick;
      if (lastFireTick !== undefined && currentTick - lastFireTick < turret.cooldown) {
        continue; // Still on cooldown
      }

      // Find target based on targeting mode
      const target = this.findTarget(context, entityId, turret, pos, playerEntityId);
      if (!target) continue;

      // Fire weapon
      if (turret.weaponType === 'projectile') {
        this.fireProjectile(context, entityId, turret, pos, target);
      } else {
        this.fireRay(context, entityId, turret, pos, target);
      }

      // Update cooldown
      turret.lastFireTick = currentTick;
    }
  }

  /**
   * Find a target based on turret's targeting mode.
   */
  private findTarget(
    context: GameContext,
    turretId: number,
    turret: HasTurret,
    turretPos: { x: number; y: number },
    playerEntityId: number | undefined
  ): { x: number; y: number; entityId?: number } | null {
    switch (turret.targeting) {
      case 'player':
        return this.findPlayerTarget(context, turret, turretPos, playerEntityId);

      case 'nearest':
        return this.findNearestTarget(context, turretId, turret, turretPos);

      case 'fixed':
        return this.getFixedDirectionTarget(context, turret, turretPos);

      case 'cardinal':
        return this.getCardinalDirectionTarget(context, turret, turretPos);

      default:
        return null;
    }
  }

  /**
   * Find the player as target.
   */
  private findPlayerTarget(
    context: GameContext,
    turret: HasTurret,
    turretPos: { x: number; y: number },
    playerEntityId: number | undefined
  ): { x: number; y: number; entityId: number } | null {
    if (playerEntityId === undefined) return null;

    const playerPos = context.spatial.getEntityPosition(playerEntityId);
    if (!playerPos) return null;

    // Check range
    const distance = this.manhattanDistance(turretPos.x, turretPos.y, playerPos.x, playerPos.y);
    if (distance > turret.range) return null;

    // Check line of sight
    const startCell = context.spatial.grid.cell(turretPos.x, turretPos.y);
    const targetCell = context.spatial.grid.cell(playerPos.x, playerPos.y);
    if (!startCell || !targetCell) return null;

    const line = LinkedCellUtils.getLine(startCell, targetCell);

    // Skip first cell (turret itself)
    for (let i = 1; i < line.length; i++) {
      if (context.spatial.isBlocked(line[i])) {
        return null; // Blocked by wall
      }
    }

    return { x: playerPos.x, y: playerPos.y, entityId: playerEntityId };
  }

  /**
   * Find the nearest valid target.
   */
  private findNearestTarget(
    context: GameContext,
    turretId: number,
    turret: HasTurret,
    turretPos: { x: number; y: number }
  ): { x: number; y: number; entityId: number } | null {
    let nearestId: number | null = null;
    let nearestDistance = Infinity;
    let nearestPos: { x: number; y: number } | null = null;

    const turretData = context.spatial.getEntityData(turretId);
    const turretTeam = hasTeam(turretData!) ? turretData.team : undefined;

    for (const [entityId] of context.spatial.getAllPositions()) {
      if (entityId === turretId) continue;
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData) continue;

      // Only target entities with health
      if (!hasHealth(entityData)) continue;

      // Skip same team
      if (turretTeam && hasTeam(entityData) && entityData.team === turretTeam) {
        continue;
      }

      const entityPos = context.spatial.getEntityPosition(entityId);
      if (!entityPos) continue;

      const distance = this.manhattanDistance(turretPos.x, turretPos.y, entityPos.x, entityPos.y);

      // Check range
      if (distance > turret.range) continue;

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = entityId;
        nearestPos = { x: entityPos.x, y: entityPos.y };
      }
    }

    if (nearestId === null || nearestPos === null) return null;

    // Check line of sight
    const startCell = context.spatial.grid.cell(turretPos.x, turretPos.y);
    const targetCell = context.spatial.grid.cell(nearestPos.x, nearestPos.y);
    if (!startCell || !targetCell) return null;

    const line = LinkedCellUtils.getLine(startCell, targetCell);

    // Skip first cell (turret itself)
    for (let i = 1; i < line.length; i++) {
      if (context.spatial.isBlocked(line[i])) {
        return null; // Blocked by wall
      }
    }

    return { x: nearestPos.x, y: nearestPos.y, entityId: nearestId };
  }

  /**
   * Get target position for fixed direction firing.
   */
  private getFixedDirectionTarget(
    context: GameContext,
    turret: HasTurret,
    turretPos: { x: number; y: number }
  ): { x: number; y: number } | null {
    const dir = turret.fixedDirection ?? Direction.RIGHT;
    const [dx, dy] = this.getDirectionDelta(dir);

    // Calculate target at max range, clamped to grid bounds
    const rawX = turretPos.x + dx * turret.range;
    const rawY = turretPos.y + dy * turret.range;

    return {
      x: Math.max(0, Math.min(context.spatial.grid.width - 1, rawX)),
      y: Math.max(0, Math.min(context.spatial.grid.height - 1, rawY)),
    };
  }

  /**
   * Get target position for cardinal mode.
   * Auto-detects open directions on first call, then cycles through them.
   */
  private getCardinalDirectionTarget(
    context: GameContext,
    turret: HasTurret,
    turretPos: { x: number; y: number }
  ): { x: number; y: number } | null {
    // Initialize open directions on first call
    if (!turret.cardinalDirections) {
      turret.cardinalDirections = this.detectOpenDirections(context, turretPos);
      turret.cardinalIndex = 0;
    }

    const directions = turret.cardinalDirections;
    if (directions.length === 0) return null;

    // Get current direction and advance index for next shot
    const currentIndex = turret.cardinalIndex ?? 0;
    const dir = directions[currentIndex];
    turret.cardinalIndex = (currentIndex + 1) % directions.length;

    // Calculate target in this direction
    const [dx, dy] = this.getDirectionDelta(dir);
    const rawX = turretPos.x + dx * turret.range;
    const rawY = turretPos.y + dy * turret.range;

    return {
      x: Math.max(0, Math.min(context.spatial.grid.width - 1, rawX)),
      y: Math.max(0, Math.min(context.spatial.grid.height - 1, rawY)),
    };
  }

  /**
   * Detect which cardinal directions are not blocked by walls.
   */
  private detectOpenDirections(
    context: GameContext,
    pos: { x: number; y: number }
  ): Direction[] {
    const openDirs: Direction[] = [];
    const allDirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];

    for (const dir of allDirs) {
      const [dx, dy] = this.getDirectionDelta(dir);
      const neighborCell = context.spatial.grid.cell(pos.x + dx, pos.y + dy);

      // If neighbor exists and is not blocked, this direction is open
      if (neighborCell && !context.spatial.isBlocked(neighborCell)) {
        openDirs.push(dir);
      }
    }

    return openDirs;
  }

  /**
   * Fire a projectile at target.
   */
  private fireProjectile(
    context: GameContext,
    turretId: number,
    turret: HasTurret,
    turretPos: { x: number; y: number },
    target: { x: number; y: number; entityId?: number }
  ): void {
    const damage = turret.projectileDamage ?? 10;
    const speed = turret.projectileSpeed ?? 1;
    const lifetime = turret.projectileLifetime ?? 50;

    this.projectileSystem.spawnProjectile(
      context,
      turretPos.x,
      turretPos.y,
      target.x,
      target.y,
      damage,
      {
        speed,
        lifetime,
        ownerId: turretId,
        piercing: turret.projectilePiercing,
        homing: turret.projectileHoming,
        homingStrength: turret.projectileHomingStrength,
        homingTargetId: turret.projectileHoming ? target.entityId : undefined,
      }
    );
  }

  /**
   * Fire an instant ray at target.
   */
  private fireRay(
    context: GameContext,
    turretId: number,
    turret: HasTurret,
    turretPos: { x: number; y: number },
    target: { x: number; y: number }
  ): void {
    const damage = turret.rayDamage ?? 15;
    const piercing = turret.rayPiercing ?? false;

    const startCell = context.spatial.grid.cell(turretPos.x, turretPos.y);
    const targetCell = context.spatial.grid.cell(target.x, target.y);

    if (!startCell || !targetCell) return;

    // Get all cells along the ray
    const cells = LinkedCellUtils.getLine(startCell, targetCell);

    const turretData = context.spatial.getEntityData(turretId);
    const turretTeam = hasTeam(turretData!) ? turretData.team : undefined;

    // Track cells for ray visual
    const rayCells: { x: number; y: number }[] = [];

    // Check each cell for targets
    for (const cell of cells) {
      // Check for wall (blocked)
      if (context.spatial.isBlocked(cell)) {
        break; // Ray stops at wall
      }

      // Track cell for visual
      rayCells.push({ x: cell.x, y: cell.y });

      // Check for entities at this cell
      const entitiesAtPos = context.spatial.getEntityIdsInCell(cell.x, cell.y);

      for (const entityId of entitiesAtPos) {
        if (entityId === turretId) continue;

        const entityData = context.spatial.getEntityData(entityId);
        if (!entityData) continue;

        // Only damage entities with health
        if (!hasHealth(entityData)) continue;

        // Skip same team
        if (turretTeam && hasTeam(entityData) && entityData.team === turretTeam) {
          continue;
        }

        // Deal damage
        this.healthSystem.damage(entityId, damage, undefined, turretId);

        // If not piercing, stop after first hit
        if (!piercing) {
          // Spawn ray visual for cells we traversed
          this.spawnRayVisual(context, rayCells);
          return;
        }
      }
    }

    // Spawn ray visual for all traversed cells
    this.spawnRayVisual(context, rayCells);
  }

  /**
   * Spawn ephemeral ray visual entities along the ray path.
   */
  private spawnRayVisual(
    context: GameContext,
    cells: { x: number; y: number }[]
  ): void {
    const currentTick = context.tick ?? 0;
    for (const cell of cells) {
      context.spatial.spawn('ray-effect', cell.x, cell.y, GameLayers.EPHEMERALS, {
        lifetime: 3, // Visible for 3 ticks
        spawnTick: currentTick,
        color: '#ff4444',
        rayVisual: true,
        ephemeral: true,
      });
    }
  }

  /**
   * Clean up expired ray effect entities.
   */
  private cleanupRayEffects(context: GameContext, currentTick: number): void {
    const toRemove: number[] = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const data = context.spatial.getEntityData(entityId);
      if (!data || data.type !== 'ray-effect') continue;

      // RayEffectData has lifetime and optional spawnTick
      const spawnTick = 'spawnTick' in data && typeof data.spawnTick === 'number' ? data.spawnTick : 0;
      const lifetime = 'lifetime' in data && typeof data.lifetime === 'number' ? data.lifetime : 3;

      if (currentTick - spawnTick >= lifetime) {
        toRemove.push(entityId);
      }
    }

    for (const entityId of toRemove) {
      context.spatial.remove(entityId);
    }
  }

  /**
   * Calculate Manhattan distance.
   */
  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  /**
   * Get delta values for a direction.
   */
  private getDirectionDelta(dir: Direction): [number, number] {
    switch (dir) {
      case Direction.UP:
        return [0, -1];
      case Direction.DOWN:
        return [0, 1];
      case Direction.LEFT:
        return [-1, 0];
      case Direction.RIGHT:
        return [1, 0];
      default:
        return [0, 0];
    }
  }

  public override resetState(): void {
    super.resetState();
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      description: 'Turret System (targeting, projectiles, rays)',
    };
  }
}
