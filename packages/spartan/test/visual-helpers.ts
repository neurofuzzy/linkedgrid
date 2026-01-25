import { describe, it } from 'vitest';
import { LinkedGrid } from '../../grid/linked-grid';
import { SparseEntityStore } from '../entity-store';
import { SpatialSystem } from '../spatial-system';

/**
 * Mark a test for the visual runner.
 * Also registers as a normal Vitest test for CI.
 */
export function visual(name: string, fn: (ctx: any) => void | Promise<void>) {
    // Register in visual test array (only in browser)
    if (typeof window !== 'undefined') {
        (window as any).visualTests = (window as any).visualTests || [];
        (window as any).visualTests.push({ name, fn });
    }

    // Also register as normal Vitest test (runs in CI)
    it(name, async () => {
        const grid = new LinkedGrid(20, 20);
        const store = new SparseEntityStore();
        const spatial = new SpatialSystem(grid, store);
        await fn({ grid, spatial, store });
    });
}
