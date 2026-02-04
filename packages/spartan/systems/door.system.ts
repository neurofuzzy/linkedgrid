/**
 * @brief Manages door states and interactions.
 */
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
 *
 * @system
 * @reactsTo Pending move operations (player moving to door cell)
 * @modifies DoorEntity isLocked state, spawns open-door visual
 *
 * Behavior:
 * - Monitors pending move ops for player on ACTORS layer
 * - Checks destination cell for locked door on WALLS layer
 * - Matches door.requiredKey against player.inventory
 * - Removes locked door from WALLS, spawns open-door on FLOOR
 *
 * @example
 * ```typescript
 * const doorSystem = new DoorSystem(gameManager);
 * gameLoop.addSystem(doorSystem);
 * ```
 */
export class DoorSystem extends BaseReactiveSystem {
  readonly executionPhase = 'pre-commit' as const;

  constructor(private gameManager: GameManager) {
    super();
  }

  /**
   * Update called by GameLoop each tick.
   */
  update({ spatial }: GameContext): void {
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    // Check player data
    const playerData = spatial.getEntityData(playerId);
    if (!playerData || !isPlayer(playerData) || !hasInventory(playerData)) {
      return;
    }

    // Check pending move operations to see if player is trying to move onto a door
    const pendingOps = spatial.getPendingOps();

    for (const op of pendingOps) {
      // Only care about player moves on ACTORS layer
      if (op.type !== 'move' || op.entityId !== playerId || op.layer !== GameLayers.ACTORS) {
        continue;
      }

      // Check destination cell for a locked door
      if (op.toX === undefined || op.toY === undefined) continue;
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