/**
 * @brief Bollard state management system.
 * 
 * Reacts to signal changes on bollard entities (receivedSignal trait).
 * Opens bollards when receiving ON signal, closes when OFF.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import { GameLayers } from '../config/layers.config';
import { isBollard, hasSignalReceiver } from '../traits/trait-guards';

/**
 * BollardSystem - Manages bollard open/close behavior based on signal state.
 * 
 * This system is separate from SignalSystem to maintain proper separation of concerns:
 * - SignalSystem: propagates signals, sets receivedSignal on entities
 * - BollardSystem: reacts to receivedSignal changes, moves entities between layers
 */
export class BollardSystem extends BaseReactiveSystem {
    constructor(private gameManager: GameManager) {
        super();
    }

    /**
     * Update bollard states based on their receivedSignal.
     */
    update(context: GameContext): void {
        // Process all bollards
        for (const [entityId, pos] of context.spatial.getAllPositions()) {
            const data = context.spatial.getEntityData(entityId);
            if (!data || !isBollard(data)) continue;

            const shouldBeOpen = data.receivedSignal === true;
            const isOpen = pos.layer !== GameLayers.WALLS;

            if (shouldBeOpen && !isOpen) {
                this.openBollard(context, entityId, pos, data);
            } else if (!shouldBeOpen && isOpen) {
                this.closeBollard(context, entityId, pos, data);
            }
        }
    }

    private openBollard(
        context: GameContext,
        entityId: number,
        pos: { x: number; y: number; layer: number },
        data: any
    ): void {
        // Remove from store to allow spawnWithId to reuse ID
        this.gameManager.gameState.entityStore.remove(entityId);
        context.spatial.remove(entityId);

        context.spatial.spawnWithId(
            entityId,
            'bollard-open',
            pos.x,
            pos.y,
            GameLayers.FLOOR,
            {
                receiverType: 'bollard',
                receivedSignal: true,
                color: data.color || '#ff0000',
                sceneId: data.sceneId,
            }
        );
    }

    private closeBollard(
        context: GameContext,
        entityId: number,
        pos: { x: number; y: number; layer: number },
        data: any
    ): void {
        // Remove from store to allow spawnWithId to reuse ID
        this.gameManager.gameState.entityStore.remove(entityId);
        context.spatial.remove(entityId);

        context.spatial.spawnWithId(
            entityId,
            'bollard-closed',
            pos.x,
            pos.y,
            GameLayers.WALLS,
            {
                receiverType: 'bollard',
                receivedSignal: false,
                color: data.color || '#ff0000',
                sceneId: data.sceneId,
            }
        );
    }
}
