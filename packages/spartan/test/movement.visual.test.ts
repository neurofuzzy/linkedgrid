import { visual } from './visual-helpers';

visual('player moves right 3 times', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, 1, { hp: 100 });
    },
    act: ({ spatial }) => {
        spatial.move(5, 5, 6, 5, 1);
        spatial.commit();
        spatial.move(6, 5, 7, 5, 1);
        spatial.commit();
        spatial.move(7, 5, 8, 5, 1);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player at final position (8, 5)', () => {
            const playerId = spatial.getEntityIdAt(8, 5, 1);
            if (playerId === undefined) {
                throw new Error('Expected player at (8, 5)');
            }
        });
        
        expect('Old position (5, 5) cleaned up', () => {
            if (spatial.getEntityIdAt(5, 5, 1) !== undefined) {
                throw new Error('Should be empty');
            }
        });
        
        expect('Old position (6, 5) cleaned up', () => {
            if (spatial.getEntityIdAt(6, 5, 1) !== undefined) {
                throw new Error('Should be empty');
            }
        });
        
        expect('Old position (7, 5) cleaned up', () => {
            if (spatial.getEntityIdAt(7, 5, 1) !== undefined) {
                throw new Error('Should be empty');
            }
        });
    }
});

visual('spawn multiple entities', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 10, 10, 1);
    },
    act: ({ spatial }) => {
        // Add entities one at a time to show spawning process
        spatial.spawn('enemy', 12, 10, 1);
        spatial.spawn('enemy', 10, 12, 1);
        spatial.spawn('item', 11, 11, 2);
    },
    assert: ({ spatial, expect }) => {
        expect('Player at (10, 10) layer 1', () => {
            const id = spatial.getEntityIdAt(10, 10, 1);
            if (id === undefined) throw new Error('Not found');
            const data = spatial.getEntityData(id);
            if (data?.type !== 'player') throw new Error(`Wrong type: ${data?.type}`);
        });
        
        expect('Enemy at (12, 10) layer 1', () => {
            const id = spatial.getEntityIdAt(12, 10, 1);
            if (id === undefined) throw new Error('Not found');
            const data = spatial.getEntityData(id);
            if (data?.type !== 'enemy') throw new Error(`Wrong type: ${data?.type}`);
        });
        
        expect('Enemy at (10, 12) layer 1', () => {
            const id = spatial.getEntityIdAt(10, 12, 1);
            if (id === undefined) throw new Error('Not found');
            const data = spatial.getEntityData(id);
            if (data?.type !== 'enemy') throw new Error(`Wrong type: ${data?.type}`);
        });
        
        expect('Item at (11, 11) layer 2', () => {
            const id = spatial.getEntityIdAt(11, 11, 2);
            if (id === undefined) throw new Error('Not found');
            const data = spatial.getEntityData(id);
            if (data?.type !== 'item') throw new Error(`Wrong type: ${data?.type}`);
        });
    }
});

visual('entity moves in a square', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, 1);
    },
    act: ({ spatial }) => {
        // Right
        spatial.move(5, 5, 6, 5, 1);
        spatial.commit();
        spatial.move(6, 5, 7, 5, 1);
        spatial.commit();
        // Down
        spatial.move(7, 5, 7, 6, 1);
        spatial.commit();
        spatial.move(7, 6, 7, 7, 1);
        spatial.commit();
        // Left
        spatial.move(7, 7, 6, 7, 1);
        spatial.commit();
        spatial.move(6, 7, 5, 7, 1);
        spatial.commit();
        // Up
        spatial.move(5, 7, 5, 6, 1);
        spatial.commit();
        spatial.move(5, 6, 5, 5, 1);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player back at start (5, 5)', () => {
            const playerId = spatial.getEntityIdAt(5, 5, 1);
            if (playerId === undefined) {
                throw new Error('Not at starting position');
            }
        });
        
        const positions = [[6, 5], [7, 5], [7, 6], [7, 7], [6, 7], [5, 7], [5, 6]];
        positions.forEach(([x, y]) => {
            expect(`Position (${x}, ${y}) cleaned up`, () => {
                if (spatial.getEntityIdAt(x, y, 1) !== undefined) {
                    throw new Error('Should be empty');
                }
            });
        });
    }
});

visual('projectile hits enemy', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 2, 5, 1);
        spatial.spawn('enemy', 8, 5, 1);
    },
    act: ({ spatial }) => {
        // Fire projectile
        spatial.spawn('projectile', 3, 5, 2);
        spatial.move(3, 5, 4, 5, 2);
        spatial.commit();
        spatial.move(4, 5, 5, 5, 2);
        spatial.commit();
        spatial.move(5, 5, 6, 5, 2);
        spatial.commit();
        spatial.move(6, 5, 7, 5, 2);
        spatial.commit();
        spatial.move(7, 5, 8, 5, 2);
        spatial.commit();
        
        // Hit! (Rule 7: overlap detection, not collision)
        spatial.remove(8, 5, 2); // Remove projectile
        spatial.remove(8, 5, 1); // Remove enemy
    },
    assert: ({ spatial, expect }) => {
        expect('Player still exists at (2, 5)', () => {
            const playerId = spatial.getEntityIdAt(2, 5, 1);
            if (playerId === undefined) {
                throw new Error('Player removed');
            }
        });
        
        expect('Projectile removed from (8, 5)', () => {
            if (spatial.getEntityIdAt(8, 5, 2) !== undefined) {
                throw new Error('Projectile still exists');
            }
        });
        
        expect('Enemy removed from (8, 5)', () => {
            if (spatial.getEntityIdAt(8, 5, 1) !== undefined) {
                throw new Error('Enemy still exists');
            }
        });
        
        expect('Projectile trail cleaned up', () => {
            for (let x = 3; x <= 7; x++) {
                if (spatial.getEntityIdAt(x, 5, 2) !== undefined) {
                    throw new Error(`Trail at (${x}, 5) not cleaned`);
                }
            }
        });
    }
});

visual('multiple layers at same cell', {
    arrange: ({ spatial }) => {
        spatial.spawn('item', 11, 10, 1);
        spatial.spawn('player', 8, 10, 2);
    },
    act: ({ spatial }) => {
        // Player walks onto the item
        spatial.move(8, 10, 9, 10, 2);
        spatial.commit();
        spatial.move(9, 10, 10, 10, 2);
        spatial.commit();
        spatial.move(10, 10, 11, 10, 2);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Item at (11, 10) layer 1', () => {
            const itemId = spatial.getEntityIdAt(11, 10, 1);
            if (itemId === undefined) {
                throw new Error('Not found');
            }
        });
        
        expect('Player at (11, 10) layer 2', () => {
            const playerId = spatial.getEntityIdAt(11, 10, 2);
            if (playerId === undefined) {
                throw new Error('Not found');
            }
        });
        
        expect('Item is correct type', () => {
            const itemId = spatial.getEntityIdAt(11, 10, 1);
            const itemData = spatial.getEntityData(itemId!);
            if (itemData?.type !== 'item') {
                throw new Error(`Got ${itemData?.type}`);
            }
        });
        
        expect('Player is correct type', () => {
            const playerId = spatial.getEntityIdAt(11, 10, 2);
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
        spatial.spawn('unit', 5, 5, 1);
        spatial.spawn('unit', 6, 5, 1);
        spatial.spawn('unit', 7, 5, 1);
        spatial.spawn('unit', 8, 5, 1);
    },
    act: ({ spatial }) => {
        // All units move right simultaneously
        spatial.move(5, 5, 6, 5, 1);
        spatial.move(6, 5, 7, 5, 1);
        spatial.move(7, 5, 8, 5, 1);
        spatial.move(8, 5, 9, 5, 1);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Unit moved from (5, 5) to (6, 5)', () => {
            const id = spatial.getEntityIdAt(6, 5, 1);
            if (id === undefined) {
                throw new Error('No unit at (6, 5)');
            }
            const data = spatial.getEntityData(id);
            if (data?.type !== 'unit') {
                throw new Error(`Wrong type: ${data?.type}`);
            }
        });
        
        expect('Unit moved from (6, 5) to (7, 5)', () => {
            const id = spatial.getEntityIdAt(7, 5, 1);
            if (id === undefined) {
                throw new Error('No unit at (7, 5)');
            }
        });
        
        expect('Unit moved from (7, 5) to (8, 5)', () => {
            const id = spatial.getEntityIdAt(8, 5, 1);
            if (id === undefined) {
                throw new Error('No unit at (8, 5)');
            }
        });
        
        expect('Unit moved from (8, 5) to (9, 5)', () => {
            const id = spatial.getEntityIdAt(9, 5, 1);
            if (id === undefined) {
                throw new Error('No unit at (9, 5)');
            }
        });
        
        expect('Original position (5, 5) cleaned up', () => {
            if (spatial.getEntityIdAt(5, 5, 1) !== undefined) {
                throw new Error('Position not cleaned up');
            }
        });
    }
});
