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
    assert: ({ spatial }) => {
        // Verify: Player should be at (7, 5)
        const ids = spatial.getEntityIdsInCell(7, 5);
        if (ids.length === 0) {
            throw new Error('Expected player at (7, 5) but found none');
        }
        
        const entity = spatial.getEntityData(ids[0]);
        if (entity?.type !== 'player') {
            throw new Error(`Expected player but got '${entity?.type}'`);
        }
    }
});

// Test with failure
visual('AAA: collision detection (FAIL)', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, 1);
        spatial.spawn('wall', 6, 5, 1);
    },
    act: ({ spatial }) => {
        // Try to move into wall (should this be allowed?)
        spatial.move(5, 5, 6, 5, 1);
    },
    assert: ({ spatial }) => {
        // This will fail: expecting player NOT to move through wall
        const idsAtWall = spatial.getEntityIdsInCell(6, 5);
        if (idsAtWall.length > 1) {
            throw new Error('Player moved through wall - collision not detected!');
        }
    }
});

// Backward compatible: simple function form (all in act phase)
visual('simple movement test', ({ spatial }) => {
    spatial.spawn('player', 5, 5, 1);
    spatial.move(5, 5, 6, 5, 1);
    
    const ids = spatial.getEntityIdsInCell(6, 5);
    if (ids.length === 0) {
        throw new Error('Expected entity at (6, 5)');
    }
});
