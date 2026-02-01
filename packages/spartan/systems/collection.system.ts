import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import { isPlayer, isCollectible, hasInventory } from '../traits/trait-guards';

/**
 * CollectionSystem - Handles picking up collectible items.
 *
 * Processes entity overlaps to detect player/collectible interactions.
 * Adds collected items to player inventory and removes them from the world.
 *
 * @system
 * @reactsTo Entity overlaps (player + collectible)
 * @modifies PlayerEntity inventory, removes CollectibleEntity
 *
 * Behavior:
 * - Scans all overlaps for player + collectible pairs
 * - Appends collectibleId to player's inventory array
 * - Removes collectible entity from spatial system
 * - Only first collectible per overlap is processed
 *
 * @example
 * ```typescript
 * const collectionSystem = new CollectionSystem(gameManager);
 * gameLoop.addSystem(collectionSystem);
 * ```
 */
export class CollectionSystem extends BaseReactiveSystem {
  constructor(private gameManager: GameManager) {
    super();
  }

  update({ overlaps, spatial }: GameContext): void {
    for (const overlap of overlaps) {
      let playerData = null;
      let collectibleData = null;

      for (const entityId of overlap.entityIds) {
        const entity = spatial.getEntityData(entityId);
        if (!entity) continue;

        if (!playerData && isPlayer(entity) && hasInventory(entity)) {
          playerData = entity;
        }

        if (!collectibleData && isCollectible(entity)) {
          collectibleData = entity;
        }

        if (playerData && collectibleData) {
          break;
        }
      }

      if (playerData && collectibleData) {
        const updatedInventory = [...playerData.inventory, collectibleData.collectibleId];

        this.gameManager.gameState.entityStore.setData(playerData.id, {
          inventory: updatedInventory,
        });

        spatial.remove(collectibleData.id);
      }
    }
  }

  public override getDebugState() {
    return {
      systemType: 'CollectionSystem',
      note: 'Stateless system - processes overlaps each tick',
    };
  }
}