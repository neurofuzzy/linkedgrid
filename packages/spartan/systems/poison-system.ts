import type { GameSystem, GameContext, Position, EntityData } from '../types';
import { Direction } from '../../grid/direction';
import type { LinkedCell } from '../../grid/linked-cell';
import { hasPropagation, hasDensity, hasHealth, hasFloorEffect } from '../entities/trait-guards';
import { GameLayers } from '../layers/types';
import type { GameManager } from '../game-manager';

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
 * Poison propagation configuration from entity data.
 */
interface PoisonConfig extends EntityData {
  propagationType?: string;
  spreadLayer: number;
  blockedByLayers?: number[];
  density: number;
  minDensity: number;
}

/**
 * Poison status effect for entities.
 * Applied when entering poison gas, persists after leaving.
 */
interface PoisonStatus {
  damage: number; // Damage per tick
  ticksRemaining: number; // Ticks until poison expires
  tickInterval: number; // Ticks between damage applications
  lastDamageTick: number; // Last tick when damage was applied
}

/**
 * PoisonSystem - Handles spreading of poison gas via density dispersion.
 *
 * Manages entities with propagationType='gas' and HasDensity trait.
 * Simulates volumetric expansion: a gas cloud splits its density evenly
 * among itself and available adjacent cells.
 *
 * Mechanics:
 * - Density: Concentration of gas (0-100).
 * - Dispersion: Source splits density with empty neighbors: new = current / (1 + neighbors).
 * - Threshold: Spreading stops if resulting density would be < minDensity.
 * - Dissipation: Entities with density < minDensity are removed.
 *
 * Timing is tick-based (not ms-based) for deterministic behavior.
 */
export class PoisonSystem implements GameSystem {
  // System-owned state per source entity (timing and origin position)
  private spreadState = new Map<number, SpreadState>();

  // System-owned state per propagated entity (source, distance, spawn tick)
  private propagatedEntities = new Map<number, PropagatedEntity>();

  // Track current tick for timing
  private currentTick = 0;

  // Track poison status effects on entities
  private poisonStatuses = new Map<number, PoisonStatus>();

  constructor(private gameManager?: GameManager) {}

  /**
   * Update called by GameLoop each tick.
   */
  update(context: GameContext): void {
    // If gameManager is not injected, try to get it from context
    if (!this.gameManager && context.gameManager) {
      this.gameManager = context.gameManager;
    }

    this.currentTick++;

    // Phase 0: Process lingering poison statuses
    this.processPoisonStatuses(context);

    // Phase 1: Clean up dissipated/expired effects
    // Do this first to clear space for new spreading
    this.cleanupExpiredEffects(context);

    // Phase 2: Identify active sources
    const sources = this.identifySpreadSources(context);

    // Phase 3: Distribute density (Spread)
    this.distributeDensity(context, sources);

    // Phase 4: Apply poison damage
    this.applyPoisonDamage(context);
  }

  /**
   * Process poison status effects on all entities.
   *
   * Poison applies damage over time and expires after a duration.
   * This runs independently of whether the entity is still in poison gas.
   */
  private processPoisonStatuses(context: GameContext): void {
    if (!this.gameManager) return;

    const toRemove: number[] = [];

    for (const [entityId, poison] of this.poisonStatuses.entries()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasHealth(entityData)) {
        toRemove.push(entityId);
        continue;
      }

      // Check if it's time to apply damage
      const ticksSinceLastDamage = this.currentTick - poison.lastDamageTick;
      if (ticksSinceLastDamage >= poison.tickInterval) {
        // Apply poison damage
        const newHp = Math.max(0, entityData.hp - poison.damage);
        this.gameManager.gameState.entityStore.setData(entityId, {
          hp: newHp,
        });

        poison.lastDamageTick = this.currentTick;

        // Remove entity if dead
        if (newHp <= 0) {
          context.spatial.remove(entityId);
          toRemove.push(entityId);
          continue;
        }
      }

      // Decrement remaining ticks
      poison.ticksRemaining--;
      if (poison.ticksRemaining <= 0) {
        toRemove.push(entityId);
      }
    }

    // Clean up expired poisons
    for (const entityId of toRemove) {
      this.poisonStatuses.delete(entityId);
    }
  }

  /**
   * Apply or refresh poison status effect on an entity.
   *
   * @param entityId - Entity to poison
   * @param damage - Damage per tick
   * @param duration - Duration in ticks
   * @param interval - Ticks between damage applications
   */
  private applyPoison(
    entityId: number,
    damage: number,
    duration: number,
    interval: number
  ): void {
    // Refresh poison if already poisoned (resets duration)
    // We update damage to the new value (e.g. if entering denser gas)
    this.poisonStatuses.set(entityId, {
      damage,
      ticksRemaining: duration,
      tickInterval: interval,
      lastDamageTick: this.currentTick,
    });
  }

  /**
   * Phase 4: Apply damage from poison gas to overlapping entities.
   *
   * Iterates all entities with health. Checks if they overlap with a poison gas entity.
   * Scales damage by density.
   */
  private applyPoisonDamage(context: GameContext): void {
    if (!this.gameManager) return;

    // Use efficient spatial query if available, or iterating all positions
    // Here we iterate all entities with health and check their cell for poison
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasHealth(entityData)) continue;

      // Check for poison gas on EPHEMERALS or configured spread layer
      // We check all relevant layers just in case
      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      // Check relevant layers for poison gas
      const layersToCheck = [GameLayers.EPHEMERALS, GameLayers.FLOOR_EFFECTS];
      
      for (const layer of layersToCheck) {
        const gasId = cell.getValue(layer);
        if (gasId === undefined) continue;

        const gasData = context.spatial.getEntityData(gasId);
        if (!gasData || 
            !hasPropagation(gasData) || 
            gasData.propagationType !== 'gas' ||
            !hasFloorEffect(gasData) ||
            gasData.effectType !== 'damage') {
          continue;
        }

        // Apply damage logic
        // Check cadence (we store timing on the victim entity or system map?)
        // FloorEffectSystem used a map. We should probably do similar if we want cadence.
        // For simplicity in this iteration, let's just apply damage every tick scaled by small amount, 
        // OR implement proper cadence tracking.
        // Given we are moving from FloorEffectSystem, we should support cadence.
        
        // However, adding state tracking map to PoisonSystem is cleaner than polluting entity.
        // Let's implement simple per-tick damage for now, scaled by density.
        // "Continuous" usually implies per-tick or high frequency.
        // If the gas definition has `cadence`, we should respect it.
        
        // Let's implement basic cadence tracking here.
        this.applyDamageWithCadence(entityId, entityData, gasData, context);
      }
    }
  }

  // Track last damage tick per entity
  private damageTracking = new Map<number, number>();

  private applyDamageWithCadence(
    victimId: number, 
    victimData: any, 
    gasData: any,
    context: GameContext
  ): void {
    if (!this.gameManager) return;

    const cadence = gasData.cadence || 1;
    const lastTick = this.damageTracking.get(victimId) || 0;
    
    if (this.currentTick - lastTick < cadence) return;

    // Calculate damage
    let damage = gasData.damage || 0;
    
    // Scale by density
    if (hasDensity(gasData)) {
      const densityMultiplier = Math.max(0.1, gasData.density / 100);
      damage *= densityMultiplier;
    }

    // Ensure integer damage, min 1
    if (damage > 0) {
        damage = Math.max(1, Math.round(damage));
    }

    if (damage > 0) {
      const newHp = Math.max(0, victimData.hp - damage);
      this.gameManager.gameState.entityStore.setData(victimId, { hp: newHp });
      this.damageTracking.set(victimId, this.currentTick);
      
      // Apply lingering poison status (lasts 12 ticks, dmg every 3)
      // This ensures poison persists even if entity moves out
      this.applyPoison(victimId, damage, 12, 3);

      if (newHp <= 0) {
         context.spatial.remove(victimId);
      }
    }
  }

  /**
   * Phase 1: Clean up dissipated or expired effects.
   *
   * Removes entities if:
   * - density < minDensity (dissipated)
   * - age > lifetime (expired, optional hard limit)
   */
  private cleanupExpiredEffects(context: GameContext): void {
    const entitiesToRemove: number[] = [];

    // Check ALL entities with propagation trait for expiration/dissipation
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      
      // Only process 'gas' propagation
      if (!entityData || !hasPropagation(entityData) || entityData.propagationType !== 'gas') continue;
      
      // Check dissipation (density too low)
      if (hasDensity(entityData)) {
        if (entityData.density < entityData.minDensity) {
          entitiesToRemove.push(entityId);
          continue;
        }
      }

      // Check lifetime expiration (if configured)
      if (entityData.lifetime) {
        let spawnTick = 0;
        const meta = this.propagatedEntities.get(entityId);
        if (meta) {
          spawnTick = meta.spawnTick;
        } else {
          const state = this.spreadState.get(entityId);
          spawnTick = state?.spawnTick ?? 0;
        }

        const age = this.currentTick - spawnTick;
        if (age >= entityData.lifetime) {
          entitiesToRemove.push(entityId);
        }
      }
    }

    // Remove entities
    for (const id of entitiesToRemove) {
      context.spatial.remove(id);
    }

    // Clean up tracking state
    for (const id of entitiesToRemove) {
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
   * Phase 2: Identify active spread sources.
   *
   * Finds all valid gas entities.
   */
  private identifySpreadSources(context: GameContext): Map<number, Position> {
    const sources = new Map<number, Position>();

    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      
      // Valid gas source?
      if (!entityData || 
          !hasPropagation(entityData) || 
          entityData.propagationType !== 'gas' ||
          !hasDensity(entityData)) {
        continue;
      }

      // Alive?
      if (context.spatial.isAlive(entityId) === false) continue;

      // Initialize state if needed
      if (!this.spreadState.has(entityId)) {
        const propagatedMeta = this.propagatedEntities.get(entityId);
        if (propagatedMeta) {
          const parentState = this.spreadState.get(propagatedMeta.sourceId);
          this.spreadState.set(entityId, {
            lastSpreadTick: this.currentTick,
            spawnTick: propagatedMeta.spawnTick,
            originX: parentState ? parentState.originX : pos.x,
            originY: parentState ? parentState.originY : pos.y,
          });
        } else {
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
   * Phase 3: Distribute density from sources to neighbors.
   *
   * Cellular automata-like expansion:
   * 1. Check if source is ready to spread (cadence).
   * 2. Identify available (empty) neighbors.
   * 3. Split current density among source + empty neighbors.
   * 4. If split density >= minDensity, update source and spawn neighbors.
   */
  private distributeDensity(
    context: GameContext,
    sources: Map<number, Position>
  ): void {
    for (const [sourceId, pos] of sources) {
      const sourceData = context.spatial.getEntityData(sourceId);
      
      // Guard checks (should pass from identifySpreadSources, but strict type check needed for TS)
      if (!sourceData || !hasPropagation(sourceData) || !hasDensity(sourceData)) continue;

      const state = this.spreadState.get(sourceId);
      if (!state) continue;

      // Check cadence
      const ticksElapsed = this.currentTick - state.lastSpreadTick;
      if (ticksElapsed < sourceData.spreadRate) continue;

      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      // Find available neighbors
      const availableNeighbors: LinkedCell[] = [];
      const directions = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];

      for (const dir of directions) {
        const neighbor = cell.neighbor(dir);
        if (!neighbor) continue;

        // Check if we can spread here (empty of gas, not blocked)
        if (this.canSpreadTo(neighbor, sourceData as unknown as PoisonConfig, context)) {
          // Distance check
          if (sourceData.maxDistance !== undefined) {
            const dist = this.manhattanDistance(state.originX, state.originY, neighbor.x, neighbor.y);
            if (dist > sourceData.maxDistance) continue;
          }
          availableNeighbors.push(neighbor);
        }
      }

      if (availableNeighbors.length === 0) continue;

      // Calculate new density split
      // Split evenly between source and all available neighbors
      const totalParts = 1 + availableNeighbors.length;
      const newDensity = sourceData.density / totalParts;

      // Check threshold
      if (newDensity < sourceData.minDensity) {
        // Density too low to split further - do nothing
        // (Could optionally dissipate here, but cleanup handles that if we updated it)
        continue;
      }

      // Apply changes
      
      // 1. Update source density
      sourceData.density = newDensity;

      // 2. Spawn neighbors
      const rootSourceId = this.propagatedEntities.get(sourceId)?.sourceId ?? sourceId;

      for (const neighbor of availableNeighbors) {
         const newEntityId = context.spatial.spawn(
          sourceData.spreadType,
          neighbor.x,
          neighbor.y,
          sourceData.spreadLayer,
          {
            // Propagate traits
            propagationType: sourceData.propagationType,
            spreadRate: sourceData.spreadRate,
            spreadLayer: sourceData.spreadLayer,
            spreadType: sourceData.spreadType,
            maxDistance: sourceData.maxDistance,
            lifetime: sourceData.lifetime,
            blockedByLayers: sourceData.blockedByLayers,
            
            // Density traits
            density: newDensity, // Starts with split density
            minDensity: sourceData.minDensity,
            
            // Effect traits
            ...(sourceData.effectType && {
              effectType: sourceData.effectType,
              triggerMode: sourceData.triggerMode,
              damage: sourceData.damage,
              healRate: sourceData.healRate,
              cadence: sourceData.cadence,
              cooldown: sourceData.cooldown,
            }),
            ...(sourceData.color && { color: sourceData.color }),
          }
        );

        // Track metadata
        const dist = this.manhattanDistance(state.originX, state.originY, neighbor.x, neighbor.y);
        this.propagatedEntities.set(newEntityId, {
          sourceId: rootSourceId,
          distance: dist,
          spawnTick: this.currentTick,
        });
      }

      // Update timing
      state.lastSpreadTick = this.currentTick;
    }
  }

  /**
   * Check if poison can spread to a target cell.
   *
   * Checks:
   * - Blocked layers (walls, etc.)
   * - Is cell already occupied by gas? (Check spreadLayer)
   */
  private canSpreadTo(cell: LinkedCell, config: PoisonConfig, context: GameContext): boolean {
    // Check if space is already occupied on the target layer
    // We only spread to empty cells to simulate expansion
    if (cell.getValue(config.spreadLayer) !== undefined) {
      return false;
    }

    // Check blocked layers
    if (config.blockedByLayers) {
      for (const layer of config.blockedByLayers) {
        if (cell.getValue(layer) !== undefined) {
          return false; 
        }
      }
    }

    // Check spatial blocking (walls)
    if (context.spatial.isBlocked(cell)) {
      return false;
    }

    return true;
  }

  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  public resetState(): void {
    this.spreadState.clear();
    this.propagatedEntities.clear();
    this.currentTick = 0;
  }

  public getDebugState() {
    return {
      currentTick: this.currentTick,
      spreadStateSize: this.spreadState.size,
      propagatedCount: this.propagatedEntities.size,
    };
  }
}
