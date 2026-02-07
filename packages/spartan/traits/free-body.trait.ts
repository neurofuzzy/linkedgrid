/**
 * Free Body Trait
 *
 * Marks an entity as "grid-free" with sub-cell float positioning.
 * Free-body entities do NOT occupy grid cells (cell.values[]).
 * They are tracked by FreeBodyStore and use float coordinates.
 *
 * Use cases: projectiles, flying entities, floating particles.
 *
 * Collision detection against grid entities works by snapping
 * (fx, fy) to the nearest integer cell via Math.round().
 */

/**
 * HasFreeBody - Trait for entities with sub-cell float positions.
 *
 * Entities with this trait:
 * - Have float (x, y) positions with sub-cell precision
 * - Do NOT occupy grid cells (invisible to getEntityIdsInCell)
 * - Can overlap each other without conflict
 * - Use cell snapping for collision detection against grid entities
 */
export interface HasFreeBody {
  /** Float X position (sub-cell precision) */
  fx: number;
  /** Float Y position (sub-cell precision) */
  fy: number;
}
