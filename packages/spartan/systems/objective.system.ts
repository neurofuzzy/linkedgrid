/**
 * Objective System - Tracks game objectives and scene completion.
 *
 * Supports three objective types:
 * - collect-flag: All flags with matching targetId must be collected
 * - kill-all: All enemies in the scene must be eliminated
 * - reach-exit: Player must overlap an exit entity
 *
 * Performance: Uses lazy scene initialization and tracked entity sets
 * instead of iterating all positions every tick. On first encounter of
 * a scene, scans once to build tracking data (O(n)). Subsequent ticks
 * are O(tracked_enemies + tracked_flags) per objective check, which is
 * orders of magnitude faster for large grids (e.g., 1000x1000).
 *
 * For kill-all: consumes HealthSystem death events to decrement enemy
 * count, with periodic pruning of dead IDs from the tracked set.
 *
 * For collect-flag: checks isAlive() on tracked flag entity IDs.
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
 * Per-scene tracking data built on first encounter.
 */
interface SceneTracking {
  /** Set of alive enemy entity IDs in this scene */
  enemyIds: Set<number>;
  /** Flag entity IDs grouped by objectiveId (targetId) */
  flagIds: Map<string, Set<number>>;
  /** Exit entity IDs in this scene */
  exitIds: Set<number>;
}

/**
 * ObjectiveSystem - Manages game objectives and completion tracking.
 *
 * Key responsibilities:
 * 1. Track collect-flag objectives (tracked flag entity IDs)
 * 2. Track kill-all objectives (tracked enemy IDs + death events)
 * 3. Track reach-exit objectives (player on exit via overlaps)
 * 4. Fire completion callbacks
 * 5. Manage exit activation state
 *
 * @system
 * @reactsTo HealthSystem death events, entity overlaps
 * @modifies GameState.objectives completion status, exit entity activation
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

  /** Lazy-initialized tracking data per scene */
  private sceneTracking: Map<string, SceneTracking> = new Map();

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

    const activeSceneId = this.getActiveSceneId();

    // Lazy init: scan scene on first encounter to build tracking data
    if (activeSceneId && !this.sceneTracking.has(activeSceneId)) {
      this.initializeSceneTracking(context, activeSceneId);
    }

    // Consume death events to update enemy tracking
    this.processDeathEvents(activeSceneId);

    // Check each objective
    for (const objective of objectives) {
      if (objective.completed) continue;

      let completed = false;

      switch (objective.type) {
        case 'collect-flag':
          completed = this.checkCollectFlag(context, objective);
          break;
        case 'kill-all':
          completed = this.checkKillAll(objective);
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

    // Update exit activation state based on prerequisite objectives
    this.updateExitActivation(context, objectives, activeSceneId);

    // Check scene completion
    this.checkSceneCompletion(objectives);

    // Check game completion
    this.checkGameCompletion(objectives);
  }

  // === Scene Tracking ===

  /**
   * Scan the scene once to build tracking data for enemies, flags, and exits.
   * Called lazily on first update for a given scene.
   *
   * This is the only O(all_entities) scan -- subsequent ticks use the
   * tracked sets which are O(enemies + flags + exits).
   */
  private initializeSceneTracking(context: GameContext, sceneId: string): void {
    const tracking: SceneTracking = {
      enemyIds: new Set(),
      flagIds: new Map(),
      exitIds: new Set(),
    };

    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData) continue;
      if (!context.spatial.isAlive(entityId)) continue;

      if (isEnemy(entityData) && isEntityAlive(entityData)) {
        tracking.enemyIds.add(entityId);
      }

      if (isFlag(entityData)) {
        const objectiveId = entityData.objectiveId;
        if (!tracking.flagIds.has(objectiveId)) {
          tracking.flagIds.set(objectiveId, new Set());
        }
        tracking.flagIds.get(objectiveId)!.add(entityId);
      }

      if (isExit(entityData)) {
        tracking.exitIds.add(entityId);
      }
    }

    this.sceneTracking.set(sceneId, tracking);
  }

  /**
   * Consume death events from HealthSystem to update enemy tracking.
   * O(death_events_this_tick) -- typically 0-3 per tick.
   */
  private processDeathEvents(activeSceneId: string): void {
    const tracking = this.sceneTracking.get(activeSceneId);
    if (!tracking) return;

    for (const event of this.healthSystem.getDeathEvents()) {
      // Remove dead enemies from tracked set
      if (event.entityType === 'enemy') {
        tracking.enemyIds.delete(event.entityId);
      }
    }
  }

  // === Objective Checks ===

  /**
   * Check if all flags with the target objectiveId have been collected.
   *
   * Uses tracked flag IDs with isAlive() checks: O(flags_for_objective).
   * Prunes confirmed-dead flags from the tracking set.
   */
  private checkCollectFlag(context: GameContext, objective: ObjectiveDefinition): boolean {
    const activeSceneId = this.getActiveSceneId();
    if (activeSceneId !== objective.sceneId) return false;

    const tracking = this.sceneTracking.get(activeSceneId);
    if (!tracking) return false;

    const flagIds = tracking.flagIds.get(objective.targetId ?? '');
    if (!flagIds || flagIds.size === 0) return true; // No flags to collect

    // Check which tracked flags are still alive
    for (const flagId of flagIds) {
      if (context.spatial.isAlive(flagId)) {
        return false; // Still have uncollected flags
      }
    }

    // All flags dead/removed -- prune the set
    flagIds.clear();
    return true;
  }

  /**
   * Check if all enemies in the scene have been eliminated.
   *
   * Uses tracked enemy IDs populated at scene init and decremented
   * via death events: O(1) check on set size.
   */
  private checkKillAll(objective: ObjectiveDefinition): boolean {
    const activeSceneId = this.getActiveSceneId();
    if (activeSceneId !== objective.sceneId) return false;

    const tracking = this.sceneTracking.get(activeSceneId);
    if (!tracking) return false;

    return tracking.enemyIds.size === 0;
  }

  /**
   * Check if the player is overlapping an activated exit entity.
   *
   * Returns true when player overlaps an exit AND all prerequisite
   * objectives for this scene (non-reach-exit) are completed.
   *
   * Uses overlap list from GameLoop (already small) -- no change needed
   * since overlaps are inherently bounded by actual entity co-locations.
   */
  private checkReachExit(context: GameContext, objective: ObjectiveDefinition): boolean {
    const activeSceneId = this.getActiveSceneId();
    if (activeSceneId !== objective.sceneId) return false;

    // Gate: all non-reach-exit objectives for this scene must be complete
    if (!this.arePrerequisitesMet(objective)) return false;

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
   * Check if all prerequisite objectives for a reach-exit objective are met.
   * Prerequisites are all non-reach-exit objectives in the same scene.
   */
  private arePrerequisitesMet(objective: ObjectiveDefinition): boolean {
    const objectives = this.gameManager.gameState.objectives;
    if (!objectives) return true;

    return objectives
      .filter((o) => o.sceneId === objective.sceneId && o.id !== objective.id && o.type !== 'reach-exit')
      .every((o) => o.completed);
  }

  // === Exit Activation ===

  /**
   * Update exit entity activation state based on prerequisite objectives.
   * Sets `activated: true` on exit entities when all non-reach-exit
   * objectives for their scene are completed.
   *
   * Uses tracked exit IDs: O(exits_in_scene) instead of O(all_entities).
   */
  private updateExitActivation(
    _context: GameContext,
    objectives: ObjectiveDefinition[],
    activeSceneId: string,
  ): void {
    const tracking = this.sceneTracking.get(activeSceneId);
    if (!tracking) return;

    // Check if all non-reach-exit objectives for the active scene are complete
    const prerequisitesMet = objectives
      .filter((o) => o.sceneId === activeSceneId && o.type !== 'reach-exit')
      .every((o) => o.completed);

    // Update tracked exit entities only
    for (const exitId of tracking.exitIds) {
      const entityData = this.gameManager.gameState.entityStore.getData(exitId);
      if (!entityData) continue;

      const currentlyActivated = (entityData as Record<string, unknown>).activated ?? false;
      if (currentlyActivated !== prerequisitesMet) {
        this.gameManager.gameState.entityStore.setData(exitId, {
          activated: prerequisitesMet,
        });
      }
    }
  }

  // === Completion Tracking ===

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
    const activeScene = this.gameManager.sceneManager.getActiveScene();
    return activeScene ? activeScene.id : '';
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

  /**
   * Check if the exit is active for the given scene.
   * Exit is active when all non-reach-exit objectives for the scene are complete.
   */
  isExitActive(sceneId: string): boolean {
    const objectives = this.gameManager.gameState.objectives || [];
    const prerequisites = objectives.filter(
      (o) => o.sceneId === sceneId && o.type !== 'reach-exit'
    );
    return prerequisites.length === 0 || prerequisites.every((o) => o.completed);
  }

  /**
   * Force re-scan of the active scene's tracking data.
   *
   * Call this after dynamic entity spawning (e.g., SpawningSystem adding
   * new enemies mid-scene) to update the tracked sets.
   */
  reinitializeScene(context: GameContext, sceneId?: string): void {
    const id = sceneId ?? this.getActiveSceneId();
    if (id) {
      this.sceneTracking.delete(id);
      this.initializeSceneTracking(context, id);
    }
  }

  public override resetState(): void {
    this.completedScenes.clear();
    this.gameCompleted = false;
    this.sceneTracking.clear();
  }

  public override getDebugState(): Record<string, unknown> {
    const status = this.getObjectiveStatus();
    const activeSceneId = this.getActiveSceneId();
    const tracking = this.sceneTracking.get(activeSceneId);
    return {
      ...super.getDebugState(),
      ...status,
      completedScenes: [...this.completedScenes],
      gameCompleted: this.gameCompleted,
      trackedEnemies: tracking?.enemyIds.size ?? 0,
      trackedExits: tracking?.exitIds.size ?? 0,
      initializedScenes: [...this.sceneTracking.keys()],
    };
  }
}
