/**
 * Objective System - Tracks game objectives and scene completion.
 *
 * Supports three objective types:
 * - collect-flag: All flags with matching targetId must be collected
 * - kill-all: All enemies in the scene must be eliminated
 * - reach-exit: Player must overlap an exit entity
 *
 * Objectives are defined in GameState.objectives and tracked per scene.
 * When all objectives for a scene are completed, a scene completion
 * event fires. When all objectives in the game are completed, a
 * game completion event fires.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import type { HealthSystem } from './health.system';
import type { ObjectiveDefinition } from '../traits/objective.trait';
import { isPlayer, isEnemy, isFlag, isExit, isEntityAlive } from '../traits/trait-guards';

/**
 * ObjectiveSystemConfig - Configuration for objective tracking.
 */
export interface ObjectiveSystemConfig {
  /** Callback when a single objective is completed */
  onObjectiveComplete?: (objective: ObjectiveDefinition) => void;
  /** Callback when all objectives in a scene are completed */
  onSceneComplete?: (sceneId: string) => void;
  /** Callback when all objectives in the game are completed */
  onAllComplete?: () => void;
}

/**
 * ObjectiveSystem - Manages game objectives and completion tracking.
 *
 * Key responsibilities:
 * 1. Track collect-flag objectives (count remaining flags)
 * 2. Track kill-all objectives (count remaining enemies)
 * 3. Track reach-exit objectives (player on exit)
 * 4. Fire completion callbacks
 *
 * @system
 * @reactsTo Entity state changes, overlaps
 * @modifies GameState.objectives completion status
 *
 * @example
 * ```typescript
 * const objectiveSystem = new ObjectiveSystem(gameManager, healthSystem, {
 *   onSceneComplete: (sceneId) => console.log(`Scene ${sceneId} complete!`),
 *   onAllComplete: () => console.log('You win!'),
 * });
 * gameLoop.addSystem(objectiveSystem);
 * ```
 */
export class ObjectiveSystem extends BaseReactiveSystem {
  readonly executionPhase = 'post-commit' as const;

  private config: ObjectiveSystemConfig;

  /** Track which scenes have had their completion callback fired */
  private completedScenes: Set<string> = new Set();

  /** Track if game completion callback has fired */
  private gameCompleted = false;

  constructor(
    private gameManager: GameManager,
    private healthSystem: HealthSystem,
    config: Partial<ObjectiveSystemConfig> = {}
  ) {
    super();
    this.config = { ...config };
  }

  update(context: GameContext): void {
    const objectives = this.gameManager.gameState.objectives;
    if (!objectives || objectives.length === 0) return;

    for (const objective of objectives) {
      if (objective.completed) continue;

      let completed = false;

      switch (objective.type) {
        case 'collect-flag':
          completed = this.checkCollectFlag(context, objective);
          break;
        case 'kill-all':
          completed = this.checkKillAll(context, objective);
          break;
        case 'reach-exit':
          completed = this.checkReachExit(context, objective);
          break;
      }

      if (completed) {
        objective.completed = true;
        if (this.config.onObjectiveComplete) {
          this.config.onObjectiveComplete(objective);
        }
      }
    }

    // Check scene completion
    this.checkSceneCompletion(objectives);

    // Check game completion
    this.checkGameCompletion(objectives);
  }

  /**
   * Check if all flags with the target objectiveId have been collected.
   *
   * Returns true when no flag entities with the matching objectiveId
   * remain in the scene.
   */
  private checkCollectFlag(context: GameContext, objective: ObjectiveDefinition): boolean {
    // Only check in the objective's scene
    const activeScene = this.gameManager.sceneManager.getActiveScene();
    if (!activeScene) return false;

    const activeSceneId = this.getActiveSceneId();
    if (activeSceneId !== objective.sceneId) return false;

    // Count remaining flags with matching objectiveId
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData) continue;
      if (!context.spatial.isAlive(entityId)) continue;

      if (isFlag(entityData) && entityData.objectiveId === objective.targetId) {
        return false; // Still have uncollected flags
      }
    }

    return true; // All flags collected
  }

  /**
   * Check if all enemies in the scene have been eliminated.
   *
   * Returns true when no alive enemy entities remain in the scene.
   */
  private checkKillAll(context: GameContext, objective: ObjectiveDefinition): boolean {
    const activeSceneId = this.getActiveSceneId();
    if (activeSceneId !== objective.sceneId) return false;

    // Count remaining alive enemies
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData) continue;
      if (!context.spatial.isAlive(entityId)) continue;

      if (isEnemy(entityData) && isEntityAlive(entityData)) {
        return false; // Still have living enemies
      }
    }

    return true; // All enemies eliminated
  }

  /**
   * Check if the player is overlapping an exit entity.
   *
   * Returns true when player overlaps any exit entity in the scene.
   */
  private checkReachExit(context: GameContext, objective: ObjectiveDefinition): boolean {
    const activeSceneId = this.getActiveSceneId();
    if (activeSceneId !== objective.sceneId) return false;

    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId) return false;

    for (const overlap of context.overlaps) {
      let hasPlayerInOverlap = false;
      let hasExitInOverlap = false;

      for (const entityId of overlap.entityIds) {
        if (entityId === playerId) {
          hasPlayerInOverlap = true;
          continue;
        }

        const entityData = context.spatial.getEntityData(entityId);
        if (entityData && isExit(entityData)) {
          hasExitInOverlap = true;
        }
      }

      if (hasPlayerInOverlap && hasExitInOverlap) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if all objectives for a scene are completed.
   */
  private checkSceneCompletion(objectives: ObjectiveDefinition[]): void {
    // Group objectives by scene
    const sceneObjectives = new Map<string, ObjectiveDefinition[]>();
    for (const obj of objectives) {
      const existing = sceneObjectives.get(obj.sceneId) || [];
      existing.push(obj);
      sceneObjectives.set(obj.sceneId, existing);
    }

    // Check each scene
    for (const [sceneId, sceneObjs] of sceneObjectives) {
      if (this.completedScenes.has(sceneId)) continue;

      const allComplete = sceneObjs.every((o) => o.completed);
      if (allComplete) {
        this.completedScenes.add(sceneId);
        if (this.config.onSceneComplete) {
          this.config.onSceneComplete(sceneId);
        }
      }
    }
  }

  /**
   * Check if all objectives in the game are completed.
   */
  private checkGameCompletion(objectives: ObjectiveDefinition[]): void {
    if (this.gameCompleted) return;

    const allComplete = objectives.every((o) => o.completed);
    if (allComplete) {
      this.gameCompleted = true;
      if (this.config.onAllComplete) {
        this.config.onAllComplete();
      }
    }
  }

  /**
   * Get the active scene ID.
   */
  private getActiveSceneId(): string {
    const allSceneIds = this.gameManager.sceneManager.getAllSceneIds();
    for (const sceneId of allSceneIds) {
      const scene = this.gameManager.sceneManager.getScene(sceneId);
      if (scene === this.gameManager.sceneManager.getActiveScene()) {
        return sceneId;
      }
    }
    return '';
  }

  // === Public Query API ===

  /**
   * Check if a specific objective is completed.
   */
  isObjectiveComplete(objectiveId: string): boolean {
    const objectives = this.gameManager.gameState.objectives;
    const objective = objectives?.find((o) => o.id === objectiveId);
    return objective?.completed ?? false;
  }

  /**
   * Check if all objectives in a scene are completed.
   */
  isSceneComplete(sceneId: string): boolean {
    return this.completedScenes.has(sceneId);
  }

  /**
   * Check if all objectives in the game are completed.
   */
  isAllComplete(): boolean {
    return this.gameCompleted;
  }

  /**
   * Get objective status summary.
   */
  getObjectiveStatus(): { total: number; completed: number; remaining: number } {
    const objectives = this.gameManager.gameState.objectives || [];
    const completed = objectives.filter((o) => o.completed).length;
    return {
      total: objectives.length,
      completed,
      remaining: objectives.length - completed,
    };
  }

  public override resetState(): void {
    this.completedScenes.clear();
    this.gameCompleted = false;
  }

  public override getDebugState(): Record<string, unknown> {
    const status = this.getObjectiveStatus();
    return {
      ...super.getDebugState(),
      ...status,
      completedScenes: [...this.completedScenes],
      gameCompleted: this.gameCompleted,
    };
  }
}
