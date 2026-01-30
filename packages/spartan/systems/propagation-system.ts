import type { GameSystem, GameContext, Position, EntityData } from '../types';
import { Direction } from '../../grid/direction';
import type { LinkedCell } from '../../grid/linked-cell';
import { hasPropagation, hasFlammability, isFire, isAsh } from '../entities/trait-guards';
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
 * - Fire: Probabilistically spreads through flammable materials
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
 * // Spawn fire that spreads probabilistically
 * spatial.spawn('fire', 10, 10, GameLayers.FLOOR_EFFECTS, {
 *   propagationType: 'fire',
 *   spreadRate: 2,              // Spread every 2 ticks
 *   spreadProbability: 0.6,     // 60% chance per neighbor
 *   spreadLayer: GameLayers.FLOOR_EFFECTS,
 *   spreadType: 'fire',
 *   // No maxDistance - fire spread is naturally limited by flammable materials
 *   lifetime: 20,               // Burns for 20 ticks
 *   blockedByLayers: [GameLayers.WALLS]
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

  // Queue of positions where ash should be spawned (deferred to next tick after fire removal)
  private ashSpawnQueue: Position[] = [];

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

    // Phase 0: Spawn ash from previous tick's expired fire
    for (const pos of this.ashSpawnQueue) {
      context.spatial.spawn('ash', pos.x, pos.y, GameLayers.FLOOR_EFFECTS, {
        color: '#4a4a4a',
      });
    }
    // Clear queue after spawning (before canSpreadTo checks in Phase 2)
    this.ashSpawnQueue = [];

    // Phase 1: Identify spread sources
    const sources = this.identifySpreadSources(context);

    // Phase 2: Propagate from sources
    this.propagateFromSources(context, sources);

    // Phase 3: Update spread state (already updated in phase 2)
    // (State is updated as we propagate for efficiency)

    // Phase 4: Clean up expired effects (may add new items to ashSpawnQueue for next tick)
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

        // Calculate effective probability (modified by target flammability for fire)
        let effectiveProbability = probability;
        
        // For fire, multiply by target's flammability
        // Check multiple layers for flammable targets
        if (sourceData.propagationType === 'fire') {
          const layersToCheck = [GameLayers.FLOOR, GameLayers.COLLECTIBLES];
          for (const layer of layersToCheck) {
            const targetValue = neighbor.getValue(layer);
            if (targetValue !== undefined) {
              const targetEntity = context.spatial.getEntityData(targetValue);
              if (targetEntity && hasFlammability(targetEntity)) {
                effectiveProbability *= targetEntity.flammability;
                break; // Use first flammable entity found
              }
            }
          }
        }
        
        // Probability check: roll for each neighbor independently
        if (Math.random() > effectiveProbability) {
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

        // Check if already occupied by fire entity from this source on spreadLayer
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

        // For fire propagation, consume flammable target entities on FLOOR and COLLECTIBLES
        if (sourceData.propagationType === 'fire') {
          const layersToConsume = [GameLayers.FLOOR, GameLayers.COLLECTIBLES];
          for (const layer of layersToConsume) {
            const targetEntityId = context.spatial.getEntityIdAt(neighbor.x, neighbor.y, layer);
            if (targetEntityId !== undefined) {
              const targetEntity = context.spatial.getEntityData(targetEntityId);
              if (targetEntity && hasFlammability(targetEntity)) {
                context.spatial.remove(targetEntityId);
              }
            }
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
        this.propagatedEntities.set(newEntityId, {
          sourceId,
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
   * For fire, spawns ash in its place to mark consumed cells.
   * Cleans up tracking state for removed entities.
   */
  private cleanupExpiredEffects(context: GameContext): void {
    const entitiesToRemove: Array<{id: number, pos: Position, wasFire: boolean}> = [];

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
        // Save whether this was fire BEFORE removing
        const wasFire = isFire(entityData);
        entitiesToRemove.push({id: entityId, pos, wasFire});
      }
    }

    // Remove expired entities and queue ash spawning for next tick
    for (const {id, pos, wasFire} of entitiesToRemove) {
      context.spatial.remove(id);
      
      // If this was fire, queue ash to be spawned next tick (after removal is committed)
      if (wasFire) {
        this.ashSpawnQueue.push(pos);
      }
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

    // Fire-specific flammability check
    if (config.propagationType === 'fire') {
      // Fire only spreads to cells with flammable entities
      // Check multiple layers: FLOOR (grass) and COLLECTIBLES (gasoline, barrels)
      let hasFlammableTarget = false;
      
      const layersToCheck = [GameLayers.FLOOR, GameLayers.COLLECTIBLES];
      for (const layer of layersToCheck) {
        const targetValue = cell.getValue(layer);
        if (targetValue !== undefined) {
          const targetEntity = context.spatial.getEntityData(targetValue);
          if (targetEntity && hasFlammability(targetEntity)) {
            hasFlammableTarget = true;
            break;
          }
        }
      }
      
      // If no flammable entity on checked layers, fire cannot spread
      if (!hasFlammableTarget) {
        return false;
      }
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
    this.ashSpawnQueue = [];
  }

  /**
   * Get debug state for troubleshooting.
   * Useful for understanding system state during development.
   */
  public getDebugState() {
    return {
      currentTick: this.currentTick,
      ashQueueSize: this.ashSpawnQueue.length,
      ashQueue: [...this.ashSpawnQueue],
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
