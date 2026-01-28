import type { GameSystem, GameContext } from '../types.js';
import type { GameManager } from '../game-manager.js';
import { GameLayers } from '../layers/types.js';
import { isPlayer, isDoor, hasInventory } from '../entities/trait-guards.js';
import { Direction } from '../../grid/direction.js';

/**
 * DoorSystem - Handles door unlocking with keys.
 *
 * Checks adjacent cells to players for locked doors.
 * If player has matching key, unlocks door BEFORE movement happens.
 * This allows instant door unlocking when walking into doors.
 *
 * Used for:
 * - Locked doors requiring keys
 * - Puzzle barriers
 * - Gated progression
 *
 * @example
 * ```typescript
 * const doorSystem = new DoorSystem(gameManager);
 * gameLoop.addSystem(doorSystem);
 * ```
 */
export class DoorSystem implements GameSystem {
  constructor(private gameManager: GameManager) {}

  /**
   * Update called by GameLoop each tick.
   *
   * Checks all adjacent cells to players for locked doors.
   * Unlocks doors if player has matching key.
   * Runs BEFORE PlayerInputSystem so doors are unlocked before movement.
   */
  update({ spatial }: GameContext): void {
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    // Get player data
    const playerData = spatial.getEntityData(playerId);
    if (!playerData || !isPlayer(playerData) || !hasInventory(playerData)) {
      return;
    }

    // Get player position
    const playerPos = spatial.getEntityPosition(playerId);
    if (!playerPos) return;

    // Get player's cell
    const playerCell = spatial.grid.cell(playerPos.x, playerPos.y);
    if (!playerCell) return;

    // Check all 4 adjacent cells for locked doors
    const directions = [Direction.UP, Direction.DN, Direction.LT, Direction.RT];
    
    for (const dir of directions) {
      const adjacentCell = playerCell.neighbor(dir);
      if (!adjacentCell) continue;

      // Check if there's a door on the WALLS layer
      const doorEntityId = adjacentCell.getValue(GameLayers.WALLS);
      if (!doorEntityId) continue;

      const doorData = spatial.getEntityData(doorEntityId);
      if (!doorData || !isDoor(doorData)) continue;

      // If door is locked and player has key, unlock it
      if (doorData.isLocked && playerData.inventory.includes(doorData.requiredKey)) {
        // Unlock door
        this.gameManager.gameState.entityStore.setData(doorData.id, {
          isLocked: false,
        });

        // Remove door from WALLS layer (clears BLOCKING mask)
        spatial.remove(adjacentCell.x, adjacentCell.y, GameLayers.WALLS);

        // Spawn open door visual on FLOOR layer
        spatial.spawn('open-door', adjacentCell.x, adjacentCell.y, GameLayers.FLOOR, {
          color: doorData.color,
        });
      }
    }
  }
}
