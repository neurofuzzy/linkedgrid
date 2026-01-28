import type { GameSystem, GameContext } from './types.js';
import type { GameManager } from './game-manager.js';

type TeleporterState = 'ready' | 'inactive';

/**
 * TeleporterSystem - Handles teleporter pad mechanics.
 * 
 * Detects player overlaps with teleporter pads and triggers
 * cross-scene transitions. Features:
 * - 1-tick delay (natural from overlap detection timing)
 * - Two-way travel
 * - Reset mechanism (pad inactive until player steps off)
 * 
 * State is stored directly on entity props (teleporterState).
 * Works seamlessly with global entity store architecture.
 * 
 * @example
 * ```typescript
 * const system = new TeleporterSystem(gameManager);
 * gameLoop.addSystem(system);
 * 
 * // In scene setup:
 * scene.spatial.spawn('teleporter', 10, 10, GameLayers.FLOOR, {
 *   sceneId: 'room1',
 *   destination: {
 *     sceneId: 'room2',
 *     x: 5,
 *     y: 5,
 *     layer: GameLayers.ACTORS
 *   }
 * });
 * ```
 */
export class TeleporterSystem implements GameSystem {
    constructor(private gameManager: GameManager) {}
    
    /**
     * Process teleporter overlaps each tick.
     * 
     * Called by GameLoop during system update phase.
     */
    update(context: GameContext): void {
        const { overlaps, spatial } = context;
        const playerId = this.gameManager.gameState.playerEntityId;
        
        if (playerId === 0) return; // No player spawned
        
        // Check each overlap for player + teleporter
        for (const overlap of overlaps) {
            const hasPlayer = overlap.entityIds.includes(playerId);
            const teleporterId = overlap.entityIds.find(id => 
                spatial.getEntityData(id)?.type === 'teleporter'
            );
            
            if (hasPlayer && teleporterId) {
                this.handlePlayerTeleporterOverlap(teleporterId, spatial);
            }
        }
        
        // Check for leaving pads (inactive -> ready)
        this.updateTeleporterStates(spatial, playerId);
    }
    
    /**
     * Handle player overlapping with teleporter pad.
     * 
     * If pad is ready, trigger scene transition and mark destination inactive.
     */
    private handlePlayerTeleporterOverlap(teleporterId: number, spatial: any): void {
        const teleporter = spatial.getEntityData(teleporterId);
        if (!teleporter) return;

        // Check state from entity props (defaults to 'ready')
        const state = (teleporter.teleporterState as TeleporterState) || 'ready';
        if (state !== 'ready') return;

        const dest = teleporter.destination;
        if (!dest) return; // No destination configured

        // Mark source pad inactive to prevent re-triggering in the same tick
        spatial.getEntityData(teleporterId).teleporterState = 'inactive';

        // Trigger cross-scene transition
        this.gameManager.movePlayerToScene(
            dest.sceneId,
            dest.x,
            dest.y,
            dest.layer
        );

        // Mark destination pad as inactive by looking it up in the destination scene
        // This prevents immediate bounce-back when landing on the pad
        const destScene = this.gameManager.sceneManager.getScene(dest.sceneId);
        if (destScene) {
            const destCell = destScene.grid.cell(dest.x, dest.y);
            if (destCell) {
                // Find teleporter entity at destination coordinates
                for (let layer = 0; layer < 8; layer++) {
                    const entityId = destCell.values[layer];
                    if (entityId) {
                        const entityData = this.gameManager.gameState.entityStore.getData(entityId);
                        if (entityData?.type === 'teleporter') {
                            entityData.teleporterState = 'inactive';
                            break;
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Update teleporter states based on player position.
     * 
     * Inactive pads become ready when player steps off.
     * Uses global entity store to check all teleporters across all scenes.
     */
    private updateTeleporterStates(spatial: any, playerId: number): void {
        const playerPos = spatial.getEntityPosition(playerId);
        if (!playerPos) return;
        
        // Get player's current sceneId
        const playerData = this.gameManager.gameState.entityStore.getData(playerId);
        const playerSceneId = playerData?.sceneId;
        if (!playerSceneId) return;
        
        // Check all teleporters in global entity store
        const allEntityIds = this.gameManager.gameState.entityStore.getAllIds();
        for (const entityId of allEntityIds) {
            const entity = this.gameManager.gameState.entityStore.getData(entityId);
            if (!entity || entity.type !== 'teleporter') continue;
            
            // Only check teleporters with inactive state
            if (entity.teleporterState !== 'inactive') continue;
            
            // If teleporter is in same scene as player, check if player stepped off
            if (entity.sceneId === playerSceneId) {
                const padPos = spatial.getEntityPosition(entityId);
                if (padPos) {
                    // If player not on pad, re-enable
                    // Note: We only check x,y position, not layer (player is on ACTORS, pad is on FLOOR)
                    if (
                        padPos.x !== playerPos.x ||
                        padPos.y !== playerPos.y
                    ) {
                        entity.teleporterState = 'ready';
                    }
                }
            }
        }
    }
}
