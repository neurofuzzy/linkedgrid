import { visual } from './visual-helpers';
import { GameLayers } from '../types';

visual('player moves right 3 times', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, GameLayers.ACTORS, { hp: 100 });
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Get player ID from known starting position
        let playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 6, 5);
        spatial.commit();
        
        playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 7, 5);
        spatial.commit();
        
        playerId = spatial.getEntityIdAt(7, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 8, 5);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player at final position (8, 5)', () => {
            const playerId = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS);
            if (playerId === undefined) {
                throw new Error('Expected player at (8, 5)');
            }
        });
        
        expect('Old position (5, 5) cleaned up', () => {
            if (spatial.getEntityIdAt(5, 5, GameLayers.ACTORS) !== undefined) {
                throw new Error('Should be empty');
            }
        });
        
        expect('Old position (6, 5) cleaned up', () => {
            if (spatial.getEntityIdAt(6, 5, GameLayers.ACTORS) !== undefined) {
                throw new Error('Should be empty');
            }
        });
        
        expect('Old position (7, 5) cleaned up', () => {
            if (spatial.getEntityIdAt(7, 5, GameLayers.ACTORS) !== undefined) {
                throw new Error('Should be empty');
            }
        });
    }
});

visual('spawn multiple entities', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 10, 10, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Add entities one at a time to show spawning process
        spatial.spawn('enemy', 12, 10, GameLayers.ACTORS);
        spatial.spawn('enemy', 10, 12, GameLayers.ACTORS);
        spatial.spawn('item', 11, 11, GameLayers.COLLECTIBLES);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player at (10, 10) ACTORS layer', () => {
            const id = spatial.getEntityIdAt(10, 10, GameLayers.ACTORS);
            if (id === undefined) throw new Error('Not found');
            const data = spatial.getEntityData(id);
            if (data?.type !== 'player') throw new Error(`Wrong type: ${data?.type}`);
        });
        
        expect('Enemy at (12, 10) ACTORS layer', () => {
            const id = spatial.getEntityIdAt(12, 10, GameLayers.ACTORS);
            if (id === undefined) throw new Error('Not found');
            const data = spatial.getEntityData(id);
            if (data?.type !== 'enemy') throw new Error(`Wrong type: ${data?.type}`);
        });
        
        expect('Enemy at (10, 12) ACTORS layer', () => {
            const id = spatial.getEntityIdAt(10, 12, GameLayers.ACTORS);
            if (id === undefined) throw new Error('Not found');
            const data = spatial.getEntityData(id);
            if (data?.type !== 'enemy') throw new Error(`Wrong type: ${data?.type}`);
        });
        
        expect('Item at (11, 11) COLLECTIBLES layer', () => {
            const id = spatial.getEntityIdAt(11, 11, GameLayers.COLLECTIBLES);
            if (id === undefined) throw new Error('Not found');
            const data = spatial.getEntityData(id);
            if (data?.type !== 'item') throw new Error(`Wrong type: ${data?.type}`);
        });
    }
});

visual('entity moves in a square', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Helper to get current player position
        const getPlayerId = (x: number, y: number) => 
            spatial.getEntityIdAt(x, y, GameLayers.ACTORS)!;
        
        // Right
        spatial.moveEntity(getPlayerId(5, 5), 6, 5);
        spatial.commit();
        spatial.moveEntity(getPlayerId(6, 5), 7, 5);
        spatial.commit();
        // Down
        spatial.moveEntity(getPlayerId(7, 5), 7, 6);
        spatial.commit();
        spatial.moveEntity(getPlayerId(7, 6), 7, 7);
        spatial.commit();
        // Left
        spatial.moveEntity(getPlayerId(7, 7), 6, 7);
        spatial.commit();
        spatial.moveEntity(getPlayerId(6, 7), 5, 7);
        spatial.commit();
        // Up
        spatial.moveEntity(getPlayerId(5, 7), 5, 6);
        spatial.commit();
        spatial.moveEntity(getPlayerId(5, 6), 5, 5);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player back at start (5, 5)', () => {
            const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
            if (playerId === undefined) {
                throw new Error('Not at starting position');
            }
        });
        
        const positions = [[6, 5], [7, 5], [7, 6], [7, 7], [6, 7], [5, 7], [5, 6]];
        positions.forEach(([x, y]) => {
            expect(`Position (${x}, ${y}) cleaned up`, () => {
                if (spatial.getEntityIdAt(x, y, GameLayers.ACTORS) !== undefined) {
                    throw new Error('Should be empty');
                }
            });
        });
    }
});

visual('projectile hits enemy', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 2, 5, GameLayers.ACTORS);
        spatial.spawn('enemy', 8, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Fire projectile
        const projectileId = spatial.spawn('projectile', 3, 5, GameLayers.EPHEMERALS);
        spatial.commit();
        spatial.moveEntity(projectileId, 4, 5);
        spatial.commit();
        spatial.moveEntity(projectileId, 5, 5);
        spatial.commit();
        spatial.moveEntity(projectileId, 6, 5);
        spatial.commit();
        spatial.moveEntity(projectileId, 7, 5);
        spatial.commit();
        spatial.moveEntity(projectileId, 8, 5);
        spatial.commit();
        
        // Hit! (Rule 7: overlap detection, not collision)
        const enemyId = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS)!;
        spatial.removeEntity(projectileId); // Remove projectile by ID
        spatial.removeEntity(enemyId); // Remove enemy by ID
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player still exists at (2, 5)', () => {
            const playerId = spatial.getEntityIdAt(2, 5, GameLayers.ACTORS);
            if (playerId === undefined) {
                throw new Error('Player removed');
            }
        });
        
        expect('Projectile removed from (8, 5)', () => {
            if (spatial.getEntityIdAt(8, 5, GameLayers.EPHEMERALS) !== undefined) {
                throw new Error('Projectile still exists');
            }
        });
        
        expect('Enemy removed from (8, 5)', () => {
            if (spatial.getEntityIdAt(8, 5, GameLayers.ACTORS) !== undefined) {
                throw new Error('Enemy still exists');
            }
        });
        
        expect('Projectile trail cleaned up', () => {
            for (let x = 3; x <= 7; x++) {
                if (spatial.getEntityIdAt(x, 5, GameLayers.EPHEMERALS) !== undefined) {
                    throw new Error(`Trail at (${x}, 5) not cleaned`);
                }
            }
        });
    }
});

visual('multiple layers at same cell', {
    arrange: ({ spatial }) => {
        spatial.spawn('item', 11, 10, GameLayers.COLLECTIBLES);
        spatial.spawn('player', 8, 10, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Get player ID and move toward item
        let playerId = spatial.getEntityIdAt(8, 10, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 9, 10);
        spatial.commit();
        
        playerId = spatial.getEntityIdAt(9, 10, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 10, 10);
        spatial.commit();
        
        playerId = spatial.getEntityIdAt(10, 10, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 11, 10);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Item at (11, 10) COLLECTIBLES layer', () => {
            const itemId = spatial.getEntityIdAt(11, 10, GameLayers.COLLECTIBLES);
            if (itemId === undefined) {
                throw new Error('Not found');
            }
        });
        
        expect('Player at (11, 10) ACTORS layer', () => {
            const playerId = spatial.getEntityIdAt(11, 10, GameLayers.ACTORS);
            if (playerId === undefined) {
                throw new Error('Not found');
            }
        });
        
        expect('Item is correct type', () => {
            const itemId = spatial.getEntityIdAt(11, 10, GameLayers.COLLECTIBLES);
            const itemData = spatial.getEntityData(itemId!);
            if (itemData?.type !== 'item') {
                throw new Error(`Got ${itemData?.type}`);
            }
        });
        
        expect('Player is correct type', () => {
            const playerId = spatial.getEntityIdAt(11, 10, GameLayers.ACTORS);
            const playerData = spatial.getEntityData(playerId!);
            if (playerData?.type !== 'player') {
                throw new Error(`Got ${playerData?.type}`);
            }
        });
    }
});

visual('convoy movement: adjacent entities move together', {
    arrange: ({ spatial }) => {
        // Set up a line of units
        spatial.spawn('unit', 5, 5, GameLayers.ACTORS);
        spatial.spawn('unit', 6, 5, GameLayers.ACTORS);
        spatial.spawn('unit', 7, 5, GameLayers.ACTORS);
        spatial.spawn('unit', 8, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // All units move right simultaneously
        spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
        spatial.move(6, 5, 7, 5, GameLayers.ACTORS);
        spatial.move(7, 5, 8, 5, GameLayers.ACTORS);
        spatial.move(8, 5, 9, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Unit moved from (5, 5) to (6, 5)', () => {
            const id = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
            if (id === undefined) {
                throw new Error('No unit at (6, 5)');
            }
            const data = spatial.getEntityData(id);
            if (data?.type !== 'unit') {
                throw new Error(`Wrong type: ${data?.type}`);
            }
        });
        
        expect('Unit moved from (6, 5) to (7, 5)', () => {
            const id = spatial.getEntityIdAt(7, 5, GameLayers.ACTORS);
            if (id === undefined) {
                throw new Error('No unit at (7, 5)');
            }
        });
        
        expect('Unit moved from (7, 5) to (8, 5)', () => {
            const id = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS);
            if (id === undefined) {
                throw new Error('No unit at (8, 5)');
            }
        });
        
        expect('Unit moved from (8, 5) to (9, 5)', () => {
            const id = spatial.getEntityIdAt(9, 5, GameLayers.ACTORS);
            if (id === undefined) {
                throw new Error('No unit at (9, 5)');
            }
        });
        
        expect('Original position (5, 5) cleaned up', () => {
            if (spatial.getEntityIdAt(5, 5, GameLayers.ACTORS) !== undefined) {
                throw new Error('Position not cleaned up');
            }
        });
    }
});
