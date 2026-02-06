/**
 * @brief Push System - Handles pushing mechanics.
 * 
 * Reactive system that inspects pending moves and triggers pushes.
 * Decoupled from input system: standardizes "pushing" as a reaction to
 * a pusher entity moving into a pushable entity's space.
 */
import { BaseTickedSystem } from '../core/base-system';
import type { GameContext } from '../core/types';

import { hasPushable, hasPusher } from '../traits/trait-guards';


/**
 * PushSystem - Resolves push interactions.
 * 
 * @system
 * @reactsTo Pending 'move' operations
 * @modifies Entities with HasPushable
 * 
 * Logic:
 * 1. Inspect all pending 'move' operations for current tick.
 * 2. Identify moves where 'HasPusher' moves into 'HasPushable'.
 * 3. Validate if cell BEHIND pushable is open.
 * 4. If open, stage move for pushable entity.
 * 5. SpatialSystem commit handles the atomic resolution (Pusher -> Crate -> Empty).
 */
export class PushSystem extends BaseTickedSystem {
    readonly executionPhase = 'pre-commit' as const;

    protected tickRate = 1;

    protected onTick(context: GameContext): void {
        const pendingOps = context.spatial.getPendingOps();

        // Iterate over pending moves
        for (const op of pendingOps) {
            if (op.type !== 'move') continue;

            const pusherId = op.entityId!;
            const targetX = op.toX!;
            const targetY = op.toY!;
            const layer = op.layer;

            // 1. Check if moving entity is a Pusher
            const pusherData = context.spatial.getEntityData(pusherId);
            if (!pusherData || !hasPusher(pusherData)) continue;

            // 2. Check if destination contains a Pushable
            // Note: We check the specific layer the pusher is moving on
            const targetEntityId = context.spatial.getEntityIdAt(targetX, targetY, layer);
            if (targetEntityId === undefined) continue;

            const targetData = context.spatial.getEntityData(targetEntityId);
            if (!targetData || !hasPushable(targetData)) continue;

            // 3. Validate Push
            if (!targetData.isPushable) continue;

            // Check weight vs strength
            const strength = pusherData.pushStrength ?? 1;
            const weight = targetData.weight ?? 1;
            if (weight > strength) continue;

            // Calculate push direction
            const dx = targetX - op.fromX!;
            const dy = targetY - op.fromY!;

            // Calculate destination for the pushed object
            const destX = targetX + dx;
            const destY = targetY + dy;

            // 4. Validate destination cell
            const destCell = context.spatial.grid.cell(destX, destY);

            // Must be valid grid cell
            if (!destCell) continue;

            // Must not be blocked (standard blocking check)
            if (context.spatial.isBlocked(destCell)) continue;

            // Must not be occupied on the same layer
            // (Unless that occupier is ALSO moving away? No, single-block limit)
            if (destCell.getValue(layer) !== undefined) continue;

            // 5. Stage move for the pushable object
            // This happens BEFORE commit, effectively chaining the moves.
            // SpatialSystem will see:
            // - Player moving to (tx, ty)
            // - Crate moving from (tx, ty) to (dx, dy) -> "isBeingVacated" = true
            // -> Both moves succeed.
            context.spatial.move(targetEntityId, destX, destY);
        }
    }

    public override getDebugState(): Record<string, unknown> {
        return {
            ...super.getDebugState(),
            description: 'Push System (Reactive Single-Block Push)',
        };
    }
}
