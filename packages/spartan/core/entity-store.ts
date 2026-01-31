import type { EntityData } from '../entities/entity.types';

/**
 * SparseEntityStore - Minimal storage for entity metadata.
 *
 * Part of Architecture B: entities are primarily stored in cells,
 * but this store holds non-spatial metadata (type, properties).
 *
 * Design:
 * - Map for O(1) lookup by ID
 * - Auto-incrementing numeric IDs
 * - Extensible data via object spread
 * - Minimal API surface
 *
 * @example
 * ```typescript
 * const store = new SparseEntityStore();
 * const id = store.createId('player', { hp: 100, damage: 10 });
 * const data = store.getData(id);
 * console.log(data); // { id: 1, type: 'player', hp: 100, damage: 10 }
 * ```
 */
export class SparseEntityStore {
  /** Internal storage: entity ID → entity data */
  private data: Map<number, EntityData> = new Map();

  /** Auto-incrementing ID counter (used if no generator provided) */
  private nextId = 1;

  /** Optional ID generator function (for global entity ID management) */
  private idGenerator?: () => number;

  /**
   * Create a new SparseEntityStore.
   *
   * @param idGenerator - Optional function to generate entity IDs (for global ID management)
   *
   * @example
   * ```typescript
   * // Standalone store with internal counter
   * const store1 = new SparseEntityStore();
   *
   * // Store with global ID generator
   * const gameState = new GameState();
   * const store2 = new SparseEntityStore(() => gameState.generateEntityId());
   * ```
   */
  constructor(idGenerator?: () => number) {
    this.idGenerator = idGenerator;
  }

  /**
   * Create a new entity ID and store its metadata.
   *
   * @param type - Entity type identifier (e.g., 'player', 'enemy')
   * @param props - Optional additional properties for the entity
   * @returns The newly created entity ID
   *
   * @example
   * ```typescript
   * const playerId = store.createId('player', { hp: 100 });
   * const enemyId = store.createId('enemy', { hp: 50, damage: 5 });
   * ```
   */
  createId(type: string, props?: Record<string, unknown>): number {
    const id = this.idGenerator ? this.idGenerator() : this.nextId++;
    const entityData: EntityData = {
      id,
      type,
      ...props,
    };
    this.data.set(id, entityData);
    return id;
  }

  /**
   * Get entity data by ID.
   *
   * @param id - Entity ID to lookup
   * @returns Entity data, or undefined if not found
   *
   * @example
   * ```typescript
   * const data = store.getData(playerId);
   * if (data) {
   *   console.log(`Entity type: ${data.type}`);
   * }
   * ```
   */
  getData(id: number): EntityData | undefined {
    return this.data.get(id);
  }

  /**
   * Update entity data (partial update).
   *
   * Merges provided data into existing entity data.
   * Throws if entity ID doesn't exist.
   *
   * @param id - Entity ID to update
   * @param data - Partial entity data to merge
   * @throws Error if entity ID not found
   *
   * @example
   * ```typescript
   * // Update entity HP
   * store.setData(playerId, { hp: 90 });
   *
   * // Add new property
   * store.setData(playerId, { score: 100 });
   * ```
   */
  setData(id: number, data: Partial<EntityData>): void {
    const existing = this.data.get(id);
    if (!existing) {
      throw new Error(`Entity ${id} not found`);
    }
    this.data.set(id, { ...existing, ...data });
  }

  /**
   * Create an entity with a specific ID (for deserialization/restoration).
   *
   * WARNING: Use sparingly! Only for save/load and scene transitions.
   * Normal entity creation should use createId() for proper ID management.
   *
   * @param id - Entity ID to use
   * @param type - Entity type identifier
   * @param props - Optional additional properties
   *
   * @example
   * ```typescript
   * // Restore saved entity
   * store.createWithId(42, 'player', { hp: 100 });
   * ```
   */
  createWithId(
    id: number,
    type: string,
    props?: Record<string, unknown>
  ): void {
    if (this.data.has(id)) return;

    const entityData: EntityData = {
      id,
      type,
      ...props,
    };

    this.data.set(id, entityData);

    // Prevent collisions when this store is using the internal counter.
    if (!this.idGenerator && id >= this.nextId) {
      this.nextId = id + 1;
    }
  }

  /**
   * Remove entity data from the store.
   *
   * Note: This only removes from the store. Caller is responsible for
   * cleaning up the entity ID from cell.values[] layers (Rule 6).
   *
   * @param id - Entity ID to remove
   * @returns true if entity was removed, false if not found
   *
   * @example
   * ```typescript
   * // Remove entity from both store and cell
   * const removed = store.remove(entityId);
   * if (removed) {
   *   cell.values[layer] = undefined;
   * }
   * ```
   */
  remove(id: number): boolean {
    return this.data.delete(id);
  }

  /**
   * Get all entity IDs currently in the store.
   *
   * Use sparingly - Architecture B is spatial-first, so prefer
   * spatial queries (getEntityIdsInRadius, etc.) when possible.
   *
   * @returns Array of all entity IDs
   *
   * @example
   * ```typescript
   * // Iterate all entities (expensive!)
   * const allIds = store.getAllIds();
   * for (const id of allIds) {
   *   const data = store.getData(id);
   *   console.log(`Entity ${id}: ${data.type}`);
   * }
   * ```
   */
  getAllIds(): number[] {
    return Array.from(this.data.keys());
  }

  /**
   * Get the count of entities in the store.
   *
   * @returns Number of entities
   */
  get size(): number {
    return this.data.size;
  }

  /**
   * Clear all entities from the store.
   *
   * Use for resetting game state. Remember to also clear cell.values[]
   * layers as this only clears the metadata store.
   */
  clear(): void {
    this.data.clear();
    this.nextId = 1;
  }
}
