import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';
import { NPCMovementSystem } from '../systems/npc-movement.system';
import { GameLoop } from '../core/game-loop';
import { spawnPlayer, spawnPathNode } from '../entities/spawn-helpers';
import { hasNPCMovement } from '../traits/trait-guards';

/**
 * Visual tests for NPC Guard Mode.
 */

visual('guard: NPC patrols when player is far', {
    arrange: ({ spatial }) => {
        // Create a linear path
        spawnPathNode(spatial, 5, 10);
        spawnPathNode(spatial, 6, 10);
        spawnPathNode(spatial, 7, 10);

        // Spawn player far away
        spawnPlayer(spatial, 20, 20, {
            hp: 100,
            maxHp: 100,
            damage: 10,
            sceneId: 'test-scene',
            inventory: [],
        });

        // Spawn guard on path
        spatial.spawn('guard', 5, 10, GameLayers.ACTORS, {
            movementMode: 'guard',
            speed: 1,
            triggerRange: 5,
            giveUpRange: 10,
        });

        spatial.commit();
    },
    act: ({ spatial }) => {
        const npcMovementSystem = new NPCMovementSystem();
        const gameLoop = new GameLoop(spatial);
        gameLoop.addSystem(npcMovementSystem);

        // Run ticks - guard should patrol normally (move along path)
        for (let i = 0; i < 5; i++) {
            gameLoop.tick();
        }
    },
    assert: ({ spatial, expect }) => {
        expect('NPC moved from start (patrolling)', () => {
            const npcAtStart = spatial.getEntityIdAt(5, 10, GameLayers.ACTORS);
            if (npcAtStart !== undefined) {
                const data = spatial.getEntityData(npcAtStart);
                if (data && hasNPCMovement(data) && data.movementMode === 'guard') {
                    throw new Error('Guard should have moved while patrolling');
                }
            }
        });
    },
});

visual('guard: NPC intercepts player when close', {
    arrange: ({ spatial }) => {
        // Create a U-shaped path
        // (5,10) - (6,10) - (7,10)
        //   |                 |
        // (5,11)            (7,11) <--- Closest to player
        //   |                 |
        // (5,12)            (7,12)
        spawnPathNode(spatial, 5, 10);
        spawnPathNode(spatial, 6, 10);
        spawnPathNode(spatial, 7, 10);
        spawnPathNode(spatial, 5, 11);
        spawnPathNode(spatial, 7, 11); // This is closest to (8,11)
        spawnPathNode(spatial, 5, 12);
        spawnPathNode(spatial, 7, 12);

        // Spawn player near the right side of the U
        spawnPlayer(spatial, 9, 11, {
            hp: 100,
            maxHp: 100,
            damage: 10,
            sceneId: 'test-scene',
            inventory: [],
        });

        // Spawn guard at top-left, far from player but within trigger range
        // Distance to player (9,11) from (5,10) is 4+1=5. Trigger is 6.
        spatial.spawn('guard', 5, 10, GameLayers.ACTORS, {
            movementMode: 'guard',
            speed: 1,
            triggerRange: 8,
            giveUpRange: 15,
            pathfindingRange: 20,
        });

        spatial.commit();
    },
    act: ({ spatial }) => {
        const npcMovementSystem = new NPCMovementSystem();
        const gameLoop = new GameLoop(spatial);
        gameLoop.addSystem(npcMovementSystem);

        // Run ticks - guard should detect player, find closest node (7,11), and move there
        // Path: (5,10)->(6,10)->(7,10)->(7,11) = 3 moves
        for (let i = 0; i < 10; i++) {
            gameLoop.tick();
        }
    },
    assert: ({ spatial, expect }) => {
        expect('NPC moved to closest path node to player', () => {
            const closestNodePos = { x: 7, y: 11 };
            const npcId = spatial.getEntityIdAt(closestNodePos.x, closestNodePos.y, GameLayers.ACTORS);

            if (npcId === undefined) {
                // Debug: find where it is
                for (const [id] of spatial.getAllPositions()) {
                    const d = spatial.getEntityData(id);
                    if (d && hasNPCMovement(d)) {
                        const p = spatial.getEntityPosition(id);
                        throw new Error(`Guard not at target (7,11), found at (${p?.x},${p?.y})`);
                    }
                }
                throw new Error('Guard not found');
            }
        });
    },
});
