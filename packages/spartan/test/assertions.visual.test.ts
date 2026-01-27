import { visual } from './visual-helpers';
import { GameLayers } from '../types';
import { isBlocked } from '../layer-helpers';

// Example test with AAA pattern
visual('AAA: entity movement', {
    arrange: ({ spatial }) => {
        // Setup: Spawn initial entities
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.spawn('enemy', 10, 10, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Action: Move player toward enemy (using entity-based API)
        let playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 6, 5);
        spatial.commit();
        
        playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 7, 5);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player moved to (7, 5)', () => {
            const ids = spatial.getEntityIdsInCell(7, 5);
            if (ids.length === 0) {
                throw new Error('No entity found');
            }
        });
        
        expect('Entity is player type', () => {
            const ids = spatial.getEntityIdsInCell(7, 5);
            const entity = spatial.getEntityData(ids[0]);
            if (entity?.type !== 'player') {
                throw new Error(`Got '${entity?.type}'`);
            }
        });
        
        expect('Enemy still at (10, 10)', () => {
            const ids = spatial.getEntityIdsInCell(10, 10);
            if (ids.length === 0) {
                throw new Error('Enemy disappeared');
            }
        });
    }
});

// Test blocking logic - movement into walls should be prevented
visual('AAA: collision detection', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.spawn('wall', 6, 5, GameLayers.WALLS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Try to move into wall - should be blocked by isBlocked function
        const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 6, 5, isBlocked);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Movement was blocked by wall', () => {
            // Player should still be at original position (5, 5)
            const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
            if (playerId === undefined) {
                throw new Error('Player moved when it should have been blocked');
            }
        });
        
        expect('Wall still at (6, 5)', () => {
            const wallId = spatial.getEntityIdAt(6, 5, GameLayers.WALLS);
            if (wallId === undefined) {
                throw new Error('Wall disappeared');
            }
        });
        
        expect('Player not at (6, 5)', () => {
            const playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
            if (playerId !== undefined) {
                throw new Error('Player moved through wall');
            }
        });
    }
});

// Backward compatible: simple function form (all in act phase)
visual('simple movement test', ({ spatial, expect }) => {
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    spatial.commit();
    spatial.moveEntity(playerId, 6, 5);
    spatial.commit();
    
    if (expect) {
        expect('Player at (6, 5)', () => {
            const ids = spatial.getEntityIdsInCell(6, 5);
            if (ids.length === 0) {
                throw new Error('Not found');
            }
        });
    } else {
        // Fallback for Vitest without expect
        const ids = spatial.getEntityIdsInCell(6, 5);
        if (ids.length === 0) {
            throw new Error('Expected entity at (6, 5)');
        }
    }
});
