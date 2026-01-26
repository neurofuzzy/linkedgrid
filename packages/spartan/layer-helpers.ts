import type { LinkedCell } from '../grid/linked-cell';
import { GameLayers, GAMEPLAY_VISIBLE_LAYERS } from './types';

/**
 * Returns the topmost entity in a cell based on layer priority (highest layer index wins).
 */
export function getTopmostEntity(
    cell: LinkedCell,
    visibleLayers: readonly number[] = GAMEPLAY_VISIBLE_LAYERS
): number | undefined {
    for (let i = visibleLayers.length - 1; i >= 0; i--) {
        const layer = visibleLayers[i];
        const entityId = cell.getValue(layer);
        if (entityId !== undefined) {
            return entityId;
        }
    }
    return undefined;
}

/**
 * Checks if a cell blocks movement based on walls, actors, and optional empty floor setting.
 */
export function isBlocked(
    cell: LinkedCell | null,
    emptyFloorsBlock = false
): boolean {
    if (!cell) return true;

    if (emptyFloorsBlock && cell.getValue(GameLayers.FLOOR) === undefined) {
        return true;
    }

    if (cell.getValue(GameLayers.WALLS) !== undefined) {
        return true;
    }

    if (cell.getValue(GameLayers.ACTORS) !== undefined) {
        return true;
    }

    return false;
}

/**
 * Checks if a cell blocks vision (only walls block vision).
 */
export function blocksVision(cell: LinkedCell | null): boolean {
    if (!cell) return true;
    return cell.getValue(GameLayers.WALLS) !== undefined;
}

/**
 * Checks if a cell is walkable (inverse of isBlocked).
 */
export function isWalkable(
    cell: LinkedCell | null,
    emptyFloorsBlock = false
): boolean {
    return !isBlocked(cell, emptyFloorsBlock);
}
