/**
 * FreeBodyStore - Tracks entities with sub-cell float positions.
 *
 * Used for entities that move freely without occupying grid cells.
 * Projectiles, flying entities, particle-like entities, etc.
 *
 * Entities in FreeBodyStore:
 * - Have float (x, y) positions with sub-cell precision
 * - Do NOT occupy grid cells (invisible to getEntityIdsInCell)
 * - Can overlap each other without conflict
 * - Use grid cell snapping for collision detection against grid entities
 * - Still have data in EntityStore (accessible via getEntityData)
 *
 * @example
 * ```typescript
 * const freeBody = new FreeBodyStore();
 *
 * // Register a projectile at float position
 * freeBody.register(projectileId, 5.3, 7.8);
 *
 * // Update position each tick
 * freeBody.setPosition(projectileId, 5.6, 8.1);
 *
 * // Get snapped cell for collision check
 * const cell = freeBody.getCellXY(projectileId);
 * // { x: 6, y: 8 }
 *
 * // Clean up
 * freeBody.remove(projectileId);
 * ```
 */
export class FreeBodyStore {
  /** Float positions indexed by entity ID */
  private positions: Map<number, { x: number; y: number }> = new Map();

  /**
   * Register a free entity at a float position.
   *
   * @param entityId - Entity ID (must already exist in EntityStore)
   * @param x - Initial float X position
   * @param y - Initial float Y position
   */
  register(entityId: number, x: number, y: number): void {
    this.positions.set(entityId, { x, y });
  }

  /**
   * Update a free entity's float position.
   *
   * @param entityId - Entity ID
   * @param x - New float X position
   * @param y - New float Y position
   */
  setPosition(entityId: number, x: number, y: number): void {
    const pos = this.positions.get(entityId);
    if (pos) {
      pos.x = x;
      pos.y = y;
    }
  }

  /**
   * Get a free entity's float position.
   *
   * @param entityId - Entity ID
   * @returns Float position or null if not registered
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
