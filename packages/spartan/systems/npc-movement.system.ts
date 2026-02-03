/**
 * @brief NPC Movement System - Handles autonomous movement for NPCs.
 */
import { BaseTickedSystem } from '../core/base-system';
import { SYSTEM_CONFIG } from '../config/systems.config';
import type { GameContext } from '../core/types';
import { hasNPCMovement, isPathNode } from '../traits/trait-guards';
import { LinkedCellUtils } from '../core/grid/linked-cell-utils';
import { LinkedCell } from '../core/grid/linked-cell';
import { Direction } from '../core/grid/direction';
import { GameLayers } from '../config/layers.config';

/**
 * NPCMovementSystem - Manages autonomous NPC movement behaviors.
 *
 * Supports five movement modes:
 * - **follow**: Maintain distance range from target (approach when far, retreat when close)
 * - **flee**: Run away from target when it gets too close
 * - **pursue**: Chase target when within trigger range, give up when too far
 * - **wander**: Move randomly to adjacent walkable cells
 * - **patrol**: Follow path nodes on LOGIC layer, reverse at dead-ends, PRNG at junctions
 *
 * Uses BFS pathfinding via LinkedCellUtils.findPath() for pursue and follow modes.
 * Uses greedy direction selection for flee mode.
 * Uses random direction for wander mode.
 * Uses path-node adjacency for patrol mode.
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
    const currentTick = context.tick ?? 0;

    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasNPCMovement(entityData)) continue;

      // Check speed-based cooldown
      const speed = entityData.speed ?? 1;
      const lastMoveTick = entityData.lastMoveTick ?? 0;
      if (currentTick - lastMoveTick < speed) {
        continue; // Still on cooldown
      }

      // Resolve target: use explicit targetEntityId or fall back to player
      const resolvedTargetId = entityData.targetEntityId ?? playerEntityId;

      let moved = false;
      switch (entityData.movementMode) {
        case 'follow':
          moved = this.processFollow(context, entityId, entityData, resolvedTargetId);
          break;
        case 'flee':
          moved = this.processFlee(context, entityId, entityData, resolvedTargetId);
          break;
        case 'pursue':
          moved = this.processPursue(context, entityId, entityData, resolvedTargetId);
          break;
        case 'wander':
          moved = this.processWander(context, entityId);
          break;
        case 'patrol':
          moved = this.processPatrol(context, entityId, entityData);
          break;
      }

      // Update lastMoveTick if the entity moved
      if (moved) {
        entityData.lastMoveTick = currentTick;
      }
    }
  }

  /**
   * Follow mode: maintain distance range from target.
   * Approach when too far (> maxDistance), retreat when too close (< minDistance).
   * @returns true if a movement was issued
   */
  private processFollow(
    context: GameContext,
    entityId: number,
    entityData: ReturnType<typeof context.spatial.getEntityData> & { targetEntityId?: number; minDistance?: number; maxDistance?: number; pathfindingRange?: number },
    targetEntityId: number | undefined
  ): boolean {
    if (targetEntityId === undefined) return false;

    const npcPos = context.spatial.getEntityPosition(entityId);
    const targetPos = context.spatial.getEntityPosition(targetEntityId);
    if (!npcPos || !targetPos) return false;

    const distance = this.manhattanDistance(npcPos.x, npcPos.y, targetPos.x, targetPos.y);
    const minDistance = entityData.minDistance ?? 1;
    const maxDistance = entityData.maxDistance ?? 3;

    if (distance < minDistance) {
      // Too close - move away
      const awayPos = this.findDirectionAwayFrom(context, npcPos.x, npcPos.y, targetPos.x, targetPos.y);
      if (awayPos) {
        context.spatial.move(entityId, awayPos.x, awayPos.y);
        return true;
      }
    } else if (distance > maxDistance) {
      // Too far - move toward using pathfinding
      const nextStep = this.findNextStepToward(context, npcPos, targetPos, entityData.pathfindingRange ?? 20);
      if (nextStep) {
        context.spatial.move(entityId, nextStep.x, nextStep.y);
        return true;
      }
    }
    // else: in range, don't move
    return false;
  }

  /**
   * Flee mode: run away from target when too close.
   * State machine: idle (calm) when far, active (fleeing) when close.
   * @returns true if a movement was issued
   */
  private processFlee(
    context: GameContext,
    entityId: number,
    entityData: ReturnType<typeof context.spatial.getEntityData> & { targetEntityId?: number; panicDistance?: number; safeDistance?: number; aiMovementState?: 'idle' | 'active' },
    targetEntityId: number | undefined
  ): boolean {
    if (targetEntityId === undefined) return false;

    const npcPos = context.spatial.getEntityPosition(entityId);
    const targetPos = context.spatial.getEntityPosition(targetEntityId);
    if (!npcPos || !targetPos) return false;

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
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Pursue mode: chase target when in range, give up when too far.
   * State machine: idle when out of range, active when chasing, returning when going back to path.
   * If NPC has baseMovementMode='patrol', returns to path when giving up.
   * @returns true if a movement was issued
   */
  private processPursue(
    context: GameContext,
    entityId: number,
    entityData: ReturnType<typeof context.spatial.getEntityData> & {
      targetEntityId?: number;
      triggerRange?: number;
      giveUpRange?: number;
      pathfindingRange?: number;
      aiMovementState?: 'idle' | 'active' | 'returning';
      baseMovementMode?: string;
      homePathCell?: { x: number; y: number };
      lastPathCell?: { x: number; y: number };
    },
    targetEntityId: number | undefined
  ): boolean {
    const npcPos = context.spatial.getEntityPosition(entityId);
    if (!npcPos) return false;

    // Handle "returning" state first - doesn't require a target
    if (entityData.aiMovementState === 'returning') {
      // Check if we've reached any path node (not just home)
      const pathNodeId = context.spatial.getEntityIdAt(npcPos.x, npcPos.y, GameLayers.LOGIC);
      if (pathNodeId !== undefined) {
        const pathNodeData = context.spatial.getEntityData(pathNodeId);
        if (pathNodeData && isPathNode(pathNodeData)) {
          // Reached a path node, switch to patrol mode
          entityData.movementMode = 'patrol';
          entityData.aiMovementState = 'idle';
          entityData.lastPathCell = undefined; // Reset to allow any direction
          return false;
        }
      }

      // Check if player came back in range - interrupt return to chase again
      if (targetEntityId !== undefined) {
        const targetPos = context.spatial.getEntityPosition(targetEntityId);
        if (targetPos) {
          const distance = this.manhattanDistance(npcPos.x, npcPos.y, targetPos.x, targetPos.y);
          const triggerRange = entityData.triggerRange ?? 8;
          if (distance <= triggerRange) {
            entityData.aiMovementState = 'active';
            // Fall through to active state handling below
          } else {
            // Continue pathfinding back to home path
            if (entityData.homePathCell) {
              const nextStep = this.findNextStepToward(
                context,
                npcPos,
                entityData.homePathCell,
                entityData.pathfindingRange ?? 20
              );
              if (nextStep) {
                context.spatial.move(entityId, nextStep.x, nextStep.y);
                return true;
              }
            }
            return false;
          }
        }
      } else {
        // No target, just continue returning to path
        if (entityData.homePathCell) {
          const nextStep = this.findNextStepToward(
            context,
            npcPos,
            entityData.homePathCell,
            entityData.pathfindingRange ?? 20
          );
          if (nextStep) {
            context.spatial.move(entityId, nextStep.x, nextStep.y);
            return true;
          }
        }
        return false;
      }
    }

    // For non-returning states, we need a valid target
    if (targetEntityId === undefined) return false;
    const targetPos = context.spatial.getEntityPosition(targetEntityId);
    if (!targetPos) return false;

    const distance = this.manhattanDistance(npcPos.x, npcPos.y, targetPos.x, targetPos.y);
    const triggerRange = entityData.triggerRange ?? 8;
    const giveUpRange = entityData.giveUpRange ?? 15;

    // State machine for idle/active
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
        
        // If NPC has a base patrol mode, start returning to path
        if (entityData.baseMovementMode === 'patrol' && entityData.homePathCell) {
          // Check if already on a path node
          const pathNodeId = context.spatial.getEntityIdAt(npcPos.x, npcPos.y, GameLayers.LOGIC);
          if (pathNodeId !== undefined) {
            const pathNodeData = context.spatial.getEntityData(pathNodeId);
            if (pathNodeData && isPathNode(pathNodeData)) {
              // Already on path, switch to patrol mode
              entityData.movementMode = 'patrol';
              entityData.aiMovementState = 'idle';
              entityData.lastPathCell = undefined; // Reset to allow any direction
              return false;
            }
          }
          
          // Not on path, start returning
          entityData.aiMovementState = 'returning';
          const nextStep = this.findNextStepToward(
            context,
            npcPos,
            entityData.homePathCell,
            entityData.pathfindingRange ?? 20
          );
          if (nextStep) {
            context.spatial.move(entityId, nextStep.x, nextStep.y);
            return true;
          }
        } else {
          // No base patrol mode, just go idle
          entityData.aiMovementState = 'idle';
        }
      } else if (distance <= 1) {
        // Caught the target - stay adjacent
        // (system doesn't handle catch events, just movement)
      } else {
        // Continue chasing - pathfind toward target
        const nextStep = this.findNextStepToward(context, npcPos, targetPos, entityData.pathfindingRange ?? 20);
        if (nextStep) {
          context.spatial.move(entityId, nextStep.x, nextStep.y);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Wander mode: move randomly to adjacent walkable cells.
   * @returns true if a movement was issued
   */
  private processWander(context: GameContext, entityId: number): boolean {
    const npcPos = context.spatial.getEntityPosition(entityId);
    if (!npcPos) return false;

    const cell = context.spatial.grid.cell(npcPos.x, npcPos.y);
    if (!cell) return false;

    // Get all walkable neighbors (not blocked)
    const walkableNeighbors: LinkedCell[] = [];
    for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
      const neighbor = cell.neighbor(dir);
      if (neighbor && !context.spatial.isBlocked(neighbor)) {
        walkableNeighbors.push(neighbor);
      }
    }

    if (walkableNeighbors.length === 0) return false;

    // Pick a random neighbor
    const randomIndex = Math.floor(Math.random() * walkableNeighbors.length);
    const target = walkableNeighbors[randomIndex];
    context.spatial.move(entityId, target.x, target.y);
    return true;
  }

  /**
   * Patrol mode: follow path nodes on LOGIC layer.
   * - NPCs auto-detect home path on first tick
   * - At junctions (3+ path neighbors), use PRNG to select
   * - No backtracking unless at dead-end (1 neighbor)
   * - Circular paths are supported (no reversal needed)
   * - If NPC has triggerRange set, switches to pursue when player is in range
   * @returns true if a movement was issued
   */
  private processPatrol(
    context: GameContext,
    entityId: number,
    entityData: ReturnType<typeof context.spatial.getEntityData> & {
      homePathCell?: { x: number; y: number };
      lastPathCell?: { x: number; y: number };
      patrolDirection?: 1 | -1;
      triggerRange?: number;
      targetEntityId?: number;
      baseMovementMode?: string;
    }
  ): boolean {
    const npcPos = context.spatial.getEntityPosition(entityId);
    if (!npcPos) return false;

    // Check for pursue trigger if NPC has triggerRange
    if (entityData.triggerRange !== undefined) {
      const playerEntityId = context.gameManager?.gameState?.playerEntityId;
      const targetId = entityData.targetEntityId ?? playerEntityId;
      if (targetId !== undefined) {
        const targetPos = context.spatial.getEntityPosition(targetId);
        if (targetPos) {
          const distance = this.manhattanDistance(npcPos.x, npcPos.y, targetPos.x, targetPos.y);
          if (distance <= entityData.triggerRange) {
            // Switch to pursue mode, remember base mode for return
            entityData.baseMovementMode = 'patrol';
            entityData.movementMode = 'pursue';
            entityData.aiMovementState = 'active';
            return false; // Let pursue mode handle next tick
          }
        }
      }
    }

    // Initialize home path cell on first tick
    if (!entityData.homePathCell) {
      // Check if NPC is on a path node
      const pathNodeId = context.spatial.getEntityIdAt(npcPos.x, npcPos.y, GameLayers.LOGIC);
      if (pathNodeId !== undefined) {
        const pathNodeData = context.spatial.getEntityData(pathNodeId);
        if (pathNodeData && isPathNode(pathNodeData)) {
          entityData.homePathCell = { x: npcPos.x, y: npcPos.y };
          entityData.patrolDirection = 1;
        }
      }
      // If not on a path, NPC can't patrol
      if (!entityData.homePathCell) return false;
    }

    // Get adjacent path nodes
    const pathNeighbors = this.getPathNeighbors(context, npcPos.x, npcPos.y);
    if (pathNeighbors.length === 0) return false;

    // Filter out lastPathCell to prevent backtracking (unless dead-end)
    let validNeighbors = pathNeighbors;
    if (entityData.lastPathCell && pathNeighbors.length > 1) {
      validNeighbors = pathNeighbors.filter(
        (n) => n.x !== entityData.lastPathCell!.x || n.y !== entityData.lastPathCell!.y
      );
    }

    // Dead-end: only one neighbor (which is lastPathCell), reverse direction
    if (validNeighbors.length === 0) {
      validNeighbors = pathNeighbors;
      entityData.patrolDirection = entityData.patrolDirection === 1 ? -1 : 1;
    }

    // Select next cell
    let nextCell: { x: number; y: number };
    if (validNeighbors.length === 1) {
      nextCell = validNeighbors[0];
    } else {
      // Junction: PRNG selection
      const randomIndex = Math.floor(Math.random() * validNeighbors.length);
      nextCell = validNeighbors[randomIndex];
    }

    // Check if the cell is walkable (not blocked by walls/actors)
    const targetCell = context.spatial.grid.cell(nextCell.x, nextCell.y);
    if (!targetCell || context.spatial.isBlocked(targetCell)) {
      return false;
    }

    // Update lastPathCell and move
    entityData.lastPathCell = { x: npcPos.x, y: npcPos.y };
    context.spatial.move(entityId, nextCell.x, nextCell.y);
    return true;
  }

  /**
   * Get adjacent cells that have path-node entities on the LOGIC layer.
   * Used by patrol mode to follow paths.
   */
  private getPathNeighbors(
    context: GameContext,
    x: number,
    y: number
  ): Array<{ x: number; y: number }> {
    const cell = context.spatial.grid.cell(x, y);
    if (!cell) return [];

    const neighbors: Array<{ x: number; y: number }> = [];
    for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
      const neighbor = cell.neighbor(dir);
      if (!neighbor) continue;

      // Check if there's a path-node on the LOGIC layer
      const pathNodeId = context.spatial.getEntityIdAt(neighbor.x, neighbor.y, GameLayers.LOGIC);
      if (pathNodeId !== undefined) {
        const pathNodeData = context.spatial.getEntityData(pathNodeId);
        if (pathNodeData && isPathNode(pathNodeData)) {
          neighbors.push({ x: neighbor.x, y: neighbor.y });
        }
      }
    }

    return neighbors;
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
      description: 'NPC Movement System (follow, flee, pursue, wander, patrol)',
    };
  }
}
