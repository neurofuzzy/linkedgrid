import type { GameSystem, GameContext } from '../types.js';
import type { GameManager } from '../game-manager.js';
import { GameLayers } from '../layers/types.js';
import { isPlayer, isDoor, hasInventory } from '../entities/trait-guards.js';

/**
 * DoorSystem - Handles door unlocking with keys.
 *
 * Detects when a player overlaps with a locked door and:
 * 1. Checks if player has the required key in inventory
 * 2. Unlocks the door if key is present
 * 3. Removes door from WALLS layer (making it walkable)
 * 4. Spawns an "open door" visual on FLOOR layer
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
   * Processes all overlaps between players and doors.
   */
  update({ overlaps, spatial }: GameContext): void {
    for (const overlap of overlaps) {
      let playerData = null;
      let doorData = null;

      // Iterate over entity IDs in this overlap
      for (const entityId of overlap.entityIds) {
        const entity = spatial.getEntityData(entityId);
        if (!entity) continue;

        // Check if this is a player with inventory
        if (isPlayer(entity) && hasInventory(entity)) {
          playerData = entity;
        }

        // Check if this is a door
        if (isDoor(entity)) {
          doorData = entity;
        }
      }

      // If we have both a player and a locked door
      if (playerData && doorData && doorData.isLocked) {
        // Check if player has the required key
        const hasKey = playerData.inventory.includes(doorData.requiredKey);

        if (hasKey) {
          // Unlock door
          this.gameManager.gameState.entityStore.setData(doorData.id, {
            isLocked: false,
          });

          // Get door position
          const pos = spatial.getEntityPosition(doorData.id);
          if (pos) {
            // Remove door from WALLS layer (makes it walkable)
            spatial.remove(pos.x, pos.y, GameLayers.WALLS);

            // Spawn open door visual on FLOOR layer
            spatial.spawn('open-door', pos.x, pos.y, GameLayers.FLOOR, {
              color: doorData.color,
            });
          }
        }
      }
    }
  }
}
