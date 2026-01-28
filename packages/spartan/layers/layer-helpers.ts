import type { LinkedCell } from '../../grid/linked-cell';
import { GameLayers, GAMEPLAY_VISIBLE_LAYERS, CellMasks } from './types';

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
 * Checks if a cell blocks movement using the BLOCKING mask.
 *
 * The BLOCKING mask is set/cleared by systems when entities that block
 * movement are spawned/removed (walls, closed doors, actors, etc.).
 *
 * @param cell - Cell to check
 * @param emptyFloorsBlock - If true, cells without floor entities block movement
 * @returns true if cell blocks movement
 */
export function isBlocked(
  cell: LinkedCell | null,
  emptyFloorsBlock = false
): boolean {
  if (!cell) return true;

  if (emptyFloorsBlock && cell.getValue(GameLayers.FLOOR) === undefined) {
    return true;
  }

  // Check the BLOCKING mask bit
  return cell.getMask(CellMasks.BLOCKING);
}

/**
 * Checks if a cell blocks vision using the VISION_BLOCKING mask.
 *
 * The VISION_BLOCKING mask is set/cleared by systems when entities that block
 * line of sight are spawned/removed (walls, closed doors, etc.).
 *
 * @param cell - Cell to check
 * @returns true if cell blocks vision
 */
export function blocksVision(cell: LinkedCell | null): boolean {
  if (!cell) return true;
  return cell.getMask(CellMasks.VISION_BLOCKING);
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
