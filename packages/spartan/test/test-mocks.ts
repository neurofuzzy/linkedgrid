import { vi } from 'vitest';
import type { GameContext, GameManagerContext } from '../core/types';
import type { SpatialSystem } from '../core/spatial-system';

/**
 * Creates a type-safe partial mock of GameContext.
 * 
 * @param overrides Partial GameContext to override defaults
 * @returns Casted GameContext suitable for tests
 */
export function createMockGameContext(overrides: Partial<GameContext> = {}): GameContext {
    const defaultContext: Partial<GameContext> = {
        overlaps: [],
        spatial: createMockSpatial(),
        gameManager: createMockGameManager(),
        tick: 0,
    };

    return { ...defaultContext, ...overrides } as GameContext;
}

/**
 * Creates a type-safe partial mock of SpatialSystem.
 */
export function createMockSpatial(overrides: Partial<SpatialSystem> = {}): GameContext['spatial'] {
    // We explicitly intentionally return a mock that matches the structure of GameContext['spatial']
    // which might be slightly different or a subset of the full SpatialSystem class properties if accessed directly.
    // However, usually they are structurally compatible type-wise.

    const mockSpatial: Partial<GameContext['spatial']> = {
        grid: {
            width: 10,
            height: 10,
            cell: vi.fn(),
            isValid: vi.fn().mockReturnValue(true),
        },
        spawn: vi.fn(),
        spawnWithId: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        removeAt: vi.fn(),
        getEntityPosition: vi.fn(),
        getEntityIdsInCell: vi.fn().mockReturnValue([]),
        commit: vi.fn(),
        getEntityData: vi.fn(),
        getEntityIdAt: vi.fn(),
        getAllPositions: vi.fn().mockReturnValue([][Symbol.iterator]()),
        getEntityIdsInRadius: vi.fn().mockReturnValue([]),
        isBlocked: vi.fn(),
        blocksVision: vi.fn(),
        isWalkable: vi.fn(),
        isAlive: vi.fn().mockReturnValue(true),
        relocate: vi.fn().mockReturnValue(true),
        getPendingOps: vi.fn().mockReturnValue([]),
        cancelMove: vi.fn(),
        onSpawn: vi.fn().mockReturnValue(() => { }),
        onRemove: vi.fn().mockReturnValue(() => { }),
        getPosition: vi.fn(),
        getGrid: vi.fn() as unknown as SpatialSystem['getGrid'], // Often hard to mock fully without a real grid
    };

    return { ...mockSpatial, ...overrides } as GameContext['spatial'];
}

/**
 * Creates a type-safe partial mock of GameManager.
 */
export function createMockGameManager(overrides: Partial<GameManagerContext> = {}): GameManagerContext {
    const mockState: Partial<GameManagerContext['gameState']> = {
        playerEntityId: 0,
        entityStore: {
            getData: vi.fn(),
            setData: vi.fn(),
        }
    };

    const mockManager: Partial<GameManagerContext> = {
        gameState: mockState as GameManagerContext['gameState'],
        movePlayerToScene: vi.fn(),
    };

    return { ...mockManager, ...overrides } as GameManagerContext;
}
