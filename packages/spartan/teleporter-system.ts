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
 * @example
 * ```typescript
 * const system = new TeleporterSystem(gameManager);
 * gameLoop.addSystem(system);
 * 
 * // In scene setup:
 * scene.spatial.spawn('teleporter', 10, 10, GameLayers.FLOOR, {
 *   destination: {
 *     sceneId: 'room2',
 *     x: 5,
 *     y: 5,
 *     layer: GameLayers.ACTORS,
 *     destinationPadId: pad2Id
 *   }
 * });
 * ```
 */
export class TeleporterSystem implements GameSystem {
    private states = new Map<number, TeleporterState>();
    
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
        const state = this.states.get(teleporterId) || 'ready';

        if (state !== 'ready') return;

        const teleporter = spatial.getEntityData(teleporterId);
        if (!teleporter) return;

        const dest = teleporter.destination;
        if (!dest) return; // No destination configured

        // Mark source pad inactive to prevent re-triggering in the same tick
        this.states.set(teleporterId, 'inactive');

        // Trigger cross-scene transition
        this.gameManager.movePlayerToScene(
            dest.sceneId,
            dest.x,
            dest.y,
            dest.layer
        );

        // Mark destination pad as inactive (prevent bounce-back)
        if (dest.destinationPadId) {
            this.states.set(dest.destinationPadId, 'inactive');
        }
    }
    
    /**
     * Update teleporter states based on player position.
     * 
     * Inactive pads become ready when player steps off.
     */
    private updateTeleporterStates(spatial: any, playerId: number): void {
        const playerPos = spatial.getEntityPosition(playerId);
        if (!playerPos) return;
        
        // Check all inactive teleporters
        for (const [teleporterId, state] of this.states) {
            if (state === 'inactive') {
                const padPos = spatial.getEntityPosition(teleporterId);
                
                // If player not on pad, re-enable
                // Note: We only check x,y position, not layer (player is on ACTORS, pad is on FLOOR)
                if (!padPos) {
                    this.states.delete(teleporterId);
                    continue;
                }

                if (
                    padPos.x !== playerPos.x ||
                    padPos.y !== playerPos.y
                ) {
                    this.states.set(teleporterId, 'ready');
                }
            }
        }
    }
}
