/**
 * @brief Manages entity teleportation.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { TeleporterData } from '../entities/entity.types';
import type { GameManager } from '../core/game-manager';
import type { SpatialSystem } from '../core/spatial-system';
import { isPlayer, isTeleporter } from '../traits/trait-guards';

type TeleporterState = 'ready' | 'inactive';

/**
 * TeleporterSystem - Handles player teleportation between scenes.
 *
 * Manages teleporter pads that transport the player to different scenes.
 * Uses state tracking to prevent immediate re-teleportation loops.
 *
 * @system
 * @reactsTo Entity overlaps (player + teleporter)
 * @modifies TeleporterEntity state, triggers GameManager.movePlayerToScene
 *
 * Behavior:
 * - Detects player overlap with ready teleporter
 * - Triggers scene transition via GameManager
 * - Sets source and destination teleporters to 'inactive'
 * - Reactivates teleporters when player moves away
 *
 * @example
 * ```typescript
 * const teleporterSystem = new TeleporterSystem(gameManager);
 * gameLoop.addSystem(teleporterSystem);
 * ```
 */
export class TeleporterSystem extends BaseReactiveSystem {
  constructor(private gameManager: GameManager) {
    super();
  }

  update(context: GameContext): void {
    const { overlaps, spatial } = context;
    const playerId = this.gameManager.gameState.playerEntityId;

    if (playerId === 0) return;

    for (const overlap of overlaps) {
      let playerFound = false;
      let teleporterEntity: TeleporterData | null = null;
      let teleporterId: number | null = null;

      for (const entityId of overlap.entityIds) {
        const entityData = spatial.getEntityData(entityId);
        if (!entityData) continue;

        if (isPlayer(entityData) && entityId === playerId) {
          playerFound = true;
        }

        if (isTeleporter(entityData)) {
          teleporterEntity = entityData;
          teleporterId = entityId;
        }
      }

      if (playerFound && teleporterEntity && teleporterId) {
        this.handlePlayerTeleporterOverlap(
          teleporterId,
          teleporterEntity,
          spatial as unknown as SpatialSystem
        );
      }
    }

    this.updateTeleporterStates(spatial as unknown as SpatialSystem, playerId);
  }

  private handlePlayerTeleporterOverlap(
    teleporterId: number,
    teleporter: TeleporterData,
    _spatial: SpatialSystem
  ): void {
    const state = (teleporter.teleporterState as TeleporterState) || 'ready';
    if (state !== 'ready') return;

    const dest = teleporter.destination;
    if (!dest) return;

    this.gameManager.gameState.entityStore.setData(teleporterId, {
      teleporterState: 'inactive',
    });

    this.gameManager.movePlayerToScene(
      dest.sceneId,
      dest.x,
      dest.y,
      dest.layer
    );

    const destScene = this.gameManager.sceneManager.getScene(dest.sceneId);
    if (destScene) {
      const destCell = destScene.grid.cell(dest.x, dest.y);
      if (destCell) {
        for (let layer = 0; layer < 8; layer++) {
          const entityId = destCell.values[layer];
          if (entityId) {
            const entityData =
              this.gameManager.gameState.entityStore.getData(entityId);
            if (entityData && isTeleporter(entityData)) {
              this.gameManager.gameState.entityStore.setData(entityId, {
                teleporterState: 'inactive',
              });
              break;
            }
          }
        }
      }
    }
  }

  private updateTeleporterStates(spatial: SpatialSystem, playerId: number): void {
    const playerPos = spatial.getEntityPosition(playerId);
    if (!playerPos) return;

    const playerData = this.gameManager.gameState.entityStore.getData(playerId);
    if (!playerData || !isPlayer(playerData)) return;

    // Iterate only entities in the current scene (more efficient than all game entities)
    for (const [entityId, padPos] of spatial.getAllPositions()) {
      const entity = this.gameManager.gameState.entityStore.getData(entityId);

      if (!entity || !isTeleporter(entity) || entity.teleporterState !== 'inactive') {
        continue;
      }

      // Since we're iterating entities in the spatial system (current scene),
      // we just need to check if the player is not on top of this teleporter
      if (padPos.x !== playerPos.x || padPos.y !== playerPos.y) {
        this.gameManager.gameState.entityStore.setData(entityId, {
          teleporterState: 'ready',
        });
      }
    }
  }

  public override getDebugState() {
    return {
      systemType: 'TeleporterSystem',
      note: 'State stored on entity props (teleporterState: ready|inactive)',
    };
  }
}