import type { GameSystem, GameContext } from '../types.js';
import type { GameManager } from '../game-manager.js';
import { isPlayer, isCollectible, hasInventory } from '../entities/trait-guards.js';

/**
 * CollectionSystem - Handles picking up collectible items.
 *
 * Detects when a player overlaps with a collectible entity and:
 * 1. Adds the collectible to the player's inventory
 * 2. Removes the collectible from the grid
 *
 * Used for:
 * - Picking up keys
 * - Collecting items
 * - Gathering resources
 *
 * @example
 * ```typescript
 * const collectionSystem = new CollectionSystem(gameManager);
 * gameLoop.addSystem(collectionSystem);
 * ```
 */
export class CollectionSystem implements GameSystem {
  constructor(private gameManager: GameManager) {}

  /**
   * Update called by GameLoop each tick.
   *
   * Processes all overlaps between players and collectible entities.
   */
  update({ overlaps, spatial }: GameContext): void {
    for (const overlap of overlaps) {
      let playerData = null;
      let collectibleData = null;

      // Find the first player and first collectible in the overlap
      for (const entityId of overlap.entityIds) {
        const entity = spatial.getEntityData(entityId);
        if (!entity) continue;

        // Check if this is a player with inventory
        if (!playerData && isPlayer(entity) && hasInventory(entity)) {
          playerData = entity;
        }

        // Check if this is a collectible
        if (!collectibleData && isCollectible(entity)) {
          collectibleData = entity;
        }

        // If we have found both, we can stop searching
        if (playerData && collectibleData) {
          break;
        }
      }

      // If we have both a player with inventory and a collectible
      if (playerData && collectibleData) {
        // Add collectible to player's inventory
        const updatedInventory = [...playerData.inventory, collectibleData.collectibleId];

        // Update player data in entity store
        this.gameManager.gameState.entityStore.setData(playerData.id, {
          inventory: updatedInventory,
        });

        // Remove collectible from grid
        spatial.remove(collectibleData.id);
      }
    }
  }
}
