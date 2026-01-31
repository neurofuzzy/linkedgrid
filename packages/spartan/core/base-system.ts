import type { GameSystem, GameContext } from './types';

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
 * Automatically handles tick counting and rate limiting.
 * Subclasses implement onTick() instead of update().
 */
export abstract class BaseTickedSystem extends BaseSystem {
  private _currentTick = 0;
  
  /**
   * How often this system should run (in ticks)
   * Set this in your subclass constructor or as a class property
   */
  protected abstract tickRate: number;
  
  /**
   * Final update implementation - handles tick counting
   */
  update(context: GameContext): void {
    this._currentTick++;
    
    if (this._currentTick % this.tickRate !== 0) {
      return;
    }
    
    this.onTick(context);
  }
  
  /**
   * Called every N ticks (where N = tickRate)
   * Implement your system logic here
   */
  protected abstract onTick(context: GameContext): void;
  
  /**
   * Reset tick counter
   */
  public override resetState(): void {
    this._currentTick = 0;
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
