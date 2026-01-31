import type { LinkedCell } from '../core/grid/linked-cell';
import { GAMEPLAY_VISIBLE_LAYERS } from "../core/types";

/**
 * Layer Helpers - Visual and rendering utilities.
 * 
 * For spatial queries and movement checks, use SpatialSystem methods instead:
 * - spatial.isBlocked(cell)
 * - spatial.blocksVision(cell)
 * - spatial.isWalkable(cell)
 */

/**
 * Returns the topmost entity in a cell based on layer priority (highest layer index wins).
 * 
 * Used for rendering - determines which entity to display when multiple entities
 * occupy the same cell on different layers.
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
