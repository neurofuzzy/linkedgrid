import type { GameSystem, GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import { GameLayers } from "../core/types";
import { isPlayer, isDoor, hasInventory } from '../traits/trait-guards';

/**
 * DoorSystem - Handles door unlocking with keys.
 *
 * Reactively checks player movement intents to unlock doors.
 * When player tries to move onto a locked door and has the key,
 * unlocks the door BEFORE commit validates moves.
 *
 * This is a reactive system - it responds to player movement intents
 * rather than proactively checking adjacent cells every tick.
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
   * Checks pending move operations to see if player is trying to move onto a locked door.
   * If player has matching key, unlocks door before spatial commit validates moves.
   * Runs AFTER PlayerInputSystem (which stages moves) but BEFORE commit.
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
    const pendingOps = spatial.getPendingOps();
    
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
        spatial.removeAt(destCell.x, destCell.y, GameLayers.WALLS);

        // Spawn open door visual on FLOOR layer
        spatial.spawn('open-door', destCell.x, destCell.y, GameLayers.FLOOR, {
          color: doorData.color,
        });

        // Door is now unlocked - the move will succeed when commit validates
      }
    }
  }

  /**
   * Get debug state for troubleshooting.
   * Useful for understanding system state during development.
   */
  public getDebugState() {
    return {
      systemType: 'DoorSystem',
      note: 'Stateless reactive system - checks pending moves each tick',
    };
  }
}
