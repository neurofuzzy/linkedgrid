/**
 * @brief Projectile System - Handles moving projectiles with Bresenham paths.
 *
 * Projectiles move along precomputed paths, deal damage on collision,
 * and integrate with HealthSystem for damage processing.
 */
import { BaseTickedSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import { hasProjectile, hasHealth } from '../traits/trait-guards';
import { LinkedCellUtils } from '../core/grid/linked-cell-utils';
import { GameLayers } from '../config/layers.config';
import type { HealthSystem } from './health.system';
import type { HasProjectile } from '../traits/projectile.trait';
import type { VisualEventBus } from '../core/visual-event-bus';

/**
 * ProjectileSystem - Manages autonomous projectile movement and collision.
 *
 * Features:
 * - Bresenham line algorithm for arbitrary angle movement
 * - Configurable speed (cells per tick)
 * - Collision detection with walls and entities
 * - Piercing projectiles (pass through targets)
 * - Bouncing projectiles (reflect off walls)
 * - Lifetime expiration
 * - Integration with HealthSystem for damage
 *
 * @system
 * @reactsTo Entities with HasProjectile trait
 * @modifies Entity position, removes expired projectiles
 *
 * @example
 * ```typescript
 * const healthSystem = new HealthSystem();
 * const projectileSystem = new ProjectileSystem(healthSystem);
 * gameLoop.addSystem(projectileSystem);
 *
 * // Spawn a projectile
 * spatial.spawn('projectile', 5, 5, GameLayers.PROJECTILES, {
 *   targetX: 15,
 *   targetY: 10,
 *   damage: 25,
 *   speed: 2,
 * });
 * ```
 */
export class ProjectileSystem extends BaseTickedSystem {
  readonly executionPhase = 'main' as const;

  protected tickRate = 1; // Run every tick for smooth movement

  private healthSystem: HealthSystem;

  /** Optional visual event bus for emitting launch events */
  private visualEventBus?: VisualEventBus;

  constructor(healthSystem: HealthSystem, visualEventBus?: VisualEventBus) {
    super();
    this.healthSystem = healthSystem;
    this.visualEventBus = visualEventBus;
  }

  protected onTick(context: GameContext): void {
    const currentTick = context.tick ?? 0;
    const toRemove: number[] = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasProjectile(entityData)) continue;

      // Type assertion for projectile data
      const projectile = entityData as typeof entityData & HasProjectile;

      // Deferred removal: projectile entered impact state on a previous tick.
      // The final move has already been committed, so the renderer had one tick
      // to interpolate the projectile to its collision/final position.
      if (projectile.impactTick !== undefined) {
        toRemove.push(entityId);
        continue;
      }

      // Initialize path on first tick
      if (!projectile.path) {
        this.initializePath(context, entityId, projectile);
        projectile.spawnTick = currentTick;

        // Check entity collision at spawn position (already here, no move needed).
        // This catches enemies standing right where the projectile appears.
        const pos = context.spatial.getEntityPosition(entityId);
        if (pos) {
          const hitResult = this.checkEntityCollision(context, entityId, projectile, pos);
          if (hitResult.hit && hitResult.destroy) {
            // Instant collision at spawn — no move to commit, so remove immediately.
            toRemove.push(entityId);
            continue;
          }
        }
      }

      // Check lifetime expiration
      const lifetime = projectile.lifetime ?? 100;
      const age = currentTick - (projectile.spawnTick ?? currentTick);
      if (age >= lifetime) {
        toRemove.push(entityId);
        continue;
      }

      // Move projectile along path
      const destroyed = this.moveProjectile(context, entityId, projectile);
      if (destroyed) {
        // Enter impact state: defer removal to next tick so the pending move
        // (if any) commits and the renderer can interpolate to the final cell.
        projectile.impactTick = currentTick;
      }
    }

    // Remove impact/expired projectiles
    for (const entityId of toRemove) {
      context.spatial.remove(entityId);
    }
  }

  /**
   * Initialize the Bresenham path for a projectile.
   */
  private initializePath(
    context: GameContext,
    entityId: number,
    projectile: HasProjectile
  ): void {
    const pos = context.spatial.getEntityPosition(entityId);
    if (!pos) return;

    const startCell = context.spatial.grid.cell(pos.x, pos.y);
    if (!startCell) {
      projectile.path = [];
      return;
    }

    // Clamp target coordinates to grid bounds to ensure valid path
    const grid = context.spatial.grid;
    const clampedTargetX = Math.max(0, Math.min(grid.width - 1, projectile.targetX));
    const clampedTargetY = Math.max(0, Math.min(grid.height - 1, projectile.targetY));

    // Update projectile target with clamped values for consistency
    projectile.targetX = clampedTargetX;
    projectile.targetY = clampedTargetY;

    const targetCell = grid.cell(projectile.targetX, projectile.targetY);

    if (!targetCell) {
      projectile.path = [];
      return;
    }

    // getLine excludes the start cell — path contains only cells to MOVE to.
    // The entity is already at the start cell; spawn collision is checked
    // separately in onTick so we don't waste a movement step.
    const lineCells = LinkedCellUtils.getLine(startCell, targetCell);
    projectile.path = lineCells.map((c) => ({ x: c.x, y: c.y }));
    projectile.pathIndex = 0;
    projectile.hitEntityIds = [];
    projectile.bounceCount = 0;
  }

  /**
   * Move projectile along its path and check for collisions.
   * @returns true if projectile should be destroyed
   */
  private moveProjectile(
    context: GameContext,
    entityId: number,
    projectile: HasProjectile
  ): boolean {
    const path = projectile.path;
    if (!path || path.length === 0) return true; // No path, destroy

    const speed = projectile.speed ?? 1;
    let pathIndex = projectile.pathIndex ?? 0;

    // Move 'speed' cells along path
    for (let step = 0; step < speed; step++) {
      if (pathIndex >= path.length) {
        // Reached end of path
        return true;
      }

      const nextPos = path[pathIndex];
      const nextCell = context.spatial.grid.cell(nextPos.x, nextPos.y);

      // Check wall collision
      if (!nextCell || context.spatial.isBlocked(nextCell)) {
        if (projectile.bouncing) {
          const bounceCount = projectile.bounceCount ?? 0;
          const maxBounces = projectile.maxBounces ?? 1;

          if (bounceCount < maxBounces) {
            // Bounce: reverse remaining path
            projectile.bounceCount = bounceCount + 1;
            this.bouncePath(context, entityId, projectile, pathIndex);
            pathIndex = 0;
            projectile.pathIndex = 0;
            continue;
          }
        }
        // Hit wall, destroy
        return true;
      }

      // Move to next position
      context.spatial.move(entityId, nextPos.x, nextPos.y);
      pathIndex++;
      projectile.pathIndex = pathIndex;

      // Check entity collision at new position
      const hitResult = this.checkEntityCollision(context, entityId, projectile, nextPos);
      if (hitResult.hit) {
        if (hitResult.destroy) {
          return true;
        }
        // Piercing: continue moving
      }
    }

    return false;
  }

  /**
   * Bounce the projectile by reflecting the remaining path.
   */
  private bouncePath(
    context: GameContext,
    entityId: number,
    projectile: HasProjectile,
    hitIndex: number
  ): void {
    const pos = context.spatial.getEntityPosition(entityId);
    if (!pos) return;

    const path = projectile.path;
    if (!path || hitIndex <= 0) return;

    // Get the cell before the wall
    const prevPos = hitIndex > 0 ? path[hitIndex - 1] : pos;
    const wallPos = path[hitIndex];

    // Determine bounce direction (simple reflection)
    const dx = wallPos.x - prevPos.x;
    const dy = wallPos.y - prevPos.y;

    // Reflect: if hitting vertical wall, reverse dx; if horizontal, reverse dy
    // For simplicity, we'll create a new path going in the opposite direction
    const startCell = context.spatial.grid.cell(pos.x, pos.y);
    if (!startCell) return;

    // Calculate reflected target
    const remainingDistance = path.length - hitIndex;
    const reflectedTargetX = pos.x - dx * remainingDistance;
    const reflectedTargetY = pos.y - dy * remainingDistance;

    const targetCell = context.spatial.grid.cell(
      Math.max(0, Math.min(context.spatial.grid.width - 1, reflectedTargetX)),
      Math.max(0, Math.min(context.spatial.grid.height - 1, reflectedTargetY))
    );

    if (!targetCell) return;

    const newCells = LinkedCellUtils.getLine(startCell, targetCell);
    projectile.path = newCells.map((c) => ({ x: c.x, y: c.y }));
    projectile.pathIndex = 0;
  }

  /**
   * Check for entity collision at position.
   * @returns { hit: boolean, destroy: boolean }
   */
  private checkEntityCollision(
    context: GameContext,
    projectileId: number,
    projectile: HasProjectile,
    pos: { x: number; y: number }
  ): { hit: boolean; destroy: boolean } {
    const entitiesAtPos = context.spatial.getEntityIdsInCell(pos.x, pos.y);

    for (const targetId of entitiesAtPos) {
      if (targetId === projectileId) continue; // Skip self
      if (targetId === projectile.ownerId) continue; // Skip owner

      // Skip already hit entities (for piercing)
      if (projectile.hitEntityIds?.includes(targetId)) continue;

      const targetData = context.spatial.getEntityData(targetId);
      if (!targetData) continue;

      // Only damage entities with health
      if (!hasHealth(targetData)) continue;

      // Deal damage via HealthSystem
      this.healthSystem.damage(
        targetId,
        projectile.damage,
        projectile.damageType,
        projectile.ownerId
      );

      // Track hit for piercing
      if (!projectile.hitEntityIds) {
        projectile.hitEntityIds = [];
      }
      projectile.hitEntityIds.push(targetId);

      // Check piercing behavior
      if (projectile.piercing) {
        const maxPierces = projectile.maxPierces ?? Infinity;
        if (projectile.hitEntityIds.length >= maxPierces) {
          return { hit: true, destroy: true };
        }
        return { hit: true, destroy: false }; // Continue
      }

      // Non-piercing: destroy on hit
      return { hit: true, destroy: true };
    }

    return { hit: false, destroy: false };
  }

  /**
   * Spawn a projectile programmatically.
   * Convenience method for other systems to create projectiles.
   *
   * Emits a `projectile:launched` visual event so renderers can display
   * muzzle flash / blast cone effects on the first frame (before the
   * projectile has moved and can be interpolated).
   */
  spawnProjectile(
    context: GameContext,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    damage: number,
    options: Partial<HasProjectile> & { color?: string } = {}
  ): number {
    const projectileId = context.spatial.spawn('projectile', x, y, GameLayers.EPHEMERALS, {
      targetX,
      targetY,
      damage,
      ephemeral: true,
      ...options,
    });

    // Emit launch event for renderers (muzzle flash, blast cone, etc.)
    if (this.visualEventBus) {
      this.visualEventBus.emit({
        type: 'projectile:launched',
        entityId: projectileId,
        x,
        y,
        data: {
          ownerId: options.ownerId,
          targetX,
          targetY,
          speed: options.speed ?? 1,
          color: options.color,
          damageType: options.damageType,
        },
      });
    }

    return projectileId;
  }

  public override resetState(): void {
    super.resetState();
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      description: 'Projectile System (Bresenham paths, collision, damage)',
    };
  }
}
