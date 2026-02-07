/**
 * Tests for EdgeTransitionSystem and scene edge-based linking.
 *
 * Tests:
 * - Player at east edge moves right -> transitions to east neighbor
 * - Player at west edge moves left -> transitions to west neighbor
 * - Player at north edge moves up -> transitions to north neighbor
 * - Player at south edge moves down -> transitions to south neighbor
 * - No transition when no adjacency defined
 * - Player arrives at opposite edge of target scene
 * - Adjacencies indexed from config
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameRuntime } from '../core/game-runtime';
import { Direction } from '../core/grid/direction';
import { GameLayers } from '../config/layers.config';
import { TestInputProvider } from './test-input-provider';
import { EdgeTransitionSystem } from '../systems/edge-transition.system';
import { PlayerInputSystem } from '../systems/player-input.system';

describe('EdgeTransitionSystem', () => {
  let runtime: GameRuntime;
  let inputProvider: TestInputProvider;

  function createRuntime() {
    inputProvider = new TestInputProvider();

    // Create a 2x2 grid of scenes:
    //   scene-nw | scene-ne
    //   ---------+---------
    //   scene-sw | scene-se
    const config = {
      initialScene: 'scene-nw',
      scenes: [
        {
          id: 'scene-nw',
          width: 5,
          height: 5,
          adjacencies: { east: 'scene-ne', south: 'scene-sw' },
          entities: [
            {
              type: 'player',
              x: 2,
              y: 2,
              layer: GameLayers.ACTORS,
              data: {
                hp: 100,
                maxHp: 100,
                healthState: 'alive',
                isPlayer: true,
                team: 'player',
                inventory: [],
              },
            },
          ],
        },
        {
          id: 'scene-ne',
          width: 5,
          height: 5,
          adjacencies: { west: 'scene-nw', south: 'scene-se' },
          entities: [],
        },
        {
          id: 'scene-sw',
          width: 5,
          height: 5,
          adjacencies: { north: 'scene-nw', east: 'scene-se' },
          entities: [],
        },
        {
          id: 'scene-se',
          width: 5,
          height: 5,
          adjacencies: { north: 'scene-ne', west: 'scene-sw' },
          entities: [],
        },
      ],
    };

    runtime = GameRuntime.fromConfig(config, inputProvider);

    // Add EdgeTransitionSystem and PlayerInputSystem
    const edgeSystem = new EdgeTransitionSystem(runtime.game, inputProvider);
    const playerInputSystem = new PlayerInputSystem(runtime.game, inputProvider);
    runtime.addSystem(playerInputSystem);
    runtime.addSystem(edgeSystem);

    return runtime;
  }

  beforeEach(() => {
    createRuntime();
  });

  it('indexes adjacencies from config', () => {
    const adj = runtime.game.gameState.adjacencies;
    expect(adj.size).toBe(4);
    expect(adj.get('scene-nw')?.get(Direction.RIGHT)).toBe('scene-ne');
    expect(adj.get('scene-nw')?.get(Direction.DOWN)).toBe('scene-sw');
    expect(adj.get('scene-ne')?.get(Direction.LEFT)).toBe('scene-nw');
  });

  it('player at east edge transitions to east neighbor', () => {
    const playerId = runtime.game.gameState.playerEntityId;

    // Move player to east edge (x=4, y=2) in scene-nw
    const spatial = runtime.spatial;
    spatial.move(playerId, 4, 2);
    spatial.commit();

    // Verify player is at east edge
    const pos = spatial.getEntityPosition(playerId);
    expect(pos?.x).toBe(4);

    // Move right
    inputProvider.setMoveDirection(Direction.RIGHT);
    runtime.tick();

    // Player should now be in scene-ne
    const activeScene = runtime.game.sceneManager.getActiveScene();
    expect(activeScene?.id).toBe('scene-ne');

    // Player should be at x=0 (west edge of target scene)
    const newPos = runtime.spatial.getEntityPosition(playerId);
    expect(newPos).toBeDefined();
    expect(newPos!.x).toBe(0);
    expect(newPos!.y).toBe(2);
  });

  it('player at south edge transitions to south neighbor', () => {
    const playerId = runtime.game.gameState.playerEntityId;

    // Move player to south edge (x=2, y=4)
    const spatial = runtime.spatial;
    spatial.move(playerId, 2, 4);
    spatial.commit();

    inputProvider.setMoveDirection(Direction.DOWN);
    runtime.tick();

    // Player should now be in scene-sw
    const activeScene = runtime.game.sceneManager.getActiveScene();
    expect(activeScene?.id).toBe('scene-sw');

    // Player should be at y=0 (north edge of target scene)
    const newPos = runtime.spatial.getEntityPosition(playerId);
    expect(newPos).toBeDefined();
    expect(newPos!.x).toBe(2);
    expect(newPos!.y).toBe(0);
  });

  it('no transition when no adjacency defined', () => {
    const playerId = runtime.game.gameState.playerEntityId;

    // Move player to north edge (x=2, y=0) -- no north adjacency for scene-nw
    const spatial = runtime.spatial;
    spatial.move(playerId, 2, 0);
    spatial.commit();

    inputProvider.setMoveDirection(Direction.UP);
    runtime.tick();

    // Player should stay in scene-nw
    const activeScene = runtime.game.sceneManager.getActiveScene();
    expect(activeScene?.id).toBe('scene-nw');
  });

  it('no transition when player not at edge', () => {
    inputProvider.setMoveDirection(Direction.RIGHT);
    runtime.tick();

    // Player at (2,2) is not at edge - should still be in scene-nw
    const activeScene = runtime.game.sceneManager.getActiveScene();
    expect(activeScene?.id).toBe('scene-nw');
  });

  it('chain transitions: east then south', () => {
    const playerId = runtime.game.gameState.playerEntityId;

    // First: go east
    runtime.spatial.move(playerId, 4, 2);
    runtime.spatial.commit();

    inputProvider.setMoveDirection(Direction.RIGHT);
    runtime.tick();

    expect(runtime.game.sceneManager.getActiveScene()?.id).toBe('scene-ne');

    // Now: move to south edge in scene-ne
    runtime.spatial.move(playerId, 2, 4);
    runtime.spatial.commit();

    inputProvider.setMoveDirection(Direction.DOWN);
    runtime.tick();

    expect(runtime.game.sceneManager.getActiveScene()?.id).toBe('scene-se');
  });
});
