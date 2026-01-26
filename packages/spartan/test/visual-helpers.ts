import { LinkedGrid } from '../../grid/linked-grid';
import { SparseEntityStore } from '../entity-store';
import { SpatialSystem } from '../spatial-system';

export interface AssertionResult {
    description: string;
    passed: boolean;
    error?: string;
}

export interface VisualTestContext {
    grid: LinkedGrid;
    spatial: SpatialSystem;
    store: SparseEntityStore;
    expect: (description: string, fn: () => void) => void;
    assertions?: AssertionResult[];  // Will be populated by test executor
    
    // Optional scene system support
    game?: any;  // GameManager - use any to avoid circular dependency
    scene?: any; // Scene - for single-scene tests with metadata
}

export interface VisualTestDefinition {
    arrange?: (ctx: VisualTestContext) => void | Promise<void>;
    act: (ctx: VisualTestContext) => void | Promise<void>;
    assert?: (ctx: VisualTestContext) => void | Promise<void>;
}

/**
 * Mark a test for the visual runner with Arrange-Act-Assert pattern.
 * - arrange: Setup initial state (runs on load, visible before play)
 * - act: Perform actions (runs on play, generates snapshots)
 * - assert: Validate results (runs after act, determines pass/fail)
 */
export function visual(
    name: string, 
    definition: VisualTestDefinition | ((ctx: VisualTestContext) => void | Promise<void>)
) {
    // Normalize definition to AAA format
    const normalized: VisualTestDefinition = typeof definition === 'function' 
        ? { act: definition }
        : definition;
    
    // Register in global array (for both browser and Node.js)
    if (typeof globalThis !== 'undefined') {
        (globalThis as any).visualTests = (globalThis as any).visualTests || [];
        (globalThis as any).visualTests.push({ name, definition: normalized });
    }
    
    // Also register in window if in browser
    if (typeof window !== 'undefined') {
        (window as any).visualTests = (window as any).visualTests || [];
        (window as any).visualTests.push({ name, definition: normalized });
    }

    // Only register as Vitest test if vitest globals are available
    if (typeof (globalThis as any).it === 'function') {
        const it = (globalThis as any).it;
        try {
            it(name, async () => {
                const grid = new LinkedGrid(20, 20);
                const store = new SparseEntityStore();
                const spatial = new SpatialSystem(grid, store);
                
                // For Vitest, expect just throws on failure
                const expect = (description: string, fn: () => void) => {
                    try {
                        fn();
                    } catch (err) {
                        throw new Error(`${description}: ${(err as Error).message}`);
                    }
                };
                
                const ctx = { grid, spatial, store, expect };
                
                // Run all phases for Vitest
                if (normalized.arrange) await normalized.arrange(ctx);
                await normalized.act(ctx);
                if (normalized.assert) await normalized.assert(ctx);
            });
        } catch (e) {
            // Silently ignore if not in a proper test context
        }
    }
}
