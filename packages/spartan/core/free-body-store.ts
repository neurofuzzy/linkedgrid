/**
 * FreeBodyStore - Tracks entities with sub-cell float positions.
 *
 * Used for entities that move freely without occupying grid cells.
 * Projectiles, flying entities, particle-like entities, etc.
 *
 * Coordinate convention (world-space, same scale as grid: 1.0 per cell):
 *   - Grid cell (cx, cy) occupies area [cx, cx+1) × [cy, cy+1)
 *   - Cell center in float-space = (cx + 0.5, cy + 0.5)
 *   - Renderer conversion: pixelCenter = floatX * cellSize (no half-cell offset)
 *
 * Entities in FreeBodyStore:
 * - Have float (floatX, floatY) positions with sub-cell precision
 * - Do NOT occupy grid cells (invisible to getEntityIdsInCell)
 * - Can overlap each other without conflict
 * - Use Math.floor() to snap to owning grid cell for collision detection
 * - Still have data in EntityStore (accessible via getEntityData)
 *
 * @example
 * ```typescript
 * const freeBody = new FreeBodyStore();
 *
 * // Register a projectile at float position (center of cell 5,7)
 * freeBody.register(projectileId, 5.5, 7.5);
 *
 * // Update position each tick
 * freeBody.setPosition(projectileId, 5.8, 7.9);
 *
 * // Get owning cell via Math.floor
 * const cell = freeBody.getCellXY(projectileId);
 * // { x: 5, y: 7 }
 *
 * // Clean up
 * freeBody.remove(projectileId);
 * ```
 */
export class FreeBodyStore {
  /** Float positions indexed by entity ID */
  private positions: Map<number, { x: number; y: number }> = new Map();

  /**
   * Register a free entity at a float position (world-space).
   *
   * @param entityId - Entity ID (must already exist in EntityStore)
   * @param floatX - Initial float X position in world-space
   * @param floatY - Initial float Y position in world-space
   */
  register(entityId: number, floatX: number, floatY: number): void {
    this.positions.set(entityId, { x: floatX, y: floatY });
  }

  /**
   * Update a free entity's float position (world-space).
   *
   * @param entityId - Entity ID
   * @param floatX - New float X position in world-space
   * @param floatY - New float Y position in world-space
   */
  setPosition(entityId: number, floatX: number, floatY: number): void {
    const pos = this.positions.get(entityId);
    if (pos) {
      pos.x = floatX;
      pos.y = floatY;
    }
  }

  /**
   * Get a free entity's float position (world-space).
   *
   * @param entityId - Entity ID
   * @returns Float position {x, y} in world-space, or null if not registered
   */
  getPosition(entityId: number): { x: number; y: number } | null {
    return this.positions.get(entityId) ?? null;
  }

  /**
   * Get the grid cell coordinates for a free-body entity.
   *
   * Uses Math.floor since positions are in world-space where
   * cell (cx, cy) occupies [cx, cx+1) × [cy, cy+1).
   *
   * @param entityId - Entity ID
   * @returns Integer cell coordinates or null if not registered
   */
  getCellXY(entityId: number): { x: number; y: number } | null {
    const pos = this.positions.get(entityId);
    if (!pos) return null;
    return { x: Math.floor(pos.x), y: Math.floor(pos.y) };
  }

  /**
   * Check if an entity is registered as a free body.
   *
   * @param entityId - Entity ID
   * @returns true if registered
   */
  has(entityId: number): boolean {
    return this.positions.has(entityId);
  }

  /**
   * Remove a free entity from tracking.
   *
   * Does NOT remove entity data from EntityStore -- caller must do that.
   *
   * @param entityId - Entity ID
   */
  remove(entityId: number): void {
    this.positions.delete(entityId);
  }

  /**
   * Iterate all registered free entities and their positions.
   *
   * @returns Iterator of [entityId, { x, y }] entries
   */
  entries(): IterableIterator<[number, { x: number; y: number }]> {
    return this.positions.entries();
  }

  /**
   * Number of tracked free entities.
   */
  get size(): number {
    return this.positions.size;
  }

  /**
   * Clear all tracked free entities.
   *
   * Used for scene transitions and cleanup.
   */
  clear(): void {
    this.positions.clear();
  }
}
