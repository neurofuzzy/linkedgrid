import { LinkedGrid } from '../../grid/linked-grid.js';
import { SparseEntityStore } from '../../spartan/entity-store.js';
import { SpatialSystem } from '../../spartan/spatial-system.js';

export interface Snapshot {
  operation: string;
  args: unknown[];
  result: unknown;
  entities: Array<{
    id: number;
    type: string;
    x: number;
    y: number;
  }>;
  grid: { w: number; h: number };
}

export interface TestResult {
  snapshots: Snapshot[];
  passed: boolean;
  error?: string;
}

export interface VisualTestContext {
  grid: LinkedGrid;
  spatial: SpatialSystem;
  store: SparseEntityStore;
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
    
    const ctx = { 
      grid: this.grid, 
      spatial: this.wrappedSpatial, 
      store: this.store 
    };
    
    // Run arrange phase if present
    if (definition.arrange) {
      await definition.arrange(ctx);
    }
    
    // Capture initial state
    this.captureSnapshot(this.spatial, 'initial', [], null);
    
    return this.snapshots[0];
  }
  
  /**
   * Execute act and assert phases - generates snapshots
   * Should be called after executeArrange
   */
  async executeActAssert(definition: VisualTestDefinition): Promise<TestResult> {
    this.snapshots = [];
    
    // Don't capture initial state - the arrange snapshot is already the initial state
    
    const ctx = { 
      grid: this.grid, 
      spatial: this.wrappedSpatial, 
      store: this.store 
    };
    
    try {
      // Act phase
      await definition.act(ctx);
      
      // Assert phase
      if (definition.assert) {
        await definition.assert(ctx);
      }
      
      return {
        snapshots: this.snapshots,
        passed: true
      };
    } catch (error) {
      return {
        snapshots: this.snapshots,
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private wrapSpatial(spatial: SpatialSystem): SpatialSystem {
    return new Proxy(spatial, {
      get: (target, prop) => {
        if (typeof target[prop] !== 'function') return target[prop];
        
        return (...args: unknown[]) => {
          const result = target[prop].apply(target, args);
          
          if (['spawn', 'move', 'remove'].includes(prop as string)) {
            this.captureSnapshot(target, prop as string, args, result);
          }
          
          return result;
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
        const ids = spatial.getEntityIdsInCell(x, y);
        ids.forEach(id => {
          const data = spatial.getEntityData(id);
          if (data) {
            entities.push({ id, type: data.type, x, y });
          }
        });
      }
    }
    
    this.snapshots.push({
      operation,
      args,
      result,
      entities,
      grid: { w: grid.width, h: grid.height }
    });
  }
}
