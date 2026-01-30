import type { GameSystem, GameContext, Position, EntityData } from '../types';
import type { GameManager } from '../game-manager';
import { GameLayers } from '../layers/types';
import { hasFloorEffect, hasHealth, hasDensity } from '../entities/trait-guards';

/**
 * Entity timing state tracked by FloorEffectSystem.
 * This is system-owned state (not serialized in entity data).
 */
interface EntityTimingState {
  lastDamageTime?: number; // Last time damage was applied
  lastHealTime?: number; // Last time healing was applied
}

/**
 * Entity with health properties for floor effects
 */
interface EntityWithHealth extends EntityData {
  hp: number;
  maxHp: number;
}

/**
 * Floor effect data with trigger configuration
 */
interface FloorEffectData extends EntityData {
  effectType?: 'damage' | 'heal' | 'slide' | 'slow';
  triggerMode?: 'on-entry' | 'continuous';
  damage?: number;
  healRate?: number;
  cadence?: number;
  cooldown?: number;
}

/**
 * FloorEffectSystem - Handles floor hazards and effects.
 *
 * Manages floor entities with gameplay effects using data-driven trigger modes:
 * - Damage: Deals damage over time (lava, acid, spikes) - continuous
 * - Heal: Restores health over time (medbay pads) - continuous
 * - Slide: Entity continues moving one cell in same direction (ice) - on-entry
 * - Slow: Cancels ONE move per cell entry (mud) - on-entry
 *
 * Trigger modes:
 * - 'on-entry': Effect triggers once per cell entry, tracked per entity/cell/effect
 * - 'continuous': Effect triggers repeatedly based on cadence
 *
 * @example
 * ```typescript
 * const floorSystem = new FloorEffectSystem(gameManager);
 * gameLoop.addSystem(floorSystem);
 * ```
 */
export class FloorEffectSystem implements GameSystem {
  // System-owned timing state per entity (damage/heal cadence)
  private timingState = new Map<number, EntityTimingState>();

  // Position tracking to detect movement onto floor effects
  private previousPositions = new Map<number, Position>();

  // Track which on-entry effects have been triggered
  // Map structure: effectType -> Set of "entityId:x:y" keys
  private effectTriggers = new Map<string, Set<string>>();

  // Current tick count for poison status tracking
  private currentTick = 0;

  constructor(private gameManager: GameManager) {}

  /**
   * Get trigger mode for a floor effect, inferring from effectType if not explicitly set.
   * This provides backward compatibility with entities that don't specify triggerMode.
   */
  private getTriggerMode(floorData: FloorEffectData): 'on-entry' | 'continuous' {
    if (floorData.triggerMode) {
      return floorData.triggerMode;
    }

    // Infer from effectType for backward compatibility
    switch (floorData.effectType) {
      case 'damage':
      case 'heal':
        return 'continuous';
      case 'slide':
      case 'slow':
        return 'on-entry';
      default:
        return 'continuous'; // Default fallback
    }
  }

  /**
   * Check if an on-entry effect has already triggered for an entity at a specific cell.
   */
  private hasTriggered(
    effectType: string,
    entityId: number,
    x: number,
    y: number
  ): boolean {
    const key = `${entityId}:${x}:${y}`;
    return this.effectTriggers.get(effectType)?.has(key) ?? false;
  }

  /**
   * Mark an on-entry effect as triggered for an entity at a specific cell.
   */
  private markTriggered(
    effectType: string,
    entityId: number,
    x: number,
    y: number
  ): void {
    if (!this.effectTriggers.has(effectType)) {
      this.effectTriggers.set(effectType, new Set());
    }
    const key = `${entityId}:${x}:${y}`;
    this.effectTriggers.get(effectType)!.add(key);
  }

  /**
   * Clear the trigger state for an entity at a specific cell.
   */
  private clearTrigger(
    effectType: string,
    entityId: number,
    x: number,
    y: number
  ): void {
    const key = `${entityId}:${x}:${y}`;
    this.effectTriggers.get(effectType)?.delete(key);
  }

  /**
   * Update called by GameLoop each tick.
   *
   * Processing phases:
   * 0. Process poison status effects (lingering poison damage)
   * 1. Process on-entry effects (slide, slow) - triggers once per cell entry
   * 2. Process continuous effects (damage, heal) - triggers based on cadence
   * 3. Update position tracking and clean up effect triggers
   */
  update(context: GameContext): void {
    this.currentTick++;

    // Phase 1: Process on-entry effects
    this.processOnEntryEffects(context);

    // Phase 2: Process continuous effects (damage, heal) using tick count
    this.processContinuousEffects(context, this.currentTick);

    // Phase 3: Update position tracking
    this.updatePositionTracking(context);
  }

  /**
   * Phase 2: Process continuous effects (damage, heal).
   *
   * These effects trigger repeatedly based on cadence timing.
   * Checks both FLOOR and EPHEMERALS layers for effects.
   */
  private processContinuousEffects(context: GameContext, currentTick: number): void {
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasHealth(entityData)) continue;

      // Get cell at entity position
      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      // Check FLOOR, FLOOR_EFFECTS, and EPHEMERALS layers for floor effects
      const layersToCheck = [GameLayers.FLOOR, GameLayers.FLOOR_EFFECTS, GameLayers.EPHEMERALS];

      for (const layer of layersToCheck) {
        const floorEntityId = cell.getValue(layer);
        if (!floorEntityId) continue;

        const floorData = context.spatial.getEntityData(floorEntityId);
        if (!floorData || !hasFloorEffect(floorData)) continue;

        // Only process continuous effects
        if (this.getTriggerMode(floorData) !== 'continuous') continue;

        // Apply effect based on type
        switch (floorData.effectType) {
          case 'damage':
            this.applyDamage(entityData, floorData, currentTick, context);
            break;
          case 'heal':
            this.applyHealing(entityData, floorData, currentTick, context);
            break;
        }
      }
    }
  }

  /**
   * Phase 1: Process on-entry effects (slide, slow).
   *
   * These effects trigger once per cell entry using the effectTriggers tracking.
   * The trigger state is cleared when the entity moves to a different cell.
   * Checks both FLOOR and EPHEMERALS layers for effects.
   */
  private processOnEntryEffects(context: GameContext): void {
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      // Get cell at current position
      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      // Check FLOOR, FLOOR_EFFECTS, and EPHEMERALS layers for floor effects
      const layersToCheck = [GameLayers.FLOOR, GameLayers.FLOOR_EFFECTS, GameLayers.EPHEMERALS];

      for (const layer of layersToCheck) {
        const floorEntityId = cell.getValue(layer);
        if (!floorEntityId) continue;

        const floorData = context.spatial.getEntityData(floorEntityId);
        if (!floorData || !hasFloorEffect(floorData)) continue;

        // Only process on-entry effects
        if (this.getTriggerMode(floorData) !== 'on-entry') continue;

        // Check if already triggered for this cell
        if (this.hasTriggered(floorData.effectType, entityId, pos.x, pos.y)) {
          continue; // Already triggered once for this cell
        }

        // Dispatch to effect handler
        switch (floorData.effectType) {
          case 'slide':
            this.processSlideEffect(entityId, pos, context);
            break;
          case 'slow':
            this.processSlowEffect(entityId, context);
            break;
        }

        // Mark as triggered
        this.markTriggered(floorData.effectType, entityId, pos.x, pos.y);
      }
    }
  }

  /**
   * Process slide effect: stage continuation move if entity moved this tick.
   *
   * Used by ice tiles - entity continues moving one cell in same direction.
   */
  private processSlideEffect(
    entityId: number,
    pos: Position,
    context: GameContext
  ): void {
    // Did entity move this tick?
    const prevPos = this.previousPositions.get(entityId);
    if (!prevPos || (prevPos.x === pos.x && prevPos.y === pos.y)) {
      return; // Entity didn't move this tick
    }

    // Calculate movement direction
    const dx = pos.x - prevPos.x;
    const dy = pos.y - prevPos.y;

    // Stage ONE continuation move in same direction
    const nextX = pos.x + dx;
    const nextY = pos.y + dy;

    // Check bounds
    const grid = context.spatial.grid;
    if (nextX < 0 || nextX >= grid.width || nextY < 0 || nextY >= grid.height) {
      return; // Out of bounds
    }

    const nextCell = grid.cell(nextX, nextY);
    if (!nextCell || context.spatial.isBlocked(nextCell)) {
      return; // Blocked
    }

    // Stage the continuation move
    context.spatial.move(entityId, nextX, nextY);
  }

  /**
   * Process slow effect: cancel pending move.
   *
   * Used by mud tiles - cancels one move per cell entry.
   * The trigger tracking ensures this only happens once per entry.
   */
  private processSlowEffect(entityId: number, context: GameContext): void {
    // Cancel any pending move for this entity
    context.spatial.cancelMove(entityId);
  }

  /**
   * Phase 3: Update position tracking and clean up effect triggers.
   *
   * Clears on-entry effect triggers when entities move to different cells,
   * allowing effects to trigger again when re-entering a cell.
   */
  private updatePositionTracking(context: GameContext): void {
    const currentEntities = new Set<number>();

    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      currentEntities.add(entityId);
      const prevPos = this.previousPositions.get(entityId);

      // If entity moved to a different cell, clear all effect triggers for old position
      if (prevPos && (prevPos.x !== pos.x || prevPos.y !== pos.y)) {
        for (const [effectType] of this.effectTriggers.entries()) {
          this.clearTrigger(effectType, entityId, prevPos.x, prevPos.y);
        }
      }
    }

    // Clean up triggers for entities that no longer exist
    for (const [, triggers] of this.effectTriggers.entries()) {
      for (const key of triggers) {
        const entityId = parseInt(key.split(':')[0]);
        if (!currentEntities.has(entityId)) {
          triggers.delete(key);
        }
      }
    }

    // Update position tracking
    this.previousPositions.clear();
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      this.previousPositions.set(entityId, { x: pos.x, y: pos.y });
    }
  }

  /**
   * Apply damage effect to entity.
   *
   * Checks cadence and applies damage if enough time has passed.
   */
  private applyDamage(
    entityData: EntityWithHealth,
    floorData: FloorEffectData,
    currentTick: number,
    context: GameContext
  ): void {
    if (!floorData.damage || !floorData.cadence) return;

    // Get or create timing state
    const state = this.getTimingState(entityData.id);

    // Check if enough time has passed since last damage
    if (state.lastDamageTime) {
      const elapsed = currentTick - state.lastDamageTime;
      if (elapsed < floorData.cadence) {
        return; // Not time yet
      }
    }

    // Calculate effective damage (scale by density if present)
    let effectiveDamage = floorData.damage;
    if (hasDensity(floorData)) {
      const densityMultiplier = Math.max(0.1, floorData.density / 100);
      effectiveDamage *= densityMultiplier;
    }

    // Apply damage
    const newHp = Math.max(0, entityData.hp - effectiveDamage);
    this.gameManager.gameState.entityStore.setData(entityData.id, {
      hp: newHp,
    });

    // Update timing state
    state.lastDamageTime = currentTick;

    // Remove entity if dead
    if (newHp <= 0) {
      context.spatial.remove(entityData.id);
    }
  }

  /**
   * Apply healing effect to entity.
   *
   * Checks cadence and cooldown, applies healing if conditions met.
   */
  private applyHealing(
    entityData: EntityWithHealth,
    floorData: FloorEffectData,
    currentTick: number,
    _context: GameContext
  ): void {
    if (!floorData.healRate || !floorData.cadence) return;

    // Can't heal if already at max HP
    if (entityData.hp >= entityData.maxHp) return;

    // Get or create timing state
    const state = this.getTimingState(entityData.id);

    // Check cooldown
    if (state.lastHealTime && floorData.cooldown) {
      const elapsed = currentTick - state.lastHealTime;
      if (elapsed < floorData.cooldown) {
        return; // Still on cooldown
      }
    }

    // Check cadence
    if (state.lastHealTime) {
      const elapsed = currentTick - state.lastHealTime;
      if (elapsed < floorData.cadence) {
        return; // Not time yet
      }
    }

    // Apply healing
    const newHp = Math.min(
      entityData.maxHp,
      entityData.hp + floorData.healRate
    );
    this.gameManager.gameState.entityStore.setData(entityData.id, {
      hp: newHp,
    });

    // Update timing state
    state.lastHealTime = currentTick;
  }

  /**
   * Get or create timing state for an entity.
   */
  private getTimingState(entityId: number): EntityTimingState {
    let state = this.timingState.get(entityId);
    if (!state) {
      state = {};
      this.timingState.set(entityId, state);
    }
    return state;
  }

  /**
   * Clean up timing state for removed entities.
   * Call this periodically or when entities are destroyed.
   */
  public cleanupTimingState(entityId: number): void {
    this.timingState.delete(entityId);
  }

  /**
   * Reset all timing state and effect triggers.
   * Useful for testing or scene transitions.
   */
  public resetTimingState(): void {
    this.timingState.clear();
    this.previousPositions.clear();
    this.effectTriggers.clear();
  }

  /**
   * Get debug state for troubleshooting.
   * Useful for understanding system state during development.
   */
  public getDebugState() {
    return {
      timingStateSize: this.timingState.size,
      trackedEntities: Array.from(this.timingState.entries()).map(
        ([id, state]) => ({
          entityId: id,
          lastDamageTime: state.lastDamageTime,
          lastHealTime: state.lastHealTime,
        })
      ),
      previousPositionsSize: this.previousPositions.size,
      previousPositions: Array.from(this.previousPositions.entries()).map(
        ([id, pos]) => ({
          entityId: id,
          position: pos,
        })
      ),
      effectTriggersSize: this.effectTriggers.size,
      effectTriggers: Array.from(this.effectTriggers.entries()).map(
        ([type, keys]) => ({
          effectType: type,
          triggeredCount: keys.size,
          triggers: Array.from(keys),
        })
      ),
    };
  }
}
