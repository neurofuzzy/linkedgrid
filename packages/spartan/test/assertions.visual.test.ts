import { visual } from './visual-helpers';

// Example test with AAA pattern
visual('AAA: entity movement', {
    arrange: ({ spatial }) => {
        // Setup: Spawn initial entities
        spatial.spawn('player', 5, 5, 1);
        spatial.spawn('enemy', 10, 10, 1);
    },
    act: ({ spatial }) => {
        // Action: Move player toward enemy
        spatial.move(5, 5, 6, 5, 1);
        spatial.move(6, 5, 7, 5, 1);
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

// Test with intentional failure to demonstrate assertion display
visual('AAA: collision detection (FAIL)', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, 1);
        spatial.spawn('wall', 6, 5, 1);
    },
    act: ({ spatial }) => {
        // Try to move into wall (this will fail because layer is occupied)
        spatial.move(5, 5, 6, 5, 1);
    },
    assert: ({ spatial, expect }) => {
        expect('Player blocked by wall', () => {
            // Move should have failed, player still at (5, 5)
            const playerIds = spatial.getEntityIdsInCell(5, 5);
            if (playerIds.length === 0) {
                throw new Error('Player should still be at (5, 5)');
            }
        });
        
        expect('Wall still intact at (6, 5)', () => {
            const wallIds = spatial.getEntityIdsInCell(6, 5);
            if (wallIds.length === 0) {
                throw new Error('Wall disappeared');
            }
        });
        
        expect('No overlap at wall position', () => {
            // Should only be wall, not both
            const ids = spatial.getEntityIdsInCell(6, 5);
            if (ids.length > 1) {
                throw new Error('Player moved through wall!');
            }
        });
    }
});

// Backward compatible: simple function form (all in act phase)
visual('simple movement test', ({ spatial, expect }) => {
    spatial.spawn('player', 5, 5, 1);
    spatial.move(5, 5, 6, 5, 1);
    
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
