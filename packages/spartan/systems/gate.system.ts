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
    readonly executionPhase = 'main' as const;

    constructor(private gameManager: GameManager) {
        super();
    }

    /**
     * Update gate states based on their receivedSignal.
     * Collects gates to mutate first, then applies changes to avoid
     * modifying the collection while iterating.
     */
    update(context: GameContext): void {
        // Collect gates that need to change state
        const toOpen: Array<[number, { x: number; y: number; layer: number }, Record<string, unknown>]> = [];
        const toClose: Array<[number, { x: number; y: number; layer: number }, Record<string, unknown>]> = [];

        for (const [entityId, pos] of context.spatial.getAllPositions()) {
            const data = context.spatial.getEntityData(entityId);
            if (!data || !isGate(data)) continue;

            const shouldBeOpen = data.receivedSignal === true;
            const isOpen = pos.layer !== GameLayers.WALLS; // Open = NOT on WALLS layer

            if (shouldBeOpen && !isOpen) {
                toOpen.push([entityId, pos, data]);
            } else if (!shouldBeOpen && isOpen) {
                toClose.push([entityId, pos, data]);
            }
        }

        // Apply mutations outside the iteration loop
        for (const [entityId, pos, data] of toOpen) {
            this.openGate(context, entityId, pos, data);
        }
        for (const [entityId, pos, data] of toClose) {
            this.closeGate(context, entityId, pos, data);
        }
    }

    private openGate(
        context: GameContext,
        entityId: number,
        pos: { x: number; y: number; layer: number },
        data: Record<string, unknown>
    ): void {
        // Remove from store to allow spawnWithId to reuse ID
        this.gameManager.gameState.entityStore.remove(entityId);
        context.spatial.remove(entityId);

        // Restore opacity when open - strip any existing alpha
        let color = (data.color as string) || '#ff0000';
        if (color.startsWith('#') && color.length > 7) {
            color = color.substring(0, 7);
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
                pendingSignal: data.pendingSignal,
                color,
                sceneId: data.sceneId,
            }
        );
    }

    private closeGate(
        context: GameContext,
        entityId: number,
        pos: { x: number; y: number; layer: number },
        data: Record<string, unknown>
    ): void {
        // Remove from store to allow spawnWithId to reuse ID
        this.gameManager.gameState.entityStore.remove(entityId);
        context.spatial.remove(entityId);

        // Make semi-opaque when closed
        // Strip any existing alpha before adding new one
        let color = (data.color as string) || '#ff0000';
        if (color.startsWith('#')) {
            if (color.length > 7) {
                color = color.substring(0, 7);
            }
            color += '80'; // 50% opacity
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
                pendingSignal: data.pendingSignal,
                color,
                sceneId: data.sceneId,
            }
        );
    }
}
