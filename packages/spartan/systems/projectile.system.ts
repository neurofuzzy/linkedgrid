/**
 * @brief Projectile System - Handles free-body projectile movement and collision.
 *
 * Projectiles are "free body" entities: they do NOT occupy grid cells.
 * Position is tracked via FreeBodyStore using world-space float coordinates:
 *   - Cell (cx, cy) center in world-space = (cx + 0.5, cy + 0.5)
 *   - Cell boundaries are at integer values
 *
 * Movement uses parametric velocity for smooth trajectories at any angle.
 * Collision detection uses geometric checks: circular for actors, AABB for walls.
 *
 * Projectiles skip movement on their spawn tick so the renderer can display
 * the spawn position for at least one frame before movement begins.
 */
import { BaseTickedSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import { hasProjectile, hasHealth, hasStunnable } from '../traits/trait-guards';
import type { HealthSystem } from './health.system';
import type { StunSystem } from './stun.system';
import type { HasProjectile } from '../traits/projectile.trait';
import type { VisualEventBus } from '../core/visual-event-bus';
import type { FreeBodyStore } from '../core/free-body-store';

/**
 * Spawn radius: half a cell. Projectile spawns at the perimeter of a circle
 * with this radius, centered on the launcher's cell center.
 */
const SPAWN_RADIUS = 0.5;

/**
 * Hit radius for actor collision (circular).
 * Projectile hits when within this distance of an actor's cell center.
 */
const ACTOR_HIT_RADIUS = 0.5;

/**
 * ProjectileSystem - Manages autonomous projectile movement and collision.
 *
 * Features:
 * - Parametric float movement for smooth non-orthogonal trajectories
 * - Free-body positioning (no grid cell occupancy)
 * - Configurable speed (cells per tick)
 * - Geometric collision: circular for actors, AABB for walls
 * - Piercing projectiles (pass through targets)
 * - Bouncing projectiles (reflect off walls)
 * - Homing projectiles (track moving targets)
 * - Lifetime expiration
 * - Integration with HealthSystem for damage
 * - Float-precision visual events for smooth rendering
 *
 * Coordinate convention (world-space):
 * - Grid cell (cx, cy) occupies area [cx, cx+1) × [cy, cy+1)
 * - Cell center = (cx + 0.5, cy + 0.5)
 * - Projectile positions are stored in this world-space
 *
 * @system
 * @reactsTo Entities with HasProjectile trait (tracked in FreeBodyStore)
 * @modifies Entity float position, removes expired projectiles
 */
export class ProjectileSystem extends BaseTickedSystem {
  readonly executionPhase = 'main' as const;

  protected tickRate = 1; // Run every tick for smooth movement

  private healthSystem: HealthSystem;

  /** Optional stun system for freeze projectiles */
  private stunSystem?: StunSystem;

  /** Optional visual event bus for emitting launch events */
  private visualEventBus?: VisualEventBus;

  /** Default stun duration for freeze projectiles (ticks) */
  private static readonly FREEZE_STUN_DURATION = 20;

  /** Active projectile entity IDs managed by this system */
  private activeProjectiles: Set<number> = new Set();

  constructor(healthSystem: HealthSystem, visualEventBus?: VisualEventBus) {
    super();
    this.healthSystem = healthSystem;
    this.visualEventBus = visualEventBus;
  }

  /**
   * Set the StunSystem reference for freeze projectile support.
   */
  setStunSystem(stunSystem: StunSystem): void {
    this.stunSystem = stunSystem;
  }

  protected onTick(context: GameContext): void {
    const currentTick = context.tick ?? 0;
    const freeBody = context.freeBody;
    if (!freeBody) return;

    const toRemove: number[] = [];

    for (const entityId of this.activeProjectiles) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasProjectile(entityData)) {
        toRemove.push(entityId);
        continue;
      }

      const projectile = entityData as typeof entityData & HasProjectile;

      // Deferred removal: projectile entered impact state on a previous tick.
      // The final position has already been committed, so the renderer had one
      // tick to interpolate the projectile to its collision/final position.
      if (projectile.impactTick !== undefined) {
        toRemove.push(entityId);
        continue;
      }

      // Initialize velocity on first tick.
      // We SKIP movement on the spawn tick so the renderer can display
      // the spawn position for at least one frame.
      if (projectile.vx === undefined || projectile.vy === undefined) {
        this.initializeVelocity(entityId, projectile, freeBody);
        projectile.spawnTick = currentTick;

        // Check entity collision at spawn position (geometric)
        const pos = freeBody.getPosition(entityId);
        if (pos) {
          const hitResult = this.checkEntityCollisionGeometric(context, entityId, projectile, pos.x, pos.y);
          if (hitResult.hit && hitResult.destroy) {
            toRemove.push(entityId);
            continue;
          }
        }

        // Skip movement on spawn tick — let the renderer display spawn position
        continue;
      }

      // Check lifetime expiration
      const lifetime = projectile.lifetime ?? 100;
      const age = currentTick - (projectile.spawnTick ?? currentTick);
      if (age >= lifetime) {
        this.emitImpactEvent(entityId, freeBody, 'expired');
        toRemove.push(entityId);
        continue;
      }

      // Homing: recalculate velocity toward target each tick
      if (projectile.homing) {
        this.updateHomingVelocity(context, entityId, projectile, freeBody);
      }

      // Move projectile along velocity vector
      const destroyed = this.moveProjectile(context, entityId, projectile, freeBody);
      if (destroyed) {
        // Enter impact state: defer removal to next tick so the renderer
        // can interpolate to the final position.
        projectile.impactTick = currentTick;
      }
    }

    // Remove impact/expired projectiles
    for (const entityId of toRemove) {
      this.removeProjectile(entityId, context, freeBody);
    }
  }

  /**
   * Initialize velocity vector from spawn position toward target.
   *
   * Target coordinates are grid-space; we convert to world-space center
   * (targetX + 0.5, targetY + 0.5) for accurate direction.
   */
  private initializeVelocity(
    entityId: number,
    projectile: HasProjectile,
    freeBody: FreeBodyStore
  ): void {
    const pos = freeBody.getPosition(entityId);
    if (!pos) return;

    const speed = projectile.speed ?? 1;

    // Convert grid-space target to world-space center
    const targetWx = projectile.targetX + 0.5;
    const targetWy = projectile.targetY + 0.5;

    const dx = targetWx - pos.x;
    const dy = targetWy - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) {
      // Target is at spawn position — give a default rightward velocity
      projectile.vx = speed;
      projectile.vy = 0;
    } else {
      projectile.vx = (dx / dist) * speed;
      projectile.vy = (dy / dist) * speed;
    }

    projectile.spawnFloatX = pos.x;
    projectile.spawnFloatY = pos.y;
    projectile.hitEntityIds = [];
    projectile.bounceCount = 0;
  }

  /**
   * Update homing projectile velocity toward its target.
   * If the target is dead or missing, keeps the current trajectory.
   *
   * Target position from getEntityPosition is grid-space; we convert
   * to world-space center for accurate direction.
   */
  private updateHomingVelocity(
    context: GameContext,
    entityId: number,
    projectile: HasProjectile,
    freeBody: FreeBodyStore
  ): void {
    const targetId = projectile.homingTargetId;
    if (targetId === undefined) return;

    // If target is dead, continue on current trajectory
    if (!context.spatial.isAlive(targetId)) return;

    const targetPos = context.spatial.getEntityPosition(targetId);
    if (!targetPos) return;

    const pos = freeBody.getPosition(entityId);
    if (!pos) return;

    const speed = projectile.speed ?? 1;
    const strength = projectile.homingStrength ?? 1.0;

    // Convert grid-space target to world-space center
    const targetWx = targetPos.x + 0.5;
    const targetWy = targetPos.y + 0.5;

    // Compute desired velocity toward target
    const dx = targetWx - pos.x;
    const dy = targetWy - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return; // Already at target

    const desiredVx = (dx / dist) * speed;
    const desiredVy = (dy / dist) * speed;

    // Blend current velocity with desired based on homingStrength
    const currentVx = projectile.vx ?? 0;
    const currentVy = projectile.vy ?? 0;

    const blendedVx = currentVx + (desiredVx - currentVx) * strength;
    const blendedVy = currentVy + (desiredVy - currentVy) * strength;

    // Re-normalize to maintain consistent speed
    const blendedDist = Math.sqrt(blendedVx * blendedVx + blendedVy * blendedVy);
    if (blendedDist > 0) {
      projectile.vx = (blendedVx / blendedDist) * speed;
      projectile.vy = (blendedVy / blendedDist) * speed;
    }

    // Update target coordinates for reference (grid-space)
    projectile.targetX = targetPos.x;
    projectile.targetY = targetPos.y;
  }

  /**
   * Move projectile along its velocity vector and check for collisions.
   *
   * Sub-steps are sized to at most 0.5 cells to ensure geometric collision
   * checks don't skip over actors between cells.
   *
   * Wall collision: AABB (checked when entering a new cell via Math.floor).
   * Actor collision: circular distance check in 3x3 neighborhood (every sub-step).
   *
   * @returns true if projectile should enter impact state
   */
  private moveProjectile(
    context: GameContext,
    entityId: number,
    projectile: HasProjectile,
    freeBody: FreeBodyStore
  ): boolean {
    const pos = freeBody.getPosition(entityId);
    if (!pos) return true;

    const vx = projectile.vx ?? 0;
    const vy = projectile.vy ?? 0;
    if (vx === 0 && vy === 0) return true;

    const speed = projectile.speed ?? 1;
    const fromFloatX = pos.x;
    const fromFloatY = pos.y;

    // Total displacement this tick
    const totalDx = vx;
    const totalDy = vy;

    // Sub-steps of at most 0.5 cells so geometric checks don't skip actors
    const steps = Math.max(1, Math.ceil(speed * 2));
    const stepDx = totalDx / steps;
    const stepDy = totalDy / steps;

    let floatX = pos.x;
    let floatY = pos.y;
    let prevCellX = Math.floor(floatX);
    let prevCellY = Math.floor(floatY);

    for (let step = 0; step < steps; step++) {
      const prevFloatX = floatX;
      const prevFloatY = floatY;
      floatX += stepDx;
      floatY += stepDy;

      const cellX = Math.floor(floatX);
      const cellY = Math.floor(floatY);
      const cellChanged = cellX !== prevCellX || cellY !== prevCellY;

      // --- Wall check (only on cell change) ---
      if (cellChanged) {
        prevCellX = cellX;
        prevCellY = cellY;

        // Check if we've left the grid bounds
        if (!context.spatial.grid.isValid(cellX, cellY)) {
          freeBody.setPosition(entityId, floatX, floatY);
          this.emitMovedEvent(entityId, fromFloatX, fromFloatY, floatX, floatY);
          this.emitImpactEvent(entityId, freeBody, 'out-of-bounds');
          return true;
        }

        const cell = context.spatial.grid.cell(cellX, cellY);

        // Wall collision (AABB — point inside blocked cell)
        if (!cell || context.spatial.isBlocked(cell)) {
          // Compute exact wall surface position via parametric intersection
          const wallStop = this.computeWallStopPosition(
            prevFloatX, prevFloatY, stepDx, stepDy, cellX, cellY
          );

          if (projectile.bouncing) {
            const bounceCount = projectile.bounceCount ?? 0;
            const maxBounces = projectile.maxBounces ?? 1;

            if (bounceCount < maxBounces) {
              projectile.bounceCount = bounceCount + 1;
              this.bounceVelocity(context, projectile, floatX, floatY, stepDx, stepDy);

              // Place at wall surface and continue next tick with reflected velocity
              floatX = wallStop.x;
              floatY = wallStop.y;
              freeBody.setPosition(entityId, floatX, floatY);
              this.emitMovedEvent(entityId, fromFloatX, fromFloatY, floatX, floatY);
              return false; // Continue next tick with new velocity
            }
          }

          // Hit wall — place at wall surface
          floatX = wallStop.x;
          floatY = wallStop.y;
          freeBody.setPosition(entityId, floatX, floatY);
          this.emitMovedEvent(entityId, fromFloatX, fromFloatY, floatX, floatY);
          this.emitImpactEvent(entityId, freeBody, 'wall');
          return true;
        }
      }

      // --- Actor collision (geometric, every sub-step) ---
      const hitResult = this.checkEntityCollisionGeometric(context, entityId, projectile, floatX, floatY);
      if (hitResult.hit && hitResult.destroy) {
        freeBody.setPosition(entityId, floatX, floatY);
        this.emitMovedEvent(entityId, fromFloatX, fromFloatY, floatX, floatY);
        this.emitImpactEvent(entityId, freeBody, 'entity');
        return true;
      }
    }

    // Check if projectile has reached or passed its target
    if (!projectile.homing) {
      const spawnFloatX = projectile.spawnFloatX ?? fromFloatX;
      const spawnFloatY = projectile.spawnFloatY ?? fromFloatY;

      // Target in world-space
      const targetWx = projectile.targetX + 0.5;
      const targetWy = projectile.targetY + 0.5;

      const distToTarget = Math.sqrt(
        (targetWx - spawnFloatX) ** 2 + (targetWy - spawnFloatY) ** 2
      );
      const distTraveled = Math.sqrt(
        (floatX - spawnFloatX) ** 2 + (floatY - spawnFloatY) ** 2
      );

      if (distTraveled >= distToTarget) {
        freeBody.setPosition(entityId, floatX, floatY);
        this.emitMovedEvent(entityId, fromFloatX, fromFloatY, floatX, floatY);
        this.emitImpactEvent(entityId, freeBody, 'end-of-path');
        return true;
      }
    }

    // No collision — commit new position
    freeBody.setPosition(entityId, floatX, floatY);
    this.emitMovedEvent(entityId, fromFloatX, fromFloatY, floatX, floatY);

    return false;
  }

  /**
   * Compute the float position just before a wall cell boundary.
   *
   * Uses parametric intersection: given a sub-step from (prevFloatX, prevFloatY)
   * with delta (stepDx, stepDy) entering wall cell (wallCellX, wallCellY),
   * finds the exact t at which the projectile crosses into the cell,
   * then returns a position just before that crossing.
   *
   * Wall cell occupies [wallCellX, wallCellX+1) × [wallCellY, wallCellY+1)
   * in world-space.
   */
  private computeWallStopPosition(
    prevFloatX: number,
    prevFloatY: number,
    stepDx: number,
    stepDy: number,
    wallCellX: number,
    wallCellY: number
  ): { x: number; y: number } {
    const WALL_EPSILON = 0.001;
    let t = 1.0;

    // Find parametric t for X-axis crossing
    if (stepDx !== 0) {
      // Moving +x: hits left face (x = wallCellX)
      // Moving -x: hits right face (x = wallCellX + 1)
      const edgeX = stepDx > 0 ? wallCellX : wallCellX + 1;
      const tx = (edgeX - prevFloatX) / stepDx;
      if (tx >= 0 && tx < t) t = tx;
    }

    // Find parametric t for Y-axis crossing
    if (stepDy !== 0) {
      // Moving +y: hits top face (y = wallCellY)
      // Moving -y: hits bottom face (y = wallCellY + 1)
      const edgeY = stepDy > 0 ? wallCellY : wallCellY + 1;
      const ty = (edgeY - prevFloatY) / stepDy;
      if (ty >= 0 && ty < t) t = ty;
    }

    // Position just before the wall surface
    const safeT = Math.max(0, t - WALL_EPSILON);
    return {
      x: prevFloatX + stepDx * safeT,
      y: prevFloatY + stepDy * safeT,
    };
  }

  /**
   * Reflect velocity on wall impact.
   *
   * Determines which axis to reflect based on whether the wall is
   * horizontal or vertical relative to approach direction.
   */
  private bounceVelocity(
    context: GameContext,
    projectile: HasProjectile,
    hitFloatX: number,
    hitFloatY: number,
    stepDx: number,
    stepDy: number
  ): void {
    // Determine wall orientation by testing adjacent cells
    const prevCellX = Math.floor(hitFloatX - stepDx);
    const prevCellY = Math.floor(hitFloatY - stepDy);
    const hitCellX = Math.floor(hitFloatX);
    const hitCellY = Math.floor(hitFloatY);

    const dx = hitCellX - prevCellX;
    const dy = hitCellY - prevCellY;

    // Try reflecting each axis to find valid bounce direction
    if (dx !== 0 && dy !== 0) {
      // Diagonal approach: try reflecting X first
      const cellAfterReflectX = context.spatial.grid.cell(prevCellX, hitCellY);
      const cellAfterReflectY = context.spatial.grid.cell(hitCellX, prevCellY);

      if (cellAfterReflectX && !context.spatial.isBlocked(cellAfterReflectX)) {
        // Reflect X axis (bounce off vertical wall)
        projectile.vx = -(projectile.vx ?? 0);
      } else if (cellAfterReflectY && !context.spatial.isBlocked(cellAfterReflectY)) {
        // Reflect Y axis (bounce off horizontal wall)
        projectile.vy = -(projectile.vy ?? 0);
      } else {
        // Corner: reflect both axes
        projectile.vx = -(projectile.vx ?? 0);
        projectile.vy = -(projectile.vy ?? 0);
      }
    } else if (dx !== 0) {
      // Approaching from X: reflect X
      projectile.vx = -(projectile.vx ?? 0);
    } else {
      // Approaching from Y: reflect Y
      projectile.vy = -(projectile.vy ?? 0);
    }
  }

  /**
   * Geometric entity collision check.
   *
   * Checks a 3x3 neighborhood of cells around the projectile's world-space position.
   * For each entity with health found, tests circular collision:
   *   distance(projectile, entityWorldCenter) < ACTOR_HIT_RADIUS
   *
   * Grid entity at cell (cx, cy) has world-space center (cx + 0.5, cy + 0.5).
   *
   * @returns { hit: boolean, destroy: boolean }
   */
  private checkEntityCollisionGeometric(
    context: GameContext,
    projectileId: number,
    projectile: HasProjectile,
    floatX: number,
    floatY: number
  ): { hit: boolean; destroy: boolean } {
    const centerCellX = Math.floor(floatX);
    const centerCellY = Math.floor(floatY);

    // Scan 3x3 neighborhood for potential hits
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = centerCellX + dx;
        const cy = centerCellY + dy;

        if (!context.spatial.grid.isValid(cx, cy)) continue;

        const entitiesAtPos = context.spatial.getEntityIdsInCell(cx, cy);

        for (const targetId of entitiesAtPos) {
          if (targetId === projectileId) continue;
          if (targetId === projectile.ownerId) continue;
          if (projectile.hitEntityIds?.includes(targetId)) continue;

          const targetData = context.spatial.getEntityData(targetId);
          if (!targetData) continue;
          if (!hasHealth(targetData)) continue;

          // Get entity's grid position and convert to world-space center
          const targetPos = context.spatial.getEntityPosition(targetId);
          if (!targetPos) continue;
          const entityWx = targetPos.x + 0.5;
          const entityWy = targetPos.y + 0.5;

          // Circular collision: distance from projectile point to entity center
          const distSq = (floatX - entityWx) ** 2 + (floatY - entityWy) ** 2;
          if (distSq >= ACTOR_HIT_RADIUS * ACTOR_HIT_RADIUS) continue;

          // --- HIT ---

          // Freeze projectiles: apply stun to stunnable targets
          if (projectile.damageType === 'freeze' && this.stunSystem && hasStunnable(targetData)) {
            this.stunSystem.applyStun(targetId, ProjectileSystem.FREEZE_STUN_DURATION);
          }

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
      }
    }

    return { hit: false, destroy: false };
  }

  /**
   * Spawn a projectile programmatically.
   *
   * Callers pass the **launcher's grid cell** as (x, y). The projectile spawns
   * at the edge of the launcher's circle (radius 0.5) at the angle toward the
   * target, in world-space coordinates.
   *
   * World-space formula:
   *   centerX = x + 0.5   (cell center)
   *   centerY = y + 0.5
   *   spawnX = centerX + SPAWN_RADIUS * cos(angle toward target)
   *   spawnY = centerY + SPAWN_RADIUS * sin(angle toward target)
   *
   * Projectiles skip movement on their spawn tick so the renderer can display
   * the spawn position for at least one frame.
   *
   * @param context - Game context
   * @param x - Launcher grid cell X
   * @param y - Launcher grid cell Y
   * @param targetX - Target grid cell X
   * @param targetY - Target grid cell Y
   * @param damage - Damage dealt on hit
   * @param options - Additional projectile options
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
    const freeBody = context.freeBody;
    const store = context.spatial.getStore();

    // Cell center in world-space
    const centerX = x + 0.5;
    const centerY = y + 0.5;

    // Direction from launcher center toward target center
    const dx = targetX - x; // (targetX + 0.5) - (x + 0.5) cancels the +0.5
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let spawnFloatX = centerX;
    let spawnFloatY = centerY;
    if (dist > 0) {
      spawnFloatX = centerX + (dx / dist) * SPAWN_RADIUS;
      spawnFloatY = centerY + (dy / dist) * SPAWN_RADIUS;
    }

    // Create entity in store without grid placement
    const projectileId = store.createId('projectile', {
      targetX,
      targetY,
      damage,
      floatX: spawnFloatX,
      floatY: spawnFloatY,
      ephemeral: true,
      ...options,
    });

    // Register in FreeBodyStore for float position tracking (world-space)
    if (freeBody) {
      freeBody.register(projectileId, spawnFloatX, spawnFloatY);
    }

    // Track in our active set
    this.activeProjectiles.add(projectileId);

    // Emit launch event for renderers (muzzle flash, blast cone, etc.)
    if (this.visualEventBus) {
      this.visualEventBus.emit({
        type: 'projectile:launched',
        entityId: projectileId,
        x: Math.floor(spawnFloatX),
        y: Math.floor(spawnFloatY),
        data: {
          ownerId: options.ownerId,
          targetX,
          targetY,
          speed: options.speed ?? 1,
          color: options.color,
          damageType: options.damageType,
          floatX: spawnFloatX,
          floatY: spawnFloatY,
        },
      });
    }

    return projectileId;
  }

  /**
   * Remove a projectile from all tracking.
   */
  private removeProjectile(
    entityId: number,
    context: GameContext,
    freeBody: FreeBodyStore
  ): void {
    freeBody.remove(entityId);
    context.spatial.getStore().remove(entityId);
    this.activeProjectiles.delete(entityId);
  }

  /**
   * Emit a projectile:moved visual event with float positions.
   */
  private emitMovedEvent(
    entityId: number,
    fromFloatX: number,
    fromFloatY: number,
    toFloatX: number,
    toFloatY: number
  ): void {
    if (!this.visualEventBus) return;
    this.visualEventBus.emit({
      type: 'projectile:moved',
      entityId,
      x: Math.floor(toFloatX),
      y: Math.floor(toFloatY),
      data: {
        fromFloatX,
        fromFloatY,
        toFloatX,
        toFloatY,
      },
    });
  }

  /**
   * Emit a projectile:impact visual event at the projectile's current position.
   */
  private emitImpactEvent(
    entityId: number,
    freeBody: FreeBodyStore,
    reason: string
  ): void {
    if (!this.visualEventBus) return;
    const pos = freeBody.getPosition(entityId);
    if (!pos) return;
    this.visualEventBus.emit({
      type: 'projectile:impact',
      entityId,
      x: Math.floor(pos.x),
      y: Math.floor(pos.y),
      data: {
        floatX: pos.x,
        floatY: pos.y,
        reason,
      },
    });
  }

  public override resetState(): void {
    super.resetState();
    this.activeProjectiles.clear();
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      activeProjectiles: this.activeProjectiles.size,
      description: 'Projectile System (free-body float movement, geometric collision)',
    };
  }
}
