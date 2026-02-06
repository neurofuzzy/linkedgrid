import { describe, it, expect, beforeEach } from 'vitest';

import { Scene } from '../core/scene';
import { GameManager } from '../core/game-manager';
import { GameLoop } from '../core/game-loop';
import { PushSystem } from '../systems/push.system';
import { GameLayers } from '../config/layers.config';

describe('PushSystem', () => {
    // let gameState: GameState;
    let gameManager: GameManager;
    let scene: Scene;
    let gameLoop: GameLoop;
    let pushSystem: PushSystem;

    beforeEach(() => {
        gameManager = new GameManager(); // Handles GameState internally
        // gameState = gameManager.gameState; // Get ref
        scene = gameManager.sceneManager.createScene('test-scene', 10, 10);

        // Create systems
        pushSystem = new PushSystem();

        // Create manual game loop
        gameLoop = new GameLoop(scene.spatial, gameManager);
        gameLoop.addSystem(pushSystem);
    });

    const runTick = () => {
        gameLoop.tick();
    };

    it('pushes a pushable entity into an empty space', () => {
        // Arrange
        const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
            pushStrength: 10,
        });
        const crateId = scene.spatial.spawn('crate', 6, 5, GameLayers.ACTORS, {
            isPushable: true,
            weight: 1,
        });
        scene.spatial.commit();

        // Act: Move player into crate
        scene.spatial.move(playerId, 6, 5);

        // Run loop: PushSystem should see pending move and stage crate move
        runTick();

        // Assert
        const playerPos = scene.spatial.getEntityPosition(playerId);
        const cratePos = scene.spatial.getEntityPosition(crateId);

        expect(playerPos).toEqual({ x: 6, y: 5, layer: GameLayers.ACTORS });
        expect(cratePos).toEqual({ x: 7, y: 5, layer: GameLayers.ACTORS });
    });

    it('prevents push if destination is blocked by wall', () => {
        // Arrange
        const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
            pushStrength: 10,
        });
        const crateId = scene.spatial.spawn('crate', 6, 5, GameLayers.ACTORS, {
            isPushable: true,
            weight: 1,
        });
        scene.spatial.spawn('wall', 7, 5, GameLayers.WALLS);
        scene.spatial.commit();

        // Act
        scene.spatial.move(playerId, 6, 5);
        runTick();

        // Assert: No moves committed
        const playerPos = scene.spatial.getEntityPosition(playerId);
        const cratePos = scene.spatial.getEntityPosition(crateId);

        expect(playerPos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });
        expect(cratePos).toEqual({ x: 6, y: 5, layer: GameLayers.ACTORS });
    });

    it('prevents push if pusher is too weak', () => {
        // Arrange
        const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
            pushStrength: 1, // Weak
        });
        const crateId = scene.spatial.spawn('heavy-crate', 6, 5, GameLayers.ACTORS, {
            isPushable: true,
            weight: 10, // Heavy
        });
        scene.spatial.commit();

        // Act
        scene.spatial.move(playerId, 6, 5);
        runTick();

        // Assert: No moves committed
        const playerPos = scene.spatial.getEntityPosition(playerId);
        const cratePos = scene.spatial.getEntityPosition(crateId);

        expect(playerPos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });
        expect(cratePos).toEqual({ x: 6, y: 5, layer: GameLayers.ACTORS });
    });

    it('prevents interactions with non-pushable entities', () => {
        // Arrange
        const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
            pushStrength: 10,
        });
        const npcId = scene.spatial.spawn('npc', 6, 5, GameLayers.ACTORS, {
            isPushable: false, // Not pushable
        });
        scene.spatial.commit();

        // Act
        scene.spatial.move(playerId, 6, 5);
        runTick();

        // Assert: No moves committed (blocked by NPC)
        const playerPos = scene.spatial.getEntityPosition(playerId);
        const npcPos = scene.spatial.getEntityPosition(npcId);

        expect(playerPos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });
        expect(npcPos).toEqual({ x: 6, y: 5, layer: GameLayers.ACTORS });
    });

    it('prevents multi-block chain pushes', () => {
        // Arrange
        const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
            pushStrength: 10,
        });
        const crate1Id = scene.spatial.spawn('crate1', 6, 5, GameLayers.ACTORS, {
            isPushable: true,
            weight: 1,
        });
        const crate2Id = scene.spatial.spawn('crate2', 7, 5, GameLayers.ACTORS, {
            isPushable: true,
            weight: 1,
        });
        scene.spatial.commit();

        // Act
        scene.spatial.move(playerId, 6, 5);
        runTick();

        // Assert: No moves committed (chain blocked)
        const playerPos = scene.spatial.getEntityPosition(playerId);
        const crate1Pos = scene.spatial.getEntityPosition(crate1Id);
        const crate2Pos = scene.spatial.getEntityPosition(crate2Id);

        expect(playerPos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });
        expect(crate1Pos).toEqual({ x: 6, y: 5, layer: GameLayers.ACTORS });
        expect(crate2Pos).toEqual({ x: 7, y: 5, layer: GameLayers.ACTORS });
    });
});
