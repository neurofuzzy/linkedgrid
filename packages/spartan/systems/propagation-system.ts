import type { GameSystem, GameContext, Position } from '../types.js';
import { Direction } from '../../grid/direction.js';
import { hasPropagation } from '../entities/trait-guards.js';

/**
 * Spread state tracked per source entity.
 * System-owned state (not serialized in entity data).
 */
interface SpreadState {
  lastSpreadTime: number; // Last time this source propagated
  originX: number; // Source position for distance tracking
  originY: number;
}

/**
 * Metadata tracked for propagated entities.
 * System-owned state (not serialized in entity data).
 */
interface PropagatedEntity {
  sourceId: number; // Which entity spawned this
  distance: number; // Distance from origin (Manhattan distance)
  spawnTime: number; // When spawned (for lifetime expiration)
}

/**
 * PropagationSystem - Handles spreading effects across the grid.
 *
 * Manages entities with propagation trait that spread to adjacent cells:
 * - Fire: Spreads through flammable materials, damages entities
 * - Liquid: Water, oil flow across floor
 * - Gas: Poison gas, smoke expanding through air
 * - Chain: Explosions, cascading reactions
 *
 * Propagation uses LinkedGrid's 4-neighbor topology (UP, DOWN, LEFT, RIGHT).
 * Supports boundary checking, distance limits, and lifetime expiration.
 *
 * Processing phases:
 * 1. Identify spread sources (entities with HasPropagation trait)
 * 2. Propagate from sources (check cadence, spawn to neighbors)
 * 3. Update spread state (track timing and distances)
 * 4. Clean up expired effects (remove entities past lifetime)
 *
 * @example
 * ```typescript
 * const propagationSystem = new PropagationSystem();
 * gameLoop.addSystem(propagationSystem);
 *
 * // Spawn fire that spreads
 * spatial.spawn('fire', 10, 10, GameLayers.FLOOR, {
 *   propagationType: 'fire',
 *   spreadRate: 1000,
 *   spreadLayer: GameLayers.FLOOR,
 *   spreadType: 'fire',
 *   maxDistance: 5,
 *   lifetime: 8000,
 *   blockedByLayers: [GameLayers.WALLS]
 * });
 * ```
 */
export class PropagationSystem implements GameSystem {
  // System-owned state per source entity (timing and origin position)
  private spreadState = new Map<number, SpreadState>();

  // System-owned state per propagated entity (source, distance, spawn time)
  private propagatedEntities = new Map<number, PropagatedEntity>();

  /**
   * Update called by GameLoop each tick.
   *
   * Processing phases:
   * 1. Identify spread sources
   * 2. Propagate from sources
   * 3. Update spread state
   * 4. Clean up expired effects
   */
  update(context: GameContext): void {
    const now = Date.now();

    // Phase 1: Identify spread sources
    const sources = this.identifySpreadSources(context);

    // Phase 2: Propagate from sources
    this.propagateFromSources(context, sources, now);

    // Phase 3: Update spread state (already updated in phase 2)
    // (State is updated as we propagate for efficiency)

    // Phase 4: Clean up expired effects
    this.cleanupExpiredEffects(context, now);
  }

  /**
   * Phase 1: Identify spread sources.
   *
   * Finds all entities with HasPropagation trait that are still alive.
   * Initializes spread state for new sources, inheriting origin from parent if propagated.
   */
  private identifySpreadSources(context: GameContext): Map<number, Position> {
    const sources = new Map<number, Position>();

    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasPropagation(entityData)) continue;

      // Check if entity is pending removal
      if (context.spatial.isAlive(entityId) === false) continue;

      // Initialize spread state if new source
      if (!this.spreadState.has(entityId)) {
        // Check if this entity was propagated from another source
        const propagatedMeta = this.propagatedEntities.get(entityId);
        if (propagatedMeta) {
          // Inherit origin from parent source
          const parentState = this.spreadState.get(propagatedMeta.sourceId);
          if (parentState) {
            this.spreadState.set(entityId, {
              lastSpreadTime: 0, // Allow immediate first spread
              originX: parentState.originX, // Use root origin
              originY: parentState.originY,
            });
          } else {
            // Fallback if parent state missing
            this.spreadState.set(entityId, {
              lastSpreadTime: 0,
              originX: pos.x,
              originY: pos.y,
            });
          }
        } else {
          // Original source - use its position as origin
          this.spreadState.set(entityId, {
            lastSpreadTime: 0,
            originX: pos.x,
            originY: pos.y,
          });
        }
      }

      sources.set(entityId, pos);
    }

    return sources;
  }

  /**
   * Phase 2: Propagate from sources.
   *
   * For each ready source:
   * - Check spread cadence timing
   * - Spread to 4 neighbors (UP, DOWN, LEFT, RIGHT)
   * - Check boundary conditions and distance limits
   * - Spawn new propagated entities
   */
  private propagateFromSources(
    context: GameContext,
    sources: Map<number, Position>,
    now: number
  ): void {
    for (const [sourceId, pos] of sources) {
      const sourceData = context.spatial.getEntityData(sourceId);
      if (!sourceData || !hasPropagation(sourceData)) continue;

      const state = this.spreadState.get(sourceId);
      if (!state) continue;

      // Check spread cadence timing
      const elapsed = now - state.lastSpreadTime;
      if (elapsed < sourceData.spreadRate) {
        continue; // Not ready to spread yet
      }

      // Get current cell
      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      // Try to spread to 4 neighbors
      const directions = [Direction.UP, Direction.DN, Direction.LT, Direction.RT];

      for (const dir of directions) {
        const neighbor = cell.neighbor(dir);
        if (!neighbor) continue; // Out of bounds

        // Check if we can spread to this neighbor
        if (!this.canSpreadTo(neighbor, sourceData, context)) continue;

        // Check distance limit
        if (sourceData.maxDistance !== undefined) {
          const distance = this.manhattanDistance(
            state.originX,
            state.originY,
            neighbor.x,
            neighbor.y
          );
          if (distance > sourceData.maxDistance) continue;
        }

        // Check if already occupied by entity from this source
        const existingEntityId = context.spatial.getEntityIdAt(
          neighbor.x,
          neighbor.y,
          sourceData.spreadLayer
        );
        if (existingEntityId !== undefined) {
          const existingMeta = this.propagatedEntities.get(existingEntityId);
          if (existingMeta && existingMeta.sourceId === sourceId) {
            continue; // Already has propagated entity from this source
          }
        }

        // Spawn propagated entity
        const newEntityId = context.spatial.spawn(
          sourceData.spreadType,
          neighbor.x,
          neighbor.y,
          sourceData.spreadLayer,
          {
            // Copy propagation properties so spawned entities can also spread
            propagationType: sourceData.propagationType,
            spreadRate: sourceData.spreadRate,
            spreadLayer: sourceData.spreadLayer,
            spreadType: sourceData.spreadType,
            maxDistance: sourceData.maxDistance,
            lifetime: sourceData.lifetime,
            blockedByLayers: sourceData.blockedByLayers,
            // Copy any floor effect properties if present
            ...(sourceData.effectType && {
              effectType: sourceData.effectType,
              triggerMode: sourceData.triggerMode,
              damage: sourceData.damage,
              healRate: sourceData.healRate,
              cadence: sourceData.cadence,
              cooldown: sourceData.cooldown,
            }),
            // Copy color if present
            ...(sourceData.color && { color: sourceData.color }),
          }
        );

        // Track propagated entity metadata
        const distance = this.manhattanDistance(
          state.originX,
          state.originY,
          neighbor.x,
          neighbor.y
        );
        this.propagatedEntities.set(newEntityId, {
          sourceId,
          distance,
          spawnTime: now,
        });
      }

      // Update last spread time
      state.lastSpreadTime = now;
    }
  }

  /**
   * Phase 4: Clean up expired effects.
   *
   * Removes propagated entities that have exceeded their lifetime.
   * Cleans up tracking state for removed entities.
   */
  private cleanupExpiredEffects(context: GameContext, now: number): void {
    const entitiesToRemove: number[] = [];

    // Check all propagated entities for expiration
    for (const [entityId, meta] of this.propagatedEntities.entries()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasPropagation(entityData)) {
        // Entity already removed or no longer has propagation trait
        entitiesToRemove.push(entityId);
        continue;
      }

      // Check if entity has lifetime and if it's expired
      if (entityData.lifetime !== undefined) {
        const age = now - meta.spawnTime;
        if (age >= entityData.lifetime) {
          context.spatial.remove(entityId);
          entitiesToRemove.push(entityId);
        }
      }
    }

    // Clean up tracking state for removed entities
    for (const entityId of entitiesToRemove) {
      this.propagatedEntities.delete(entityId);
      this.spreadState.delete(entityId);
    }

    // Clean up spread state for entities that no longer exist
    const existingEntities = new Set<number>();
    for (const [entityId] of context.spatial.getAllPositions()) {
      existingEntities.add(entityId);
    }

    for (const entityId of this.spreadState.keys()) {
      if (!existingEntities.has(entityId)) {
        this.spreadState.delete(entityId);
      }
    }
  }

  /**
   * Check if propagation can spread to a target cell.
   *
   * Checks:
   * - Blocked layers (entities on layers that block spread)
   * - Wall blocking (via spatial.isBlocked)
   *
   * Future expansion:
   * - Consumption model (can consume certain entity types)
   * - Chemical reactions (interaction with other propagation types)
   */
  private canSpreadTo(
    cell: any,
    config: any,
    context: GameContext
  ): boolean {
    // Check blocked layers
    if (config.blockedByLayers) {
      for (const layer of config.blockedByLayers) {
        if (cell.getValue(layer) !== undefined) {
          return false; // Blocked by entity on this layer
        }
      }
    }

    // Check if blocked by walls/obstacles
    if (context.spatial.isBlocked(cell)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate Manhattan distance between two points.
   */
  private manhattanDistance(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  /**
   * Reset all propagation state.
   * Useful for testing or scene transitions.
   */
  public resetState(): void {
    this.spreadState.clear();
    this.propagatedEntities.clear();
  }
}
