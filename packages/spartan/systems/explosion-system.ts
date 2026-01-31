import type { GameSystem, GameContext, EntityData } from '../types';
import { LinkedCellUtils } from '../../grid/linked-cell-utils';
import { hasExplosion, hasDamageable, hasHealth, hasTemperature } from '../entities/trait-guards';
import { GameLayers } from '../layers/types';

/**
 * Explosion event to be processed.
 * Internal system state.
 */
interface ExplosionEvent {
  x: number;
  y: number;
  damage: number;
  radius: number;
  sourceEntityId: number; // For tracking chain reactions
}

/**
 * ExplosionSystem - Handles instantaneous area-of-effect explosions.
 *
 * Manages explosive entities that detonate on triggers:
 * - Damage entities within radius (respecting line-of-sight)
 * - Check hardness thresholds for damageable entities
 * - Ignite flammable entities
 * - Create visual effects
 * - Support chain reactions
 *
 * Explosions use LinkedCellUtils.fieldOfView for realistic wall blocking:
 * - Walls create shadow zones (cover from explosions)
 * - Line-of-sight determines affected area
 * - No damage penetrates through walls
 *
 * Trigger conditions:
 * - 'on-death': Entity explodes when destroyed (hp reaches 0)
 * - 'on-fire': Entity explodes when fire is at same position
 * - 'manual': Explicit trigger via system (future use)
 *
 * @example
 * ```typescript
 * const explosionSystem = new ExplosionSystem();
 * gameLoop.addSystem(explosionSystem);
 *
 * // Spawn explosive barrel
 * spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
 *   hp: 20,
 *   maxHp: 20,
 *   explosionDamage: 30,
 *   explosionRadius: 4,
 *   triggerCondition: 'on-death',
 *   flammability: 0.7
 * });
 * ```
 */
export class ExplosionSystem implements GameSystem {
  // Queue of explosions to process this tick
  private explosionQueue: ExplosionEvent[] = [];

  // Track entities that triggered explosions this tick (prevent duplicates)
  private explodedThisTick = new Set<number>();

  // Track current tick for lifetime management
  private currentTick = 0;

  /**
   * Update called by GameLoop each tick.
   *
   * Processing phases:
   * 1. Detect explosion triggers
   * 2. Process explosion queue
   * 3. Clean up expired visuals
   * 4. Track removed entities for next tick
   */
  update(context: GameContext): void {
    this.currentTick++;

    // Clear per-tick state
    this.explodedThisTick.clear();

    // Phase 1: Detect explosion triggers
    this.detectExplosionTriggers(context);

    // Phase 2: Process all explosions
    this.processExplosions(context);

    // Phase 3: Clean up expired visual effects
    this.cleanupExpiredVisuals(context);

    // Phase 4: Track removed entities for next tick's on-death detection
    this.trackRemovedEntities(context);
  }

  /**
   * Phase 1: Detect explosion triggers.
   *
   * Checks for:
   * - Entities with HP <= 0 that have HasExplosion and triggerCondition 'on-death'
   * - Entities on fire with HasExplosion and triggerCondition 'on-fire'
   */
  private detectExplosionTriggers(context: GameContext): void {
    // Check all entities for explosion triggers
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasExplosion(entityData)) continue;

      const trigger = entityData.triggerCondition || 'on-death';

      // Check for on-death trigger (entity has died this tick)
      if (trigger === 'on-death') {
        if (hasHealth(entityData) && entityData.hp <= 0) {
          this.queueExplosion(pos.x, pos.y, entityData.explosionDamage, entityData.explosionRadius, entityId);
          // Remove the exploded entity to prevent repeated explosions
          context.spatial.remove(entityId);
        }
      }

      // Check for on-fire trigger
      if (trigger === 'on-fire') {
        // Check if entity is on fire (temperature >= flamePoint)
        if (hasTemperature(entityData) && entityData.temperature >= entityData.flamePoint && entityData.flammable) {
          this.queueExplosion(pos.x, pos.y, entityData.explosionDamage, entityData.explosionRadius, entityId);
          // Remove the exploded entity to prevent repeated explosions
          context.spatial.remove(entityId);
        }
      }
    }
  }

  /**
   * Queue an explosion event.
   */
  private queueExplosion(x: number, y: number, damage: number, radius: number, sourceEntityId: number): void {
    // Prevent duplicate explosions same tick
    if (this.explodedThisTick.has(sourceEntityId)) {
      return;
    }

    // Validate explosion parameters
    if (!Number.isFinite(damage) || damage < 0) {
      console.warn(`ExplosionSystem: Invalid damage value ${damage} for entity ${sourceEntityId}, skipping`);
      return;
    }
    if (!Number.isFinite(radius) || radius < 0) {
      console.warn(`ExplosionSystem: Invalid radius value ${radius} for entity ${sourceEntityId}, skipping`);
      return;
    }

    this.explodedThisTick.add(sourceEntityId);
    this.explosionQueue.push({ x, y, damage, radius, sourceEntityId });
  }

  /**
   * Phase 2: Process all queued explosions.
   *
   * For each explosion:
   * - Calculate affected area using fieldOfView
   * - Apply damage to entities (checking hardness)
   * - Ignite flammable entities
   * - Spawn visual effect
   */
  private processExplosions(context: GameContext): void {
    while (this.explosionQueue.length > 0) {
      const explosion = this.explosionQueue.shift()!;
      this.processExplosion(context, explosion);
    }
  }

  /**
   * Process a single explosion.
   */
  private processExplosion(context: GameContext, explosion: ExplosionEvent): void {
    const { x, y, damage, radius } = explosion;

    // Validate parameters (defense in depth)
    if (!Number.isFinite(damage) || damage < 0 || !Number.isFinite(radius) || radius < 0) {
      return;
    }

    // Get epicenter cell
    const epicenter = context.spatial.grid.cell(x, y);
    if (!epicenter) return;

    // Calculate affected area using fieldOfView with wall blocking
    const affectedCells = LinkedCellUtils.fieldOfView(
      epicenter,
      radius,
      (cell) => context.spatial.isBlocked(cell)
    );

    // Apply effects to all affected cells
    for (const cell of affectedCells) {
      // Calculate distance for potential damage falloff (currently using full damage)
      // const distance = Math.sqrt((cell.x - x) ** 2 + (cell.y - y) ** 2);
      const effectiveDamage = damage; // Could add falloff: damage * (1 - distance / radius)

      // Apply damage and ignition to all entities at this position
      this.applyExplosionEffects(context, cell.x, cell.y, effectiveDamage);
    }

    // Spawn visual effect at epicenter
    context.spatial.spawn('explosion-visual', x, y, GameLayers.EPHEMERALS, {
      lifetime: 2, // Lasts 2 ticks
      color: '#ff6600',
      spawnTick: this.currentTick, // Track spawn tick for cleanup
    });
  }

  /**
   * Apply explosion effects to all entities at a position.
   */
  private applyExplosionEffects(context: GameContext, x: number, y: number, damage: number): void {
    // Validate damage (defense in depth)
    if (!Number.isFinite(damage) || damage < 0) {
      return;
    }

    // Check all layers for entities
    const layers = [
      GameLayers.FLOOR,
      GameLayers.FLOOR_EFFECTS,
      GameLayers.COLLECTIBLES,
      GameLayers.WALLS,
      GameLayers.EPHEMERALS,
      GameLayers.ACTORS,
    ];

    for (const layer of layers) {
      const entityId = context.spatial.getEntityIdAt(x, y, layer);
      if (entityId === undefined) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData) continue;

      // Apply damage to entities with health
      if (hasHealth(entityData)) {
        // Check hardness threshold if entity is damageable
        if (hasDamageable(entityData)) {
          if (damage < entityData.hardness) {
            // Damage doesn't meet threshold
            continue;
          }
        }

        // Apply damage
        entityData.hp -= damage;

        // Note: Entity removal is handled by other systems (e.g., health check systems)
        // We just modify the HP here
      }

      // Ignite flammable entities by raising temperature
      if (hasTemperature(entityData) && entityData.flammable) {
        // Raise temperature to ignition point
        entityData.temperature = entityData.flamePoint + 50;
      }
    }
  }

  /**
   * Phase 3: Clean up expired visual effects.
   *
   * Removes explosion-visual entities that have exceeded their lifetime.
   */
  private cleanupExpiredVisuals(context: GameContext): void {
    const visualsToRemove: number[] = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData) continue;

      // Check if this is an explosion visual with lifetime
      if (entityData.type === 'explosion-visual' && 'lifetime' in entityData && 'spawnTick' in entityData) {
        const lifetime = entityData.lifetime as number;
        const spawnTick = (entityData as EntityData & { spawnTick: number }).spawnTick;
        const age = this.currentTick - spawnTick;

        if (age >= lifetime) {
          visualsToRemove.push(entityId);
        }
      }
    }

    // Remove expired visuals
    for (const entityId of visualsToRemove) {
      context.spatial.remove(entityId);
    }
  }

  /**
   * Phase 4: Track removed entities (placeholder for future cleanup).
   *
   * Currently, explosion detection happens in Phase 1 by checking HP <= 0.
   * This method is reserved for future entity cleanup tracking if needed.
   */
  private trackRemovedEntities(_context: GameContext): void {
    // Entity removal tracking is handled in detectExplosionTriggers
    // by checking HP <= 0 directly on entities
  }

  /**
   * Reset system state.
   * Useful for testing or scene transitions.
   */
  public resetState(): void {
    this.explosionQueue = [];
    this.explodedThisTick.clear();
    this.currentTick = 0;
  }

  /**
   * Get debug state for troubleshooting.
   */
  public getDebugState() {
    return {
      currentTick: this.currentTick,
      explosionQueueSize: this.explosionQueue.length,
      explosions: [...this.explosionQueue],
      explodedThisTick: Array.from(this.explodedThisTick),
    };
  }
}
