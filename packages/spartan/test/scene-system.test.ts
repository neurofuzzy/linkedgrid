import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../game-state';
import { Scene } from '../scene';
import { SceneManager } from '../scene-manager';
import { GameManager } from '../game-manager';
import { SparseEntityStore } from '../entity-store';
import { GameLayers } from '../types';

describe('GameState', () => {
    let gameState: GameState;

    beforeEach(() => {
        gameState = new GameState();
    });

    describe('entity ID generation', () => {
        it('generates unique IDs', () => {
            const id1 = gameState.generateEntityId();
            const id2 = gameState.generateEntityId();
            const id3 = gameState.generateEntityId();

            expect(id1).toBe(1);
            expect(id2).toBe(2);
            expect(id3).toBe(3);
        });

        it('IDs are globally unique across multiple calls', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(gameState.generateEntityId());
            }
            expect(ids.size).toBe(100);
        });
    });

    describe('connections', () => {
        it('adds and retrieves connections', () => {
            gameState.addConnection('teleporter:red', 'room1', 5, 5, 3);
            gameState.addConnection('teleporter:red', 'room2', 10, 10, 3);

            const connections = gameState.getConnections('teleporter:red');
            expect(connections).toHaveLength(2);
            expect(connections[0]).toEqual({ sceneId: 'room1', x: 5, y: 5, layer: 3 });
            expect(connections[1]).toEqual({ sceneId: 'room2', x: 10, y: 10, layer: 3 });
        });

        it('removes all connections for a key', () => {
            gameState.addConnection('switch:A', 'room1', 5, 5, 2);
            gameState.addConnection('switch:A', 'room2', 10, 10, 2);

            gameState.removeConnection('switch:A');

            const connections = gameState.getConnections('switch:A');
            expect(connections).toHaveLength(0);
        });

        it('removes connections for specific scene', () => {
            gameState.addConnection('teleporter:blue', 'room1', 5, 5, 3);
            gameState.addConnection('teleporter:blue', 'room2', 10, 10, 3);
            gameState.addConnection('teleporter:blue', 'room3', 15, 15, 3);

            gameState.removeConnection('teleporter:blue', 'room2');

            const connections = gameState.getConnections('teleporter:blue');
            expect(connections).toHaveLength(2);
            expect(connections.find(c => c.sceneId === 'room2')).toBeUndefined();
        });
    });

    describe('serialization', () => {
        it('serializes and deserializes state', () => {
            gameState.lives = 5;
            gameState.score = 1000;
            gameState.inventory.set('key', 3);
            gameState.inventory.set('coin', 50);
            gameState.upgrades.add('double-jump');
            gameState.flags.set('boss-defeated', true);
            gameState.addConnection('teleporter:red', 'room1', 5, 5, 3);

            const serialized = gameState.serialize();
            const deserialized = GameState.deserialize(serialized);

            expect(deserialized.lives).toBe(5);
            expect(deserialized.score).toBe(1000);
            expect(deserialized.inventory.get('key')).toBe(3);
            expect(deserialized.inventory.get('coin')).toBe(50);
            expect(deserialized.upgrades.has('double-jump')).toBe(true);
            expect(deserialized.flags.get('boss-defeated')).toBe(true);
            expect(deserialized.getConnections('teleporter:red')).toHaveLength(1);
        });
    });
});

describe('EntityStore with ID Generator', () => {
    it('uses provided ID generator', () => {
        const gameState = new GameState();
        const store1 = new SparseEntityStore(() => gameState.generateEntityId());
        const store2 = new SparseEntityStore(() => gameState.generateEntityId());

        const id1 = store1.createId('player');
        const id2 = store2.createId('enemy');
        const id3 = store1.createId('npc');

        expect(id1).toBe(1);
        expect(id2).toBe(2);
        expect(id3).toBe(3);
    });

    it('falls back to internal counter without generator', () => {
        const store = new SparseEntityStore();
        const id1 = store.createId('player');
        const id2 = store.createId('enemy');

        expect(id1).toBe(1);
        expect(id2).toBe(2);
    });
});

describe('Scene', () => {
    let gameState: GameState;
    let scene: Scene;

    beforeEach(() => {
        gameState = new GameState();
        scene = new Scene('test-scene', 10, 10, gameState, { name: 'Test Scene' });
    });

    it('creates scene with correct properties', () => {
        expect(scene.id).toBe('test-scene');
        expect(scene.grid.width).toBe(10);
        expect(scene.grid.height).toBe(10);
        expect(scene.metadata.name).toBe('Test Scene');
    });

    it('uses global entity ID generation', () => {
        const id1 = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        const id2 = scene.spatial.spawn('enemy', 7, 7, GameLayers.ACTORS);
        scene.spatial.commit();

        expect(id1).toBe(1);
        expect(id2).toBe(2);
    });

    it('getPlayerPosition returns null when no player', () => {
        const pos = scene.getPlayerPosition();
        expect(pos).toBeNull();
    });

    it('getPlayerPosition returns position when player in scene', () => {
        const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        scene.spatial.commit();
        gameState.playerEntityId = playerId;

        const pos = scene.getPlayerPosition();
        expect(pos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });
    });

    it('getPlayerPosition returns null when player in different scene', () => {
        gameState.playerEntityId = 999; // Some other entity

        const pos = scene.getPlayerPosition();
        expect(pos).toBeNull();
    });

    describe('serialization', () => {
        it('serializes and deserializes scene', () => {
            // Spawn some entities
            const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS, { hp: 100 });
            scene.spatial.spawn('enemy', 7, 7, GameLayers.ACTORS, { hp: 50 });
            scene.spatial.commit();
            
            // Set some cell data
            const cell = scene.grid.cell(3, 3);
            cell?.setValue(GameLayers.WALLS, 999);

            const serialized = scene.serialize();
            const deserialized = Scene.deserialize(serialized, gameState);

            expect(deserialized.id).toBe('test-scene');
            expect(deserialized.grid.width).toBe(10);
            expect(deserialized.grid.height).toBe(10);

            // Verify entities restored
            const playerData = deserialized.store.getData(playerId);
            expect(playerData?.type).toBe('player');
            expect(playerData?.hp).toBe(100);

            // Verify position tracking restored
            const playerPos = deserialized.spatial.getEntityPosition(playerId);
            expect(playerPos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });

            // Verify cell data restored
            const restoredCell = deserialized.grid.cell(3, 3);
            expect(restoredCell?.getValue(GameLayers.WALLS)).toBe(999);
        });
    });
});

describe('SceneManager', () => {
    let gameState: GameState;
    let manager: SceneManager;

    beforeEach(() => {
        gameState = new GameState();
        manager = new SceneManager(gameState);
    });

    it('creates scenes', () => {
        const scene = manager.createScene('room1', 20, 20, { name: 'Room 1' });

        expect(scene.id).toBe('room1');
        expect(scene.metadata.name).toBe('Room 1');
    });

    it('throws error on duplicate scene ID', () => {
        manager.createScene('room1', 20, 20);

        expect(() => manager.createScene('room1', 10, 10)).toThrow();
    });

    it('sets first scene as active', () => {
        manager.createScene('room1', 20, 20);

        expect(manager.activeId).toBe('room1');
        expect(manager.getActiveScene()?.id).toBe('room1');
    });

    it('retrieves scenes by ID', () => {
        manager.createScene('room1', 20, 20);
        manager.createScene('room2', 30, 30);

        const scene = manager.getScene('room2');
        expect(scene?.grid.width).toBe(30);
    });

    it('switches active scene', () => {
        manager.createScene('room1', 20, 20);
        manager.createScene('room2', 30, 30);

        const success = manager.setActiveScene('room2');
        expect(success).toBe(true);
        expect(manager.activeId).toBe('room2');
    });

    it('returns false when switching to non-existent scene', () => {
        manager.createScene('room1', 20, 20);

        const success = manager.setActiveScene('nonexistent');
        expect(success).toBe(false);
        expect(manager.activeId).toBe('room1');
    });

    it('lists all scene IDs', () => {
        manager.createScene('room1', 20, 20);
        manager.createScene('room2', 30, 30);
        manager.createScene('room3', 40, 40);

        const ids = manager.getAllSceneIds();
        expect(ids).toHaveLength(3);
        expect(ids).toContain('room1');
        expect(ids).toContain('room2');
        expect(ids).toContain('room3');
    });

    it('deletes scenes', () => {
        manager.createScene('room1', 20, 20);
        manager.createScene('room2', 30, 30);

        const success = manager.deleteScene('room1');
        expect(success).toBe(true);
        expect(manager.getScene('room1')).toBeUndefined();
        expect(manager.sceneCount).toBe(1);
    });

    it('updates active scene when deleting active', () => {
        manager.createScene('room1', 20, 20);
        manager.createScene('room2', 30, 30);
        manager.setActiveScene('room1');

        manager.deleteScene('room1');
        expect(manager.activeId).toBe('room2');
    });

    it('ensures entity IDs are unique across scenes', () => {
        const scene1 = manager.createScene('room1', 10, 10);
        const scene2 = manager.createScene('room2', 10, 10);

        const id1 = scene1.spatial.spawn('entity1', 5, 5, GameLayers.ACTORS);
        const id2 = scene2.spatial.spawn('entity2', 5, 5, GameLayers.ACTORS);
        scene1.spatial.commit();
        scene2.spatial.commit();

        expect(id1).not.toBe(id2);
        expect(id1).toBe(1);
        expect(id2).toBe(2);
    });
});

describe('GameManager', () => {
    let game: GameManager;

    beforeEach(() => {
        game = new GameManager();
    });

    it('initializes with game state and scene manager', () => {
        expect(game.gameState).toBeDefined();
        expect(game.sceneManager).toBeDefined();
    });

    it('creates and manages multiple scenes', () => {
        game.sceneManager.createScene('overworld', 100, 100);
        game.sceneManager.createScene('dungeon', 30, 30);

        expect(game.sceneManager.sceneCount).toBe(2);
    });

    describe('player tracking', () => {
        it('returns null when no player spawned', () => {
            game.sceneManager.createScene('room1', 10, 10);

            const scene = game.getPlayerScene();
            const pos = game.getPlayerPosition();

            expect(scene).toBeNull();
            expect(pos).toBeNull();
        });

        it('finds player scene', () => {
            const scene1 = game.sceneManager.createScene('room1', 10, 10);
            game.sceneManager.createScene('room2', 10, 10);

            const playerId = scene1.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
            scene1.spatial.commit();
            game.gameState.playerEntityId = playerId;

            const playerScene = game.getPlayerScene();
            expect(playerScene?.id).toBe('room1');
        });

        it('gets player position with scene ID', () => {
            const scene = game.sceneManager.createScene('room1', 10, 10);

            const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
            scene.spatial.commit();
            game.gameState.playerEntityId = playerId;

            const pos = game.getPlayerPosition();
            expect(pos).toEqual({
                sceneId: 'room1',
                x: 5,
                y: 5,
                layer: GameLayers.ACTORS
            });
        });
    });

    describe('player migration', () => {
        it('moves player between scenes', () => {
            const scene1 = game.sceneManager.createScene('room1', 10, 10);
            const scene2 = game.sceneManager.createScene('room2', 10, 10);

            // Spawn player in room1
            const playerId = scene1.spatial.spawn('player', 5, 5, GameLayers.ACTORS, { hp: 100 });
            scene1.spatial.commit();
            game.gameState.playerEntityId = playerId;

            // Move to room2
            game.movePlayerToScene('room2', 7, 7, GameLayers.ACTORS);
            const success = game.executePendingTransition();
            expect(success).toBe(true);

            // Verify player removed from room1
            const pos1 = scene1.spatial.getEntityPosition(playerId);
            expect(pos1).toBeNull();

            // Verify player in room2
            const pos2 = scene2.spatial.getEntityPosition(playerId);
            expect(pos2).toEqual({ x: 7, y: 7, layer: GameLayers.ACTORS });

            // Verify player data preserved
            const playerData = scene2.store.getData(playerId);
            expect(playerData?.hp).toBe(100);

            // Verify active scene updated
            expect(game.sceneManager.activeId).toBe('room2');
        });

        it('fails when target scene does not exist', () => {
            const scene = game.sceneManager.createScene('room1', 10, 10);
            const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
            scene.spatial.commit();
            game.gameState.playerEntityId = playerId;

            game.movePlayerToScene('nonexistent', 7, 7, GameLayers.ACTORS);
            const success = game.executePendingTransition();
            expect(success).toBe(false);

            // Player should still be in original scene
            const pos = scene.spatial.getEntityPosition(playerId);
            expect(pos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });
        });

        it('fails when target position is occupied', () => {
            const scene1 = game.sceneManager.createScene('room1', 10, 10);
            const scene2 = game.sceneManager.createScene('room2', 10, 10);

            const playerId = scene1.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
            scene1.spatial.commit();
            game.gameState.playerEntityId = playerId;

            // Occupy target position
            scene2.spatial.spawn('obstacle', 7, 7, GameLayers.ACTORS);
            scene2.spatial.commit();

            game.movePlayerToScene('room2', 7, 7, GameLayers.ACTORS);
            const success = game.executePendingTransition();
            expect(success).toBe(false);

            // Player should still be in original scene
            const pos = scene1.spatial.getEntityPosition(playerId);
            expect(pos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });
        });

        it('preserves all player properties during migration', () => {
            const scene1 = game.sceneManager.createScene('room1', 10, 10);
            const scene2 = game.sceneManager.createScene('room2', 10, 10);

            const playerId = scene1.spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
                hp: 100,
                maxHp: 100,
                damage: 10,
                inventory: ['sword', 'shield']
            });
            scene1.spatial.commit();
            game.gameState.playerEntityId = playerId;

            game.movePlayerToScene('room2', 7, 7, GameLayers.ACTORS);
            game.executePendingTransition();

            const playerData = scene2.store.getData(playerId);
            expect(playerData?.hp).toBe(100);
            expect(playerData?.maxHp).toBe(100);
            expect(playerData?.damage).toBe(10);
            expect(playerData?.inventory).toEqual(['sword', 'shield']);
        });
    });

    describe('save/load', () => {
        it('saves and loads complete game state', () => {
            // Set up game state
            game.gameState.lives = 5;
            game.gameState.score = 1500;
            game.gameState.inventory.set('key', 3);

            // Create scenes with entities
            const scene1 = game.sceneManager.createScene('room1', 10, 10);
            const scene2 = game.sceneManager.createScene('room2', 15, 15);

            const playerId = scene1.spatial.spawn('player', 5, 5, GameLayers.ACTORS, { hp: 100 });
            scene1.spatial.commit();
            game.gameState.playerEntityId = playerId;
            scene2.spatial.spawn('enemy', 7, 7, GameLayers.ACTORS, { hp: 50 });
            scene2.spatial.commit();

            game.sceneManager.setActiveScene('room2');

            // Save
            const saveData = game.save();

            // Load into new game
            const loadedGame = GameManager.load(saveData);

            // Verify game state
            expect(loadedGame.gameState.lives).toBe(5);
            expect(loadedGame.gameState.score).toBe(1500);
            expect(loadedGame.gameState.inventory.get('key')).toBe(3);
            expect(loadedGame.gameState.playerEntityId).toBe(playerId);

            // Verify scenes
            expect(loadedGame.sceneManager.sceneCount).toBe(2);
            expect(loadedGame.sceneManager.activeId).toBe('room2');

            // Verify entities
            const loadedScene1 = loadedGame.sceneManager.getScene('room1');
            const playerPos = loadedScene1?.spatial.getEntityPosition(playerId);
            expect(playerPos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });

            const playerData = loadedScene1?.store.getData(playerId);
            expect(playerData?.hp).toBe(100);
        });
    });
});
