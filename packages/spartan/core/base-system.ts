/**
 * @brief Abstract base classes and interfaces for game systems.
 */
import type { GameSystem, GameContext, EntityLifecycleEvent, ExecutionPhase } from './types';

/**
 * BaseSystem - Abstract base for all game systems
 * 
 * Provides common functionality and enforces consistent structure.
 */
export abstract class BaseSystem implements GameSystem {
  /**
   * System name (auto-derived from class name)
   */
  get name(): string {
    return this.constructor.name;
  }

  /**
   * Execution phase for automatic ordering.
   * Subclasses must declare their phase.
   */
  abstract readonly executionPhase: ExecutionPhase;

  /**
   * Main update method - implemented by subclasses
   */
  abstract update(context: GameContext): void;

  /**
   * Reset system state (for testing/scene transitions)
   */
  public resetState(): void {
    // Override if system has state to reset
  }

  /**
   * Get debug information about system state
   */
  public getDebugState(): Record<string, unknown> {
    return {
      systemType: this.name,
      note: 'Override getDebugState() for more detailed info'
    };
  }
}

/**
 * BaseTickedSystem - For systems that run on a fixed cadence
 * 
 * Automatically handles tick counting, rate limiting, and lifecycle events.
 * Subclasses implement onTick() instead of update().
 * 
 * ## Lifecycle Events
 * 
 * Systems can react to entity spawn/remove events by overriding:
 * - `onEntitySpawn(event)` - called when a non-ephemeral entity is spawned
 * - `onEntityRemove(event)` - called when a non-ephemeral entity is removed
 * 
 * The base class handles:
 * - Registering callbacks with SpatialSystem
 * - Detecting scene changes and re-registering
 * - Cleanup on resetState()
 * 
 * @example
 * ```typescript
 * class MySystem extends BaseTickedSystem {
 *   protected tickRate = 1;
 *   private dirty = true;
 *   
 *   protected onEntitySpawn(event: EntityLifecycleEvent): void {
 *     if (event.type === 'my-entity') {
 *       this.dirty = true;
 *     }
 *   }
 *   
 *   protected onTick(context: GameContext): void {
 *     if (this.dirty) {
 *       this.rebuildState(context);
 *       this.dirty = false;
 *     }
 *     // ... process logic
 *   }
 * }
 * ```
 */
export abstract class BaseTickedSystem extends BaseSystem {
  private _currentTick = 0;

  /** Reference to current spatial system (to detect scene changes) */
  private _currentSpatial: GameContext['spatial'] | null = null;

  /** Unsubscribe functions for lifecycle callbacks */
  private _lifecycleUnsubscribers: Array<() => void> = [];

  /**
   * How often this system should run (in ticks)
   * Set this in your subclass constructor or as a class property
   */
  protected abstract tickRate: number;

  /**
   * Final update implementation - handles tick counting and lifecycle registration
   */
  update(context: GameContext): void {
    this._currentTick++;

    // Register lifecycle handlers (re-registers on scene change)
    this._registerLifecycleHandlers(context);

    if (this._currentTick % this.tickRate !== 0) {
      return;
    }

    this.onTick(context);
  }

  /**
   * Register lifecycle callbacks with SpatialSystem.
   * Automatically re-registers when spatial system changes (scene transition).
   * @private
   */
  private _registerLifecycleHandlers(context: GameContext): void {
    // Detect scene change by checking if spatial system changed
    if (this._currentSpatial !== context.spatial) {
      // Unsubscribe from old spatial
      for (const unsub of this._lifecycleUnsubscribers) {
        unsub();
      }
      this._lifecycleUnsubscribers = [];
      this._currentSpatial = context.spatial;

      // Reset tick counter so the system fires on its first tick in the new scene.
      // Without this, tickRate > 1 systems may skip the first tick after transition.
      this._currentTick = 0;

      // Notify subclass of scene change
      this.onSceneChange();
    }

    if (this._lifecycleUnsubscribers.length > 0) return; // Already registered

    this._lifecycleUnsubscribers.push(
      context.spatial.onSpawn((event) => this.onEntitySpawn(event)),
      context.spatial.onRemove((event) => this.onEntityRemove(event))
    );
  }

  /**
   * Called when an entity is spawned (non-ephemeral entities only).
   * Override to react to entity spawns.
   * 
   * @param event - Contains entityId, type, x, y, layer
   */
  protected onEntitySpawn(_event: EntityLifecycleEvent): void {
    // Override in subclass to react to spawns
  }

  /**
   * Called when an entity is removed (non-ephemeral entities only).
   * Override to react to entity removals.
   * 
   * @param event - Contains entityId, type, x, y, layer
   */
  protected onEntityRemove(_event: EntityLifecycleEvent): void {
    // Override in subclass to react to removals
  }

  /**
   * Called when the spatial system changes (scene transition).
   * Override to reset scene-specific state.
   */
  protected onSceneChange(): void {
    // Override in subclass to handle scene transitions
  }

  /**
   * Called every N ticks (where N = tickRate)
   * Implement your system logic here
   */
  protected abstract onTick(context: GameContext): void;

  /**
   * Reset tick counter and lifecycle state
   */
  public override resetState(): void {
    this._currentTick = 0;
    this._currentSpatial = null;

    // Unsubscribe from lifecycle callbacks
    for (const unsub of this._lifecycleUnsubscribers) {
      unsub();
    }
    this._lifecycleUnsubscribers = [];
  }

  /**
   * Debug state includes tick info
   */
  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      currentTick: this._currentTick,
      tickRate: this.tickRate,
      nextRunTick: this._currentTick + (this.tickRate - (this._currentTick % this.tickRate))
    };
  }

  // Allow subclasses to access current tick count if needed
  protected get currentTick(): number {
    return this._currentTick;
  }
}

/**
 * BaseReactiveSystem - For systems that run every tick
 * 
 * Just an alias for clarity - reactive systems don't need tick limiting.
 */
export abstract class BaseReactiveSystem extends BaseSystem {
  // No additional behavior - just semantic distinction
}
