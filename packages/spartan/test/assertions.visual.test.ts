import { visual } from './visual-helpers';
import { GameLayers } from '../types';
import { isBlocked } from '../layer-helpers';

// Test basic unblocked movement
visual('player explores the room', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.spawn('item', 8, 5, GameLayers.COLLECTIBLES);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Beginning: Start moving toward item
        let playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 6, 5);
        spatial.commit();
        
        playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 7, 5);
        spatial.commit();
        
        // Middle: Reach the item
        playerId = spatial.getEntityIdAt(7, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 8, 5);
        spatial.commit();
        
        // Pause to show overlap
        spatial.commit();
        
        // End: Move away from item
        playerId = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 9, 5);
        spatial.commit();
        
        playerId = spatial.getEntityIdAt(9, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 10, 5);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player moved away to (10, 5)', () => {
            const playerId = spatial.getEntityIdAt(10, 5, GameLayers.ACTORS);
            if (playerId === undefined) {
                throw new Error('Player not at destination');
            }
        });
        
        expect('Item remains at (8, 5)', () => {
            const itemId = spatial.getEntityIdAt(8, 5, GameLayers.COLLECTIBLES);
            if (itemId === undefined) {
                throw new Error('Item should still exist');
            }
        });
    }
});

// Test collision detection with walls
visual('player blocked by walls', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        // Create a wall maze
        spatial.spawn('wall', 6, 5, GameLayers.WALLS);
        spatial.spawn('wall', 6, 6, GameLayers.WALLS);
        spatial.spawn('wall', 6, 7, GameLayers.WALLS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        let playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
        
        // Beginning: Try to move right (blocked)
        spatial.moveEntity(playerId, 6, 5, isBlocked);
        spatial.commit();
        
        // Still at starting position, pause to show blocking
        spatial.commit();
        
        // Middle: Move down instead
        spatial.moveEntity(playerId, 5, 6, isBlocked);
        spatial.commit();
        
        playerId = spatial.getEntityIdAt(5, 6, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 5, 7, isBlocked);
        spatial.commit();
        
        playerId = spatial.getEntityIdAt(5, 7, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 5, 8, isBlocked);
        spatial.commit();
        
        // End: Move right (now unblocked - past the wall column)
        playerId = spatial.getEntityIdAt(5, 8, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 6, 8, isBlocked);
        spatial.commit();
        
        // Move right again
        playerId = spatial.getEntityIdAt(6, 8, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 7, 8, isBlocked);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player navigated around wall to (7, 8)', () => {
            const playerId = spatial.getEntityIdAt(7, 8, GameLayers.ACTORS);
            if (playerId === undefined) {
                throw new Error('Player should be at (7, 8)');
            }
        });
        
        expect('Player not at blocked cell (6, 5)', () => {
            const playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
            if (playerId !== undefined) {
                throw new Error('Player should not have moved through wall');
            }
        });
        
        expect('Starting position cleaned up', () => {
            const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
            if (playerId !== undefined) {
                throw new Error('Should be empty');
            }
        });
    }
});
