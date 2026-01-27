import { visual } from './visual-helpers';
import { GameLayers } from '../types';

// Example test with AAA pattern
visual('AAA: entity movement', {
    arrange: ({ spatial }) => {
        // Setup: Spawn initial entities
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.spawn('enemy', 10, 10, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Action: Move player toward enemy
        spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
        spatial.commit();
        spatial.move(6, 5, 7, 5, GameLayers.ACTORS);
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

// Test with intentional failure to demonstrate assertion display
visual('AAA: collision detection (FAIL)', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.spawn('wall', 6, 5, GameLayers.WALLS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Try to move into wall (player and wall on different layers, so this succeeds)
        // This test name says FAIL but it actually succeeds now with proper layer usage
        spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player can overlap wall (different layers)', () => {
            // Player on ACTORS layer can exist at same position as wall on WALLS layer
            const playerIds = spatial.getEntityIdsInCell(6, 5);
            if (playerIds.length < 2) {
                throw new Error('Expected both player and wall at (6, 5)');
            }
        });
        
        expect('Wall still at (6, 5) on WALLS layer', () => {
            const wallId = spatial.getEntityIdAt(6, 5, GameLayers.WALLS);
            if (wallId === undefined) {
                throw new Error('Wall disappeared');
            }
        });
        
        expect('Player at (6, 5) on ACTORS layer', () => {
            const playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
            if (playerId === undefined) {
                throw new Error('Player not at (6, 5)');
            }
        });
    }
});

// Backward compatible: simple function form (all in act phase)
visual('simple movement test', ({ spatial, expect }) => {
    spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    spatial.commit();
    spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
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
