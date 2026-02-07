/**
 * Edge Transition System - Handles scene transitions when the player
 * walks off the edge of a grid into an adjacent scene.
 *
 * Runs in the input phase AFTER PlayerInputSystem. Checks if the player
 * is at a grid boundary and the last input direction points outward.
 * If an adjacent scene exists for that direction, queues a scene transition.
 *
 * Adjacencies are declared per-scene in the game config and indexed
 * in GameState.adjacencies during loading.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import type { InputProvider } from '../core/input-provider';
import { Direction } from '../core/grid/direction';
import { GameLayers } from '../config/layers.config';

/**
 * EdgeTransitionSystem - Detects player at grid edge and transitions
 * to adjacent scene.
 *
 * Features:
 * - Cardinal direction edge detection (north/south/east/west)
 * - Explicit adjacency lookup from GameState.adjacencies
 * - Player placed at opposite edge of target scene (same parallel coordinate)
 * - Clamping to target scene bounds
 *
 * @system
 * @reactsTo Player position + input direction at grid edge
 * @modifies Scene transition via GameManager.movePlayerToScene()
 */
export class EdgeTransitionSystem extends BaseReactiveSystem {
  readonly executionPhase = 'input' as const;

  constructor(
    private gameManager: GameManager,
    private inputProvider: InputProvider
  ) {
    super();
  }

  update(context: GameContext): void {
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    const pos = context.spatial.getEntityPosition(playerId);
    if (!pos) return;

    const dir = this.inputProvider.getMoveDirection();
    if (dir === Direction.NONE) return;

    const grid = context.spatial.grid;

    // Check if player is at edge AND moving outward
    let atEdge = false;
    switch (dir) {
      case Direction.UP:
        atEdge = pos.y === 0;
        break;
      case Direction.DOWN:
        atEdge = pos.y === grid.height - 1;
        break;
      case Direction.LEFT:
        atEdge = pos.x === 0;
        break;
      case Direction.RIGHT:
        atEdge = pos.x === grid.width - 1;
        break;
    }

    if (!atEdge) return;

    // Look up adjacent scene
    const activeScene = this.gameManager.sceneManager.getActiveScene();
    if (!activeScene) return;

    const sceneAdjacencies = this.gameManager.gameState.adjacencies.get(activeScene.id);
    if (!sceneAdjacencies) return;

    const neighborSceneId = sceneAdjacencies.get(dir);
    if (!neighborSceneId) return;

    // Get target scene to compute arrival position
    const targetScene = this.gameManager.sceneManager.getScene(neighborSceneId);
    if (!targetScene) return;

    // Compute arrival position: opposite edge, same parallel coordinate
    let arrivalX: number;
    let arrivalY: number;

    switch (dir) {
      case Direction.UP:
        // Moving north: arrive at south edge of target scene
        arrivalX = Math.min(pos.x, targetScene.grid.width - 1);
        arrivalY = targetScene.grid.height - 1;
        break;
      case Direction.DOWN:
        // Moving south: arrive at north edge of target scene
        arrivalX = Math.min(pos.x, targetScene.grid.width - 1);
        arrivalY = 0;
        break;
      case Direction.LEFT:
        // Moving west: arrive at east edge of target scene
        arrivalX = targetScene.grid.width - 1;
        arrivalY = Math.min(pos.y, targetScene.grid.height - 1);
        break;
      case Direction.RIGHT:
        // Moving east: arrive at west edge of target scene
        arrivalX = 0;
        arrivalY = Math.min(pos.y, targetScene.grid.height - 1);
        break;
      default:
        return;
    }

    // Check if arrival cell is blocked
    const arrivalCell = targetScene.grid.cell(arrivalX, arrivalY);
    if (!arrivalCell) return;
    if (arrivalCell.getValue(GameLayers.WALLS) !== undefined) return;

    // Queue scene transition
    this.gameManager.movePlayerToScene(
      neighborSceneId,
      arrivalX,
      arrivalY,
      GameLayers.ACTORS
    );
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      systemType: 'EdgeTransitionSystem',
      description: 'Detects player at grid edge, transitions to adjacent scene',
    };
  }
}
