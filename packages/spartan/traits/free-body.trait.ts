/**
 * Free Body Trait
 *
 * Marks an entity as "grid-free" with sub-cell float positioning.
 * Free-body entities do NOT occupy grid cells (cell.values[]).
 * They are tracked by FreeBodyStore and use float coordinates.
 *
 * Use cases: projectiles, flying entities, floating particles.
 *
 * Coordinate convention (world-space, same scale as grid: 1.0 per cell):
 *   - Grid cell (cx, cy) occupies area [cx, cx+1) × [cy, cy+1)
 *   - Cell center in float-space = (cx + 0.5, cy + 0.5)
 *   - Renderer conversion: pixelCenter = floatX * cellSize (no half-cell offset)
 *
 * Collision detection against grid entities works by snapping
 * (floatX, floatY) to the owning grid cell via Math.floor().
 */

/**
 * HasFreeBody - Trait for entities with sub-cell float positions.
 *
 * Entities with this trait:
 * - Have float (floatX, floatY) positions with sub-cell precision
 * - Do NOT occupy grid cells (invisible to getEntityIdsInCell)
 * - Can overlap each other without conflict
 * - Use Math.floor() cell snapping for collision detection against grid entities
 */
export interface HasFreeBody {
  /** Float X position in world-space (1.0 = one cell width). */
  floatX: number;
  /** Float Y position in world-space (1.0 = one cell height). */
  floatY: number;
}
