/**
 * @brief Gate state management system.
 * 
 * Reacts to signal changes on gate entities (receivedSignal trait).
 * Opens gates when receiving ON signal, closes when OFF.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import { GameLayers } from '../config/layers.config';
import { isGate } from '../traits/trait-guards';

/**
 * GateSystem - Manages gate open/close behavior based on signal state.
 * 
 * Logic simplified:
 * - SignalSystem sets `receivedSignal` on gate entities.
 * - GateSystem reacts to `receivedSignal` by moving gates to correct layer.
 *   - receivedSignal=TRUE  -> FLOOR layer (Open)
 *   - receivedSignal=FALSE -> WALLS layer (Closed)
 */
export class GateSystem extends BaseReactiveSystem {
    constructor(private gameManager: GameManager) {
        super();
    }

    /**
     * Update gate states based on their receivedSignal.
     */
    update(context: GameContext): void {
        // Process all gates
        for (const [entityId, pos] of context.spatial.getAllPositions()) {
            const data = context.spatial.getEntityData(entityId);
            if (!data || !isGate(data)) continue;

            const shouldBeOpen = data.receivedSignal === true;
            const isOpen = pos.layer !== GameLayers.WALLS; // Open = NOT on WALLS layer

            if (shouldBeOpen && !isOpen) {
                this.openGate(context, entityId, pos, data);
            } else if (!shouldBeOpen && isOpen) {
                this.closeGate(context, entityId, pos, data);
            }
        }
    }

    private openGate(
        context: GameContext,
        entityId: number,
        pos: { x: number; y: number; layer: number },
        data: any
    ): void {
        // Remove from store to allow spawnWithId to reuse ID
        this.gameManager.gameState.entityStore.remove(entityId);
        context.spatial.remove(entityId);

        // Restore opacity when open
        let color = data.color || '#ff0000';
        if (color.startsWith('#')) {
            // Strip alpha if present (anything longer than 7)
            if (color.length > 7) {
                color = color.substring(0, 7);
            }
        }

        context.spatial.spawnWithId(
            entityId,
            'gate-open',
            pos.x,
            pos.y,
            GameLayers.FLOOR,
            {
                receiverType: 'gate',
                receivedSignal: true,
                color,
                sceneId: data.sceneId,
                // Preserve pendingSignal if it existed (though it shouldn't for this tick)
            }
        );
    }

    private closeGate(
        context: GameContext,
        entityId: number,
        pos: { x: number; y: number; layer: number },
        data: any
    ): void {
        // Remove from store to allow spawnWithId to reuse ID
        this.gameManager.gameState.entityStore.remove(entityId);
        context.spatial.remove(entityId);

        // Make semi-opaque when closed
        let color = data.color || '#ff0000';
        if (color.startsWith('#')) {
            // If standard hex (7), add alpha
            if (color.length === 7) {
                color += '80'; // 50% opacity
            }
        }

        context.spatial.spawnWithId(
            entityId,
            'gate-closed',
            pos.x,
            pos.y,
            GameLayers.WALLS,
            {
                receiverType: 'gate',
                receivedSignal: false,
                color,
                sceneId: data.sceneId,
            }
        );
    }
}
