import { LinkedGrid } from '../core/grid';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import type { GameManager } from '../core/game-manager';
import type { Scene } from '../core/scene';

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
  assertions?: AssertionResult[]; // Will be populated by test executor

  // Optional scene system support
  game?: GameManager;
  scene?: Scene;
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
  definition:
    | VisualTestDefinition
    | ((ctx: VisualTestContext) => void | Promise<void>)
) {
  // Normalize definition to AAA format
  const normalized: VisualTestDefinition =
    typeof definition === 'function' ? { act: definition } : definition;

  // Register in global array (for both browser and Node.js)
  if (typeof globalThis !== 'undefined') {
    const global = globalThis as {
      visualTests?: Array<{ name: string; definition: VisualTestDefinition }>;
    };
    global.visualTests = global.visualTests || [];
    global.visualTests.push({ name, definition: normalized });
  }

  // Also register in window if in browser
  if (typeof window !== 'undefined') {
    const win = window as {
      visualTests?: Array<{ name: string; definition: VisualTestDefinition }>;
    };
    win.visualTests = win.visualTests || [];
    win.visualTests.push({ name, definition: normalized });
  }

  // Only register as Vitest test if vitest globals are available
  if (typeof (globalThis as { it?: unknown }).it === 'function') {
    const it = (
      globalThis as { it: (name: string, fn: () => Promise<void>) => void }
    ).it;
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

        const ctx: VisualTestContext = {
          grid,
          spatial,
          store,
          expect,
          game: undefined,
          scene: undefined,
        };

        // Run arrange phase
        if (normalized.arrange) await normalized.arrange(ctx);

        // If game or scene was set up, make ctx.spatial delegate to active scene
        if (ctx.game || ctx.scene) {
          const getActiveSpatial = (): SpatialSystem => {
            if (ctx.game) {
              const activeScene = ctx.game.sceneManager?.getActiveScene();
              if (activeScene) return activeScene.spatial;
            }
            if (ctx.scene) return ctx.scene.spatial;
            return spatial;
          };

          // Replace ctx.spatial with a delegate proxy
          ctx.spatial = new Proxy({} as SpatialSystem, {
            get(_, prop) {
              const activeSpatial = getActiveSpatial();
              const value = activeSpatial[prop as keyof SpatialSystem];

              if (typeof value === 'function') {
                return value.bind(activeSpatial);
              }

              return value;
            },
          });
        }

        // Run act and assert phases
        await normalized.act(ctx);
        if (normalized.assert) await normalized.assert(ctx);
      });
    } catch (err) {
      console.debug('Error registering visual test:', err);
      // Silently ignore if not in a proper test context
    }
  }
}
