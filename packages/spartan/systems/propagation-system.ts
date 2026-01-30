import type { GameSystem, GameContext, Position, EntityData } from '../types';
import { Direction } from '../../grid/direction';
import type { LinkedCell } from '../../grid/linked-cell';
import { hasPropagation, isAsh } from '../entities/trait-guards';
import { GameLayers } from '../layers/types';

/**
 * Spread state tracked per source entity.
 * System-owned state (not serialized in entity data).
 */
interface SpreadState {
  lastSpreadTick: number; // Last tick this source propagated
  spawnTick: number; // Tick when this entity was first seen (for original sources)
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
  spawnTick: number; // Tick when spawned (for lifetime expiration)
}

/**
 * Propagation configuration from entity data.
 */
interface PropagationConfig extends EntityData {
  propagationType?: string;
  spreadLayer: number;
  blockedByLayers?: number[];
}

/**
 * PropagationSystem - Handles spreading effects across the grid.
 *
 * Manages entities with propagation trait that spread to adjacent cells:
 * - Liquid: Water, oil flow across floor (deterministic)
 * - Gas: Poison gas, smoke expanding through air (deterministic)
 * - Chain: Explosions, cascading reactions (deterministic)
 *
 * Propagation uses LinkedGrid's 4-neighbor topology (UP, DOWN, LEFT, RIGHT).
 * Supports boundary checking, distance limits, lifetime expiration, and probability.
 *
 * Timing is tick-based (not ms-based) for deterministic behavior.
 *
 * Processing phases:
 * 1. Identify spread sources (entities with HasPropagation trait)
 * 2. Propagate from sources (check cadence, spawn to neighbors with probability)
 * 3. Update spread state (track timing and distances)
 * 4. Clean up expired effects (remove entities past lifetime)
 *
 * @example
 * ```typescript
 * const propagationSystem = new PropagationSystem();
 * gameLoop.addSystem(propagationSystem);
 *
 * // Spawn water that spreads deterministically
 * spatial.spawn('water', 10, 10, GameLayers.FLOOR, {
 *   propagationType: 'liquid',
 *   spreadRate: 1,              // Spread every tick
 *   spreadProbability: 1.0,     // 100% chance
 *   spreadLayer: GameLayers.FLOOR,
 *   spreadType: 'water',
 *   maxDistance: 10,
 *   color: '#4a90e2'
 * });
 * ```
 */
export class PropagationSystem implements GameSystem {
  // System-owned state per source entity (timing and origin position)
  private spreadState = new Map<number, SpreadState>();

  // System-owned state per propagated entity (source, distance, spawn tick)
  private propagatedEntities = new Map<number, PropagatedEntity>();

  // Track current tick for timing
  private currentTick = 0;

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
    this.currentTick++;

    // Phase 1: Identify spread sources
    const sources = this.identifySpreadSources(context);

    // Phase 2: Propagate from sources
    this.propagateFromSources(context, sources);

    // Phase 3: Update spread state (already updated in phase 2)
    // (State is updated as we propagate for efficiency)

    // Phase 4: Clean up expired effects
    this.cleanupExpiredEffects(context);
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
              lastSpreadTick: this.currentTick, // Start cadence from when spawned
              spawnTick: propagatedMeta.spawnTick, // Use tracked spawn tick
              originX: parentState.originX, // Use root origin
              originY: parentState.originY,
            });
          } else {
            // Fallback if parent state missing
            this.spreadState.set(entityId, {
              lastSpreadTick: this.currentTick,
              spawnTick: propagatedMeta.spawnTick,
              originX: pos.x,
              originY: pos.y,
            });
          }
        } else {
          // Original source - use its position as origin and current tick as spawn tick
          this.spreadState.set(entityId, {
            lastSpreadTick: this.currentTick,
            spawnTick: this.currentTick,
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
   * - Check spread cadence timing (tick-based)
   * - Spread to 4 neighbors (UP, DOWN, LEFT, RIGHT) with probability check
   * - Check boundary conditions and distance limits
   * - Spawn new propagated entities
   */
  private propagateFromSources(
    context: GameContext,
    sources: Map<number, Position>
  ): void {
    for (const [sourceId, pos] of sources) {
      const sourceData = context.spatial.getEntityData(sourceId);
      if (!sourceData || !hasPropagation(sourceData)) continue;

      const state = this.spreadState.get(sourceId);
      if (!state) continue;

      // Check spread cadence timing (tick-based)
      const ticksElapsed = this.currentTick - state.lastSpreadTick;
      if (ticksElapsed < sourceData.spreadRate) {
        continue; // Not ready to spread yet
      }

      // Get current cell
      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      // Get spread probability (default 1.0 for deterministic spreading)
      const probability = sourceData.spreadProbability ?? 1.0;

      // Try to spread to 4 neighbors
      const directions = [
        Direction.UP,
        Direction.DN,
        Direction.LT,
        Direction.RT,
      ];

      for (const dir of directions) {
        const neighbor = cell.neighbor(dir);
        if (!neighbor) continue; // Out of bounds
        
        // Probability check: roll for each neighbor independently
        if (Math.random() > probability) {
          continue; // Failed probability roll for this neighbor
        }

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

        // Check if already occupied by propagated entity from this source on spreadLayer
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
            spreadProbability: sourceData.spreadProbability,
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
        
        // Determine root source: if current entity is propagated, use its root source
        // Otherwise, current entity IS the root source
        const rootSourceId = this.propagatedEntities.get(sourceId)?.sourceId ?? sourceId;
        
        this.propagatedEntities.set(newEntityId, {
          sourceId: rootSourceId,
          distance,
          spawnTick: this.currentTick,
        });
      }

      // Update last spread tick
      state.lastSpreadTick = this.currentTick;
    }
  }

  /**
   * Phase 4: Clean up expired effects.
   *
   * Removes entities with propagation trait that have exceeded their lifetime (tick-based).
   * Cleans up tracking state for removed entities.
   */
  private cleanupExpiredEffects(context: GameContext): void {
    const entitiesToRemove: Array<{id: number, pos: Position}> = [];

    // Check ALL entities with propagation trait for expiration (not just propagated ones)
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasPropagation(entityData)) continue;
      if (!entityData.lifetime) continue; // Skip entities without lifetime

      // Determine spawn tick for this entity
      let spawnTick = 0;
      const meta = this.propagatedEntities.get(entityId);
      if (meta) {
        // This is a propagated entity, use tracked spawn tick
        spawnTick = meta.spawnTick;
      } else {
        // This is an original source entity. Use its spawn tick from the spread state.
        const state = this.spreadState.get(entityId);
        spawnTick = state?.spawnTick ?? 0;
      }

      // Check if expired
      const age = this.currentTick - spawnTick;
      if (age >= entityData.lifetime) {
        entitiesToRemove.push({id: entityId, pos});
      }
    }

    // Remove expired entities
    for (const {id} of entitiesToRemove) {
      context.spatial.remove(id);
    }

    // Clean up tracking state for removed entities
    for (const {id} of entitiesToRemove) {
      this.propagatedEntities.delete(id);
      this.spreadState.delete(id);
    }

    // Clean up spread state for entities that no longer exist
    for (const entityId of this.spreadState.keys()) {
      if (!context.spatial.isAlive(entityId)) {
        this.spreadState.delete(entityId);
      }
    }
  }

  /**
   * Check if propagation can spread to a target cell.
   *
   * Checks:
   * - Not already consumed (ash on FLOOR_EFFECTS layer)
   * - Blocked layers (entities on layers that block spread)
   * - Wall blocking (via spatial.isBlocked)
   * - Flammability (fire only spreads to flammable entities)
   *
   * Future expansion:
   * - Chemical reactions (interaction with other propagation types)
   */
  private canSpreadTo(cell: LinkedCell, config: PropagationConfig, context: GameContext): boolean {
    // Check if floor effects layer is already consumed (has ash)
    const floorEffectsValue = cell.getValue(GameLayers.FLOOR_EFFECTS);
    if (floorEffectsValue !== undefined) {
      const floorEffectsEntity = context.spatial.getEntityData(floorEffectsValue);
      if (floorEffectsEntity && isAsh(floorEffectsEntity)) {
        return false; // Cannot spread to consumed cells (ash)
      }
    }

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
    this.currentTick = 0;
  }

  /**
   * Get debug state for troubleshooting.
   * Useful for understanding system state during development.
   */
  public getDebugState() {
    return {
      currentTick: this.currentTick,
      spreadStateSize: this.spreadState.size,
      spreadSources: Array.from(this.spreadState.entries()).map(([id, state]) => ({
        entityId: id,
        lastSpreadTick: state.lastSpreadTick,
        origin: { x: state.originX, y: state.originY },
      })),
      propagatedCount: this.propagatedEntities.size,
      propagatedEntities: Array.from(this.propagatedEntities.entries()).map(([id, meta]) => ({
        entityId: id,
        sourceId: meta.sourceId,
        distance: meta.distance,
        spawnTick: meta.spawnTick,
      })),
    };
  }
}
