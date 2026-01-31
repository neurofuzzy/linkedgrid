import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import { GameLayers } from "../config/layers.config";
import { isPlayer, isDoor, hasInventory } from '../traits/trait-guards';

/**
 * DoorSystem - Handles door unlocking with keys.
 *
 * Reactively checks player movement intents to unlock doors.
 * When player tries to move onto a locked door and has the key,
 * unlocks the door BEFORE commit validates moves.
 */
export class DoorSystem extends BaseReactiveSystem {
  constructor(private gameManager: GameManager) {
    super();
  }

  /**
   * Update called by GameLoop each tick.
   */
  update({ spatial }: GameContext): void {
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    // Get player data
    const playerData = spatial.getEntityData(playerId);
    if (!playerData || !isPlayer(playerData) || !hasInventory(playerData)) {
      return;
    }

    // Check pending move operations to see if player is trying to move onto a door
    const pendingOps = (spatial as any).getPendingOps();
    
    for (const op of pendingOps) {
      // Only care about player moves on ACTORS layer
      if (op.type !== 'move' || op.entityId !== playerId || op.layer !== GameLayers.ACTORS) {
        continue;
      }

      // Check destination cell for a locked door
      const destCell = spatial.grid.cell(op.toX, op.toY);
      if (!destCell) continue;

      const doorEntityId = destCell.getValue(GameLayers.WALLS);
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
        // spatial.removeAt does not exist in GameContext interface, use spatial.remove if ID known
        // Or access spatial.removeAt via cast if exists
        // Wait, removeAt is method of SpatialSystem?
        // Let's use remove(id)
        spatial.remove(doorData.id);

        // Spawn open door visual on FLOOR layer
        spatial.spawn('open-door', destCell.x, destCell.y, GameLayers.FLOOR, {
          color: doorData.color,
        });
      }
    }
  }

  public override getDebugState() {
    return {
      systemType: 'DoorSystem',
      note: 'Stateless reactive system - checks pending moves each tick',
    };
  }
}