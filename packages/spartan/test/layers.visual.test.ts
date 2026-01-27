import { visual } from './visual-helpers';
import { GameLayers } from '../types';
import { blocksVision, getTopmostEntity, isBlocked } from '../layer-helpers';

/**
 * Layer System Visual Tests
 * 
 * These tests demonstrate the Spartan Framework's 8-layer architecture:
 * - Layer semantics and purpose
 * - Layer priority and rendering order
 * - Blocking behavior per layer
 * - Vision blocking
 */

// Test 1: Multi-layer occupancy
visual('Multi-layer occupancy - multiple entities in same cell', {
    arrange: ({ spatial }) => {
        // Spawn entities on different layers at the same position
        spatial.spawn('background', 5, 5, GameLayers.BACKGROUND);
        spatial.spawn('floor', 5, 5, GameLayers.FLOOR);
        spatial.spawn('collectible', 5, 5, GameLayers.COLLECTIBLES);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Add an actor on top
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    assert: ({ grid, spatial, expect }) => {
        const cell = grid.cell(5, 5);
        
        expect('Cell has 4 entities on different layers', () => {
            const backgroundId = cell?.getValue(GameLayers.BACKGROUND);
            const floorId = cell?.getValue(GameLayers.FLOOR);
            const collectibleId = cell?.getValue(GameLayers.COLLECTIBLES);
            const actorId = cell?.getValue(GameLayers.ACTORS);
            
            if (!backgroundId || !floorId || !collectibleId || !actorId) {
                throw new Error('Missing entity on expected layer');
            }
        });
        
        expect('Each entity has correct type', () => {
            if (!cell) throw new Error('Cell not found');
            
            const bgId = cell.getValue(GameLayers.BACKGROUND);
            const floorId = cell.getValue(GameLayers.FLOOR);
            const itemId = cell.getValue(GameLayers.COLLECTIBLES);
            const actorId = cell.getValue(GameLayers.ACTORS);
            
            if (!bgId || !floorId || !itemId || !actorId) {
                throw new Error('Missing entity ID on expected layer');
            }
            
            const bg = spatial.getEntityData(bgId);
            const floor = spatial.getEntityData(floorId);
            const item = spatial.getEntityData(itemId);
            const actor = spatial.getEntityData(actorId);
            
            if (bg?.type !== 'background' || floor?.type !== 'floor' || 
                item?.type !== 'collectible' || actor?.type !== 'player') {
                throw new Error('Entity types do not match expected values');
            }
        });
    }
});

// Test 2: Layer priority rendering
visual('Layer priority - topmost entity selection', {
    arrange: ({ spatial }) => {
        // Spawn entities on various layers at position (7, 7)
        spatial.spawn('floor', 7, 7, GameLayers.FLOOR);
        spatial.spawn('wall', 7, 7, GameLayers.WALLS);
        spatial.spawn('enemy', 7, 7, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Add ephemeral effect on top
        spatial.spawn('explosion', 7, 7, GameLayers.EPHEMERALS);
        spatial.commit();
    },
    assert: ({ grid, spatial, expect }) => {
        const cell = grid.cell(7, 7);
        
        expect('Topmost entity is on EPHEMERALS layer', () => {
            if (!cell) throw new Error('Cell not found');
            const topmostId = getTopmostEntity(cell);
            const entity = spatial.getEntityData(topmostId!);
            
            if (entity?.type !== 'explosion') {
                throw new Error(`Expected explosion, got ${entity?.type}`);
            }
        });
        
        expect('Layer 6 (EPHEMERALS) is highest visible layer with entity', () => {
            if (!cell) throw new Error('Cell not found');
            const explosionId = cell.getValue(GameLayers.EPHEMERALS);
            if (!explosionId) {
                throw new Error('No entity on EPHEMERALS layer');
            }
        });
    }
});

// Test 3: Wall blocking (values and items)
visual('Wall blocking - both terrain and entities block', {
    arrange: ({ spatial, grid }) => {
        // Create walls using values (terrain)
        const cell1 = grid.cell(3, 3);
        if (cell1) cell1.values[GameLayers.WALLS] = 1; // Wall terrain
        
        // Create wall entity (door)
        spatial.spawn('door', 4, 3, GameLayers.WALLS);
        
        // Place player to move
        spatial.spawn('player', 2, 3, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Try to move into wall terrain (should fail)
        spatial.move(2, 3, 3, 3, GameLayers.ACTORS, (cell) => isBlocked(cell, false));
        spatial.commit();
        
        // Try to move into wall entity (should fail)
        spatial.move(2, 3, 4, 3, GameLayers.ACTORS, (cell) => isBlocked(cell, false));
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player did not move into wall terrain', () => {
            const id = spatial.getEntityIdAt(2, 3, GameLayers.ACTORS);
            if (!id) {
                throw new Error('Player moved or disappeared');
            }
        });
        
        expect('Wall terrain blocks movement', () => {
            const movedIntoWall = spatial.getEntityIdAt(3, 3, GameLayers.ACTORS);
            if (movedIntoWall) {
                throw new Error('Player moved through wall terrain');
            }
        });
        
        expect('Wall entity (door) blocks movement', () => {
            const movedIntoDoor = spatial.getEntityIdAt(4, 3, GameLayers.ACTORS);
            if (movedIntoDoor) {
                throw new Error('Player moved through door');
            }
        });
    }
});

// Test 4: Actor blocking
visual('Actor blocking - actors block other actors', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 10, 10, GameLayers.ACTORS);
        spatial.spawn('enemy', 11, 10, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Try to move player into enemy cell (should fail)
        spatial.move(10, 10, 11, 10, GameLayers.ACTORS, (cell) => isBlocked(cell, false));
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player did not move into enemy cell', () => {
            const playerId = spatial.getEntityIdAt(10, 10, GameLayers.ACTORS);
            if (!playerId) {
                throw new Error('Player not at starting position');
            }
        });
        
        expect('Enemy still at original position', () => {
            const enemyId = spatial.getEntityIdAt(11, 10, GameLayers.ACTORS);
            if (!enemyId) {
                throw new Error('Enemy moved or disappeared');
            }
        });
    }
});

// Test 5: Empty floor blocking with game setting
visual('Empty floor blocking - voids block when setting enabled', {
    arrange: ({ spatial, grid }) => {
        // Create floor tiles
        const cell1 = grid.cell(5, 8);
        const cell2 = grid.cell(6, 8);
        
        // Cell 1 has floor (walkable)
        if (cell1) cell1.values[GameLayers.FLOOR] = 1;
        
        // Cell 2 has no floor (void)
        if (cell2) cell2.values[GameLayers.FLOOR] = undefined;
        
        // Place player on floor
        spatial.spawn('player', 5, 8, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // First: Move into void with emptyFloorsBlock=false (should succeed)
        spatial.move(5, 8, 6, 8, GameLayers.ACTORS, (cell) => isBlocked(cell, false));
        spatial.commit();
        
        // Second: Move back to floor
        spatial.move(6, 8, 5, 8, GameLayers.ACTORS);
        spatial.commit();
        
        // Third: Try to move into void with emptyFloorsBlock=true (should fail)
        spatial.move(5, 8, 6, 8, GameLayers.ACTORS, (cell) => isBlocked(cell, true));
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player back at starting position', () => {
            const id = spatial.getEntityIdAt(5, 8, GameLayers.ACTORS);
            if (!id) {
                throw new Error('Player not at (5, 8)');
            }
        });
        
        expect('Void is empty (move blocked when emptyFloorsBlock=true)', () => {
            const id = spatial.getEntityIdAt(6, 8, GameLayers.ACTORS);
            if (id) {
                throw new Error('Player moved into void despite emptyFloorsBlock=true');
            }
        });
    }
});

// Test 6: Collectibles don't block movement
visual('Collectibles non-blocking - player walks over items', {
    arrange: ({ spatial }) => {
        spatial.spawn('coin', 8, 5, GameLayers.COLLECTIBLES);
        spatial.spawn('player', 7, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Move player onto collectible (should succeed)
        spatial.move(7, 5, 8, 5, GameLayers.ACTORS, (cell) => isBlocked(cell, false));
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player moved into cell with collectible', () => {
            const playerId = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS);
            if (!playerId) {
                throw new Error('Player did not move');
            }
        });
        
        expect('Collectible still exists (overlapping)', () => {
            const coinId = spatial.getEntityIdAt(8, 5, GameLayers.COLLECTIBLES);
            if (!coinId) {
                throw new Error('Coin disappeared');
            }
        });
        
        expect('Both entities occupy same cell on different layers', () => {
            const playerId = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS);
            const coinId = spatial.getEntityIdAt(8, 5, GameLayers.COLLECTIBLES);
            
            if (!playerId || !coinId) {
                throw new Error('Entities not overlapping as expected');
            }
        });
    }
});

// Test 7: Vision blocking - only walls block vision
visual('Vision blocking - only WALLS layer blocks vision', {
    arrange: ({ spatial, grid }) => {
        // Create various blocking elements
        const wallCell = grid.cell(10, 5);
        if (wallCell) wallCell.values[GameLayers.WALLS] = 1; // Wall blocks vision
        
        const floorCell = grid.cell(11, 5);
        if (floorCell) floorCell.values[GameLayers.FLOOR] = 1; // Floor doesn't block
        
        spatial.spawn('enemy', 12, 5, GameLayers.ACTORS); // Actor doesn't block vision
        spatial.spawn('coin', 13, 5, GameLayers.COLLECTIBLES); // Collectible doesn't block
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Spawn wall entity
        spatial.spawn('door', 14, 5, GameLayers.WALLS);
        spatial.commit();
    },
    assert: ({ grid, expect }) => {
        expect('Wall terrain blocks vision', () => {
            const cell = grid.cell(10, 5);
            if (!blocksVision(cell)) {
                throw new Error('Wall terrain should block vision');
            }
        });
        
        expect('Wall entity (door) blocks vision', () => {
            const cell = grid.cell(14, 5);
            if (!blocksVision(cell)) {
                throw new Error('Wall entity should block vision');
            }
        });
        
        expect('Floor does not block vision', () => {
            const cell = grid.cell(11, 5);
            if (blocksVision(cell)) {
                throw new Error('Floor should not block vision');
            }
        });
        
        expect('Actor does not block vision', () => {
            const cell = grid.cell(12, 5);
            if (blocksVision(cell)) {
                throw new Error('Actor should not block vision');
            }
        });
        
        expect('Collectible does not block vision', () => {
            const cell = grid.cell(13, 5);
            if (blocksVision(cell)) {
                throw new Error('Collectible should not block vision');
            }
        });
    }
});
