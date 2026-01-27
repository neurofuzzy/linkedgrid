import { visual } from './visual-helpers';
import { GameLayers } from '../types';
import { isBlocked } from '../layer-helpers';

// Test basic unblocked movement
visual('entity movement', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 6, 5);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player moved to (6, 5)', () => {
            const playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
            if (playerId === undefined) {
                throw new Error('Player not at destination');
            }
        });
    }
});

// Test collision detection with walls
visual('collision detection', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.spawn('wall', 6, 5, GameLayers.WALLS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 6, 5, isBlocked);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Movement blocked by wall', () => {
            const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
            if (playerId === undefined) {
                throw new Error('Player moved when blocked');
            }
        });
        
        expect('Player not at blocked cell', () => {
            const playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
            if (playerId !== undefined) {
                throw new Error('Player moved through wall');
            }
        });
    }
});
