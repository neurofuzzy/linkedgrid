import type { GameSystem, GameContext, Position } from '../types.js';
import type { GameManager } from '../game-manager.js';
import { GameLayers } from '../layers/types.js';
import { 
  hasFloorEffect, 
  hasHealth
} from '../entities/trait-guards.js';

/**
 * Entity timing state tracked by FloorEffectSystem.
 * This is system-owned state (not serialized in entity data).
 */
interface EntityTimingState {
  lastDamageTime?: number;  // Last time damage was applied
  lastHealTime?: number;    // Last time healing was applied
}

/**
 * FloorEffectSystem - Handles floor hazards and effects.
 *
 * Manages floor entities with gameplay effects:
 * - Damage: Deals damage over time (lava, acid, spikes)
 * - Heal: Restores health over time (medbay pads)
 * - Slide: Entity continues moving one cell in same direction (ice)
 * - Slow: Cancels entity movement (mud)
 *
 * Ice and mud are simple per-tick behaviors:
 * - Ice: If entity moved onto ice this tick, stage ONE continuation move
 * - Mud: If entity is on mud, cancel any pending move
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

  constructor(private gameManager: GameManager) {}

  /**
   * Update called by GameLoop each tick.
   *
   * Processing phases:
   * 1. Process ice - stage continuation moves (based on movement from LAST tick)
   * 2. Process mud - cancel pending moves
   * 3. Apply damage/healing to entities on floor hazards
   * 4. Update position tracking for next tick
   */
  update(context: GameContext): void {
    const now = Date.now();

    // Phase 1: Process ice and mud effects (before new moves are committed)
    this.processIceAndMud(context);

    // Phase 2: Apply damage/healing to entities on floor hazards
    this.applyDamageAndHealing(context, now);

    // Phase 3: Update position tracking for next tick
    this.updatePositionTracking(context);
  }

  /**
   * Phase 1: Apply damage/healing effects.
   */
  private applyDamageAndHealing(context: GameContext, now: number): void {
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasHealth(entityData)) continue;

      // Get floor entity at this position
      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      const floorEntityId = cell.getValue(GameLayers.FLOOR);
      if (!floorEntityId) continue;

      const floorData = context.spatial.getEntityData(floorEntityId);
      if (!floorData || !hasFloorEffect(floorData)) continue;

      // Apply effect based on type
      switch (floorData.effectType) {
        case 'damage':
          this.applyDamage(entityData, floorData, now, context);
          break;
        case 'heal':
          this.applyHealing(entityData, floorData, now, context);
          break;
      }
    }
  }

  /**
   * Phase 2: Process ice and mud effects.
   * 
   * Ice: If entity moved this tick and is now on ice, stage ONE continuation move
   * Mud: If entity is on mud, cancel any pending move
   */
  private processIceAndMud(context: GameContext): void {
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      // Get floor at current position
      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      const floorEntityId = cell.getValue(GameLayers.FLOOR);
      if (!floorEntityId) continue;

      const floorData = context.spatial.getEntityData(floorEntityId);
      if (!floorData || !hasFloorEffect(floorData)) continue;

      switch (floorData.effectType) {
        case 'slide':
          this.processIce(entityId, pos, context);
          break;
        case 'slow':
          this.processMud(entityId, context);
          break;
      }
    }
  }

  /**
   * Process ice effect: stage continuation move if entity moved this tick.
   */
  private processIce(entityId: number, pos: Position, context: GameContext): void {
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
   * Process mud effect: cancel any pending move for this entity.
   */
  private processMud(entityId: number, context: GameContext): void {
    // Cancel any pending move for this entity
    context.spatial.cancelMove(entityId);
  }

  /**
   * Phase 3: Update position tracking for next tick.
   */
  private updatePositionTracking(context: GameContext): void {
    // Clear old positions
    this.previousPositions.clear();

    // Store current positions
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
    entityData: any,
    floorData: any,
    now: number,
    context: GameContext
  ): void {
    if (!floorData.damage || !floorData.cadence) return;

    // Get or create timing state
    const state = this.getTimingState(entityData.id);

    // Check if enough time has passed since last damage
    if (state.lastDamageTime) {
      const elapsed = now - state.lastDamageTime;
      if (elapsed < floorData.cadence) {
        return; // Not time yet
      }
    }

    // Apply damage
    const newHp = Math.max(0, entityData.hp - floorData.damage);
    this.gameManager.gameState.entityStore.setData(entityData.id, {
      hp: newHp,
    });

    // Update timing state
    state.lastDamageTime = now;

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
    entityData: any,
    floorData: any,
    now: number,
    context: GameContext
  ): void {
    if (!floorData.healRate || !floorData.cadence) return;

    // Can't heal if already at max HP
    if (entityData.hp >= entityData.maxHp) return;

    // Get or create timing state
    const state = this.getTimingState(entityData.id);

    // Check cooldown
    if (state.lastHealTime && floorData.cooldown) {
      const elapsed = now - state.lastHealTime;
      if (elapsed < floorData.cooldown) {
        return; // Still on cooldown
      }
    }

    // Check cadence
    if (state.lastHealTime) {
      const elapsed = now - state.lastHealTime;
      if (elapsed < floorData.cadence) {
        return; // Not time yet
      }
    }

    // Apply healing
    const newHp = Math.min(entityData.maxHp, entityData.hp + floorData.healRate);
    this.gameManager.gameState.entityStore.setData(entityData.id, {
      hp: newHp,
    });

    // Update timing state
    state.lastHealTime = now;
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
   * Reset all timing state.
   * Useful for testing or scene transitions.
   */
  public resetTimingState(): void {
    this.timingState.clear();
    this.previousPositions.clear();
  }
}
