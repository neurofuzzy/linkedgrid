import { LinkedGrid } from '../../grid/linked-grid.js';
import { SparseEntityStore } from '../../spartan/entity-store.js';
import { SpatialSystem } from '../../spartan/spatial-system.js';

export interface Snapshot {
  operation: string;
  args: unknown[];
  result: unknown;
  
  // Scene information (optional for backward compatibility)
  sceneId?: string;
  sceneName?: string;
  
  entities: Array<{
    id: number;
    type: string;
    x: number;
    y: number;
    layer: number;
  }>;
  grid: { w: number; h: number };
}

export interface TestResult {
  snapshots: Snapshot[];
  passed: boolean;
  error?: string;
  assertions?: Array<{
    description: string;
    passed: boolean;
    error?: string;
  }>;
}

export interface VisualTestContext {
  grid: LinkedGrid;
  spatial: SpatialSystem;
  store: SparseEntityStore;
  expect?: (description: string, fn: () => void) => void;
  
  // Optional scene system support
  game?: any;  // GameManager - use any to avoid circular dependency
  scene?: any; // Scene - for single-scene tests with metadata
}

export interface VisualTestDefinition {
  arrange?: (ctx: VisualTestContext) => void | Promise<void>;
  act: (ctx: VisualTestContext) => void | Promise<void>;
  assert?: (ctx: VisualTestContext) => void | Promise<void>;
}

export class TestExecutor {
  private snapshots: Snapshot[] = [];
  private grid!: LinkedGrid;
  private store!: SparseEntityStore;
  private spatial!: SpatialSystem;
  private wrappedSpatial!: SpatialSystem;
  private captureEnabled = true; // Control whether proxy captures snapshots
  private assertions: Array<{ description: string; passed: boolean; error?: string }> = [];
  private context?: VisualTestContext; // Store context between arrange and act/assert phases
  
  /**
   * Execute arrange phase only - sets up initial state
   * Returns initial snapshot to display before play
   */
  async executeArrange(definition: VisualTestDefinition): Promise<Snapshot> {
    this.snapshots = [];
    
    this.grid = new LinkedGrid(20, 20);
    this.store = new SparseEntityStore();
    this.spatial = new SpatialSystem(this.grid, this.store);
    this.wrappedSpatial = this.wrapSpatial(this.spatial);
    
    this.context = { 
      grid: this.grid, 
      spatial: this.wrappedSpatial, 
      store: this.store,
      game: undefined,
      scene: undefined
    };
    
    // Store context globally for snapshot capture to access scene info
    (globalThis as any).__currentTestContext = this.context;
    
    // Disable snapshot capture during arrange - we only want the final state
    this.captureEnabled = false;
    
    // Run arrange phase if present
    if (definition.arrange) {
      await definition.arrange(this.context);
    }
    
    // If game/scene was set up, update ctx.spatial to be a smart delegate
    this.setupSceneSpatialDelegate(this.context);
    
    // Wrap GameManager if present after arrange (when it's been assigned)
    this.setupGameManagerWrapping(this.context);
    
    // Re-enable capture
    this.captureEnabled = true;
    
    // Capture initial state AFTER all arrange operations complete
    const spatialForSnapshot = this.getActiveSpatial(this.context);
    this.captureSnapshot(spatialForSnapshot, 'initial', [], null);
    
    return this.snapshots[0];
  }
  
  /**
   * Execute act and assert phases - generates snapshots
   * Should be called after executeArrange
   */
  async executeActAssert(definition: VisualTestDefinition): Promise<TestResult> {
    this.snapshots = [];
    this.assertions = [];
    
    // Don't capture initial state - the arrange snapshot is already the initial state
    
    // Create expect helper that captures assertions
    const expect = (description: string, fn: () => void) => {
      try {
        fn();
        this.assertions.push({ description, passed: true });
      } catch (err) {
        this.assertions.push({
          description,
          passed: false,
          error: (err as Error).message
        });
        // Do not re-throw, to allow all assertions to run
      }
    };
    
    // Reuse context from arrange phase to preserve game/scene references
    if (!this.context) {
      throw new Error('Context not initialized - executeArrange must be called first');
    }
    
    // Add expect helper to existing context
    this.context.expect = expect;
    
    // Update global context with expect function
    (globalThis as any).__currentTestContext = this.context;
    
    try {
      // Act phase
      await definition.act(this.context);
      
      // Assert phase
      if (definition.assert) {
        await definition.assert(this.context);
      }
      
      const testPassed = this.assertions.every(a => a.passed);
      
      return {
        snapshots: this.snapshots,
        passed: testPassed,
        error: testPassed ? undefined : 'One or more assertions failed',
        assertions: this.assertions
      };
    } catch (error) {
      return {
        snapshots: this.snapshots,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        assertions: this.assertions
      };
    }
  }
  
  private wrapSpatial(spatial: SpatialSystem): SpatialSystem {
    return new Proxy(spatial, {
      get: (target, prop) => {
        const originalMethod = target[prop as keyof SpatialSystem];
        if (typeof originalMethod !== 'function') return originalMethod;
        
        return (...args: unknown[]) => {
          const result = originalMethod.apply(target, args);
          
          const handleResult = (res: unknown) => {
            // Only capture if enabled (disabled during arrange phase)
            // Don't capture on 'move' (stages only) - wait for 'commit' (executes)
            // Capture 'pause' as a special marker for pause frames
            if (this.captureEnabled && ['spawn', 'remove', 'commit', 'pause'].includes(prop as string)) {
              this.captureSnapshot(target, prop as string, args, res);
            }
            return res;
          };
          
          // Handle async methods
          if (result instanceof Promise) {
            return result.then(handleResult);
          }
          
          return handleResult(result);
        };
      }
    });
  }
  
  private captureSnapshot(
    spatial: SpatialSystem,
    operation: string,
    args: unknown[],
    result: unknown
  ): void {
    const entities = [];
    const grid = (spatial as any).grid;
    
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const cell = grid.cell(x, y);
        if (cell) {
          // Iterate through all layers in the cell
          cell.values.forEach((entityId: number | undefined, layer: number) => {
            if (entityId !== undefined) {
              const data = spatial.getEntityData(entityId);
              if (data) {
                entities.push({ id: entityId, type: data.type, x, y, layer });
              }
            }
          });
        }
      }
    }
    
    // Detect scene information from context
    let sceneId: string | undefined;
    let sceneName: string | undefined;
    
    const testCtx = (globalThis as any).__currentTestContext;
    if (testCtx?.game) {
      // Multi-scene test with GameManager
      const activeScene = testCtx.game.sceneManager?.getActiveScene();
      if (activeScene) {
        sceneId = activeScene.id;
        sceneName = activeScene.metadata?.name as string;
      }
    } else if (testCtx?.scene) {
      // Single scene test with explicit scene
      sceneId = testCtx.scene.id;
      sceneName = testCtx.scene.metadata?.name as string;
    }
    
    this.snapshots.push({
      operation,
      args,
      result,
      entities,
      grid: { w: grid.width, h: grid.height },
      sceneId,
      sceneName
    });
  }
  
  private getActiveSpatial(ctx: VisualTestContext): SpatialSystem {
    // If there's a game manager, use the active scene's spatial
    if (ctx.game) {
      const activeScene = ctx.game.sceneManager?.getActiveScene();
      if (activeScene) {
        return activeScene.spatial;
      }
    }
    
    // If there's a single scene, use its spatial
    if (ctx.scene) {
      return ctx.scene.spatial;
    }
    
    // Otherwise use the default spatial
    return this.spatial;
  }
  
  private setupSceneSpatialDelegate(ctx: VisualTestContext): void {
    // If game or scene is present, replace ctx.spatial with a smart delegate
    if (ctx.game || ctx.scene) {
      // Create a proxy that delegates all calls to the active scene's spatial
      ctx.spatial = new Proxy({} as SpatialSystem, {
        get: (_, prop) => {
          const activeSpatial = this.getActiveSpatial(ctx);
          const value = activeSpatial[prop as keyof SpatialSystem];
          
          // If it's a function, bind it and potentially wrap it for snapshot capture
          if (typeof value === 'function') {
            const boundMethod = value.bind(activeSpatial);
            
            return (...args: unknown[]) => {
              const result = boundMethod(...args);
              
              const handleResult = (res: unknown) => {
                // Capture snapshots only for operations that change visible state
                // Don't capture on 'move' (stages only) - wait for 'commit' (executes)
                // Also capture 'pause' as a special marker for pause frames
                if (this.captureEnabled && ['spawn', 'remove', 'commit', 'pause'].includes(prop as string)) {
                  this.captureSnapshot(activeSpatial, prop as string, args, res);
                }
                return res;
              };
              
              // Handle async methods
              if (result instanceof Promise) {
                return result.then(handleResult);
              }
              
              return handleResult(result);
            };
          }
          
          return value;
        }
      });
    }
  }
  
  private setupGameManagerWrapping(ctx: VisualTestContext): void {
    // Wrap GameManager.movePlayerToScene if present
    if (ctx.game && ctx.game.movePlayerToScene) {
      const originalMove = ctx.game.movePlayerToScene.bind(ctx.game);
      ctx.game.movePlayerToScene = (...args: any[]) => {
        const result = originalMove(...args);

        // Visual tests expect immediate scene change: execute queued transition now
        if (ctx.game.executePendingTransition) {
          ctx.game.executePendingTransition();
        }

        // Capture snapshot after transition has been applied
        const activeScene = ctx.game.sceneManager?.getActiveScene();
        if (activeScene && this.captureEnabled) {
          this.captureSnapshot(
            activeScene.spatial,
            'movePlayerToScene',
            args,
            result
          );
        }

        return result;
      };
    }
  }
}
