/**
 * @brief NPC Movement System - Handles autonomous movement for NPCs.
 */
import { BaseTickedSystem } from '../core/base-system';
import { SYSTEM_CONFIG } from '../config/systems.config';
import type { GameContext } from '../core/types';
import { hasNPCMovement } from '../traits/trait-guards';
import { LinkedCellUtils } from '../core/grid/linked-cell-utils';
import { LinkedCell } from '../core/grid/linked-cell';
import { Direction } from '../core/grid/direction';

/**
 * NPCMovementSystem - Manages autonomous NPC movement behaviors.
 *
 * Supports four movement modes:
 * - **follow**: Maintain distance range from target (approach when far, retreat when close)
 * - **flee**: Run away from target when it gets too close
 * - **pursue**: Chase target when within trigger range, give up when too far
 * - **wander**: Move randomly to adjacent walkable cells
 *
 * Uses BFS pathfinding via LinkedCellUtils.findPath() for pursue and follow modes.
 * Uses greedy direction selection for flee mode.
 * Uses random direction for wander mode.
 *
 * @system
 * @reactsTo Entities with HasNPCMovement trait
 * @modifies Entity position via spatial.moveEntity()
 *
 * @example
 * ```typescript
 * const npcMovementSystem = new NPCMovementSystem();
 * gameLoop.addSystem(npcMovementSystem);
 * ```
 */
export class NPCMovementSystem extends BaseTickedSystem {
  protected tickRate = SYSTEM_CONFIG.NPCMovement.tickRate;

  protected onTick(context: GameContext): void {
    // Get player entity ID from game state for NPCs that target player
    const playerEntityId = context.gameManager?.gameState?.playerEntityId;

    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasNPCMovement(entityData)) continue;

      // Resolve target: use explicit targetEntityId or fall back to player
      const resolvedTargetId = entityData.targetEntityId ?? playerEntityId;

      switch (entityData.movementMode) {
        case 'follow':
          this.processFollow(context, entityId, entityData, resolvedTargetId);
          break;
        case 'flee':
          this.processFlee(context, entityId, entityData, resolvedTargetId);
          break;
        case 'pursue':
          this.processPursue(context, entityId, entityData, resolvedTargetId);
          break;
        case 'wander':
          this.processWander(context, entityId);
          break;
      }
    }
  }

  /**
   * Follow mode: maintain distance range from target.
   * Approach when too far (> maxDistance), retreat when too close (< minDistance).
   */
  private processFollow(
    context: GameContext,
    entityId: number,
    entityData: ReturnType<typeof context.spatial.getEntityData> & { targetEntityId?: number; minDistance?: number; maxDistance?: number; pathfindingRange?: number },
    targetEntityId: number | undefined
  ): void {
    if (targetEntityId === undefined) return;

    const npcPos = context.spatial.getEntityPosition(entityId);
    const targetPos = context.spatial.getEntityPosition(targetEntityId);
    if (!npcPos || !targetPos) return;

    const distance = this.manhattanDistance(npcPos.x, npcPos.y, targetPos.x, targetPos.y);
    const minDistance = entityData.minDistance ?? 1;
    const maxDistance = entityData.maxDistance ?? 3;

    if (distance < minDistance) {
      // Too close - move away
      const awayPos = this.findDirectionAwayFrom(context, npcPos.x, npcPos.y, targetPos.x, targetPos.y);
      if (awayPos) {
        context.spatial.move(entityId, awayPos.x, awayPos.y);
      }
    } else if (distance > maxDistance) {
      // Too far - move toward using pathfinding
      const nextStep = this.findNextStepToward(context, npcPos, targetPos, entityData.pathfindingRange ?? 20);
      if (nextStep) {
        context.spatial.move(entityId, nextStep.x, nextStep.y);
      }
    }
    // else: in range, don't move
  }

  /**
   * Flee mode: run away from target when too close.
   * State machine: idle (calm) when far, active (fleeing) when close.
   */
  private processFlee(
    context: GameContext,
    entityId: number,
    entityData: ReturnType<typeof context.spatial.getEntityData> & { targetEntityId?: number; panicDistance?: number; safeDistance?: number; aiMovementState?: 'idle' | 'active' },
    targetEntityId: number | undefined
  ): void {
    if (targetEntityId === undefined) return;

    const npcPos = context.spatial.getEntityPosition(entityId);
    const targetPos = context.spatial.getEntityPosition(targetEntityId);
    if (!npcPos || !targetPos) return;

    const distance = this.manhattanDistance(npcPos.x, npcPos.y, targetPos.x, targetPos.y);
    const panicDistance = entityData.panicDistance ?? 3;
    const safeDistance = entityData.safeDistance ?? 7;

    // State machine
    if (entityData.aiMovementState !== 'active') {
      // Idle state - check if should start fleeing
      if (distance <= panicDistance) {
        entityData.aiMovementState = 'active';
      }
    }

    if (entityData.aiMovementState === 'active') {
      // Fleeing state
      if (distance >= safeDistance) {
        // Safe now, return to idle
        entityData.aiMovementState = 'idle';
      } else {
        // Continue fleeing - move away from target
        const awayPos = this.findDirectionAwayFrom(context, npcPos.x, npcPos.y, targetPos.x, targetPos.y);
        if (awayPos) {
          context.spatial.move(entityId, awayPos.x, awayPos.y);
        }
      }
    }
  }

  /**
   * Pursue mode: chase target when in range, give up when too far.
   * State machine: idle when out of range, active when chasing.
   */
  private processPursue(
    context: GameContext,
    entityId: number,
    entityData: ReturnType<typeof context.spatial.getEntityData> & { targetEntityId?: number; triggerRange?: number; giveUpRange?: number; pathfindingRange?: number; aiMovementState?: 'idle' | 'active' },
    targetEntityId: number | undefined
  ): void {
    if (targetEntityId === undefined) return;

    const npcPos = context.spatial.getEntityPosition(entityId);
    const targetPos = context.spatial.getEntityPosition(targetEntityId);
    if (!npcPos || !targetPos) return;

    const distance = this.manhattanDistance(npcPos.x, npcPos.y, targetPos.x, targetPos.y);
    const triggerRange = entityData.triggerRange ?? 8;
    const giveUpRange = entityData.giveUpRange ?? 15;

    // State machine
    if (entityData.aiMovementState !== 'active') {
      // Idle state - check if should start pursuing
      if (distance <= triggerRange) {
        entityData.aiMovementState = 'active';
      }
    }

    if (entityData.aiMovementState === 'active') {
      // Chasing state
      if (distance > giveUpRange) {
        // Target too far, give up
        entityData.aiMovementState = 'idle';
      } else if (distance <= 1) {
        // Caught the target - stay adjacent
        // (system doesn't handle catch events, just movement)
      } else {
        // Continue chasing - pathfind toward target
        const nextStep = this.findNextStepToward(context, npcPos, targetPos, entityData.pathfindingRange ?? 20);
        if (nextStep) {
          context.spatial.move(entityId, nextStep.x, nextStep.y);
        }
      }
    }
  }

  /**
   * Wander mode: move randomly to adjacent walkable cells.
   */
  private processWander(context: GameContext, entityId: number): void {
    const npcPos = context.spatial.getEntityPosition(entityId);
    if (!npcPos) return;

    const cell = context.spatial.grid.cell(npcPos.x, npcPos.y);
    if (!cell) return;

    // Get all walkable neighbors (not blocked)
    const walkableNeighbors: LinkedCell[] = [];
    for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
      const neighbor = cell.neighbor(dir);
      if (neighbor && !context.spatial.isBlocked(neighbor)) {
        walkableNeighbors.push(neighbor);
      }
    }

    if (walkableNeighbors.length === 0) return;

    // Pick a random neighbor
    const randomIndex = Math.floor(Math.random() * walkableNeighbors.length);
    const target = walkableNeighbors[randomIndex];
    context.spatial.move(entityId, target.x, target.y);
  }

  // ========== Helper Functions ==========

  /**
   * Calculate Manhattan distance between two points.
   */
  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  /**
   * Find the next step toward a target using BFS pathfinding.
   */
  private findNextStepToward(
    context: GameContext,
    fromPos: { x: number; y: number },
    toPos: { x: number; y: number },
    maxRange: number
  ): { x: number; y: number } | null {
    const fromCell = context.spatial.grid.cell(fromPos.x, fromPos.y);
    const toCell = context.spatial.grid.cell(toPos.x, toPos.y);
    if (!fromCell || !toCell) return null;

    const path = LinkedCellUtils.findPath(
      fromCell,
      (c) => c !== null && !context.spatial.isBlocked(c),
      (c) => c === toCell,
      maxRange
    );

    if (path.length > 0) {
      return { x: path[0].x, y: path[0].y };
    }

    return null;
  }

  /**
   * Find a walkable cell that moves away from the target.
   * Picks the cardinal direction that maximizes distance from target.
   */
  private findDirectionAwayFrom(
    context: GameContext,
    x: number,
    y: number,
    targetX: number,
    targetY: number
  ): { x: number; y: number } | null {
    const cell = context.spatial.grid.cell(x, y);
    if (!cell) return null;

    let bestPos: { x: number; y: number } | null = null;
    let bestDistance = this.manhattanDistance(x, y, targetX, targetY);

    for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
      const neighbor = cell.neighbor(dir);
      if (!neighbor || context.spatial.isBlocked(neighbor)) continue;

      const dist = this.manhattanDistance(neighbor.x, neighbor.y, targetX, targetY);
      if (dist > bestDistance) {
        bestDistance = dist;
        bestPos = { x: neighbor.x, y: neighbor.y };
      }
    }

    return bestPos;
  }

  public override resetState(): void {
    super.resetState();
    // No internal state to reset - state is stored in entity traits
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      description: 'NPC Movement System (follow, flee, pursue, wander)',
    };
  }
}
