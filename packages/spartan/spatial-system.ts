import { LinkedCell, LinkedGrid } from '../grid';
import { SparseEntityStore } from './entity-store';
import type { EntityData, Layer } from './types';
import { GameLayers, CellMasks } from './layers/types';

/**
 * SpatialSystem - Spatial operations for the Spartan framework.
 *
 * Architecture B: Cell-centric operations where cells are the primary
 * storage for entity positions via cell.values[layer].
 *
 * Core principles:
 * - Entities occupy one cell at a time (Rule 1)
 * - Entities occupy a layer on a cell (Rule 2)
 * - Check destination before moving (Rule 3)
 * - Multiple entities per cell via different layers (Rule 4)
 * - Spatial queries are first-class (Rule 5)
 * - Clean up old cell on move (Rule 6)
 * - Overlap detection, not collision (Rule 7)
 *
 * Movement system:
 * - Uses two-phase commit for atomic movement resolution
 * - Call move() to record movement intents
 * - Call commit() to execute all pending moves
 * - Allows adjacent entities to move together without blocking
 *
 * @example
 * ```typescript
 * const grid = new LinkedGrid(20, 20);
 * const store = new SparseEntityStore();
 * const spatial = new SpatialSystem(grid, store);
 *
 * // Spawn player at (10, 10) on layer 1
 * const playerId = spatial.spawn('player', 10, 10, 1, { hp: 100 });
 *
 * // Record movement intent and execute
 * spatial.move(10, 10, 11, 10, 1);
 * spatial.commit();
 *
 * // Query entities in radius
 * const nearby = spatial.getEntityIdsInRadius(11, 10, 3);
 * ```
 *
 * @example
 * ```typescript
 * // Convoy movement - adjacent entities move together
 * spatial.spawn('unit', 5, 5, 1);
 * spatial.spawn('unit', 6, 5, 1);
 * spatial.spawn('unit', 7, 5, 1);
 *
 * // All units move right simultaneously
 * spatial.move(5, 5, 6, 5, 1);
 * spatial.move(6, 5, 7, 5, 1);
 * spatial.move(7, 5, 8, 5, 1);
 * spatial.commit(); // All three move successfully
 * ```
 */
/**
 * Pending operation types for unified transaction model.
 */
interface PendingOperation {
  type: 'move' | 'remove' | 'spawn';
  entityId?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  x?: number;
  y?: number;
  layer: Layer;
  blockFn?: (cell: LinkedCell | null) => boolean;
  typeStr?: string;
  props?: object;
}

export class SpatialSystem {
  /** Pending operations to be resolved on commit */
  private pendingOps: PendingOperation[] = [];

  /** Track pending removals for lifecycle queries */
  private pendingRemovals = new Set<number>();

  /** Entity position tracking: entity ID → {x, y, layer} */
  private positions: Map<number, { x: number; y: number; layer: Layer }> =
    new Map();

  /**
   * Create a new SpatialSystem.
   *
   * @param grid - The LinkedGrid for spatial operations
   * @param store - The SparseEntityStore for entity metadata
   */
  constructor(
    private grid: LinkedGrid,
    private store: SparseEntityStore
  ) {}

  /**
   * Stage a spawn operation for a new entity.
   *
   * Creates entity metadata in store but defers placement until commit().
   * The entity ID is returned immediately but the entity won't be on the
   * grid until commit() is called.
   *
   * @param type - Entity type identifier
   * @param x - X coordinate (column)
   * @param y - Y coordinate (row)
   * @param layer - Layer index to occupy
   * @param props - Optional additional entity properties
   * @returns The newly created entity ID
   *
   * @example
   * ```typescript
   * const player = spatial.spawn('player', 5, 5, 1, { hp: 100 });
   * spatial.commit(); // Entity placed on grid
   * ```
   */
  spawn(
    type: string,
    x: number,
    y: number,
    layer: Layer,
    props?: Record<string, unknown>
  ): number {
    // Generate ID immediately but don't place yet
    const entityId = this.store.createId(type, props);

    // Stage the spawn operation
    this.pendingOps.push({
      type: 'spawn',
      entityId,
      x,
      y,
      layer,
      typeStr: type,
      props,
    });

    return entityId;
  }

  /**
   * Stage a spawn operation with a specific entity ID (for restoration/transitions).
   *
   * WARNING: Use sparingly! Only for save/load and scene transitions.
   * Normal spawning should use spawn() for proper ID management.
   *
   * @param entityId - Specific entity ID to use
   * @param type - Entity type identifier
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param layer - Layer index
   * @param props - Optional additional entity properties
   *
   * @example
   * ```typescript
   * // Scene transition: move player entity #42 to new scene
   * spatial.spawnWithId(42, 'player', 10, 10, GameLayers.ACTORS, { hp: 100 });
   * spatial.commit();
   * ```
   */
  spawnWithId(
    entityId: number,
    type: string,
    x: number,
    y: number,
    layer: Layer,
    props?: Record<string, unknown>
  ): void {
    // Create entity in store with specific ID
    this.store.createWithId(entityId, type, props);

    // Stage the spawn operation
    this.pendingOps.push({
      type: 'spawn',
      entityId,
      x,
      y,
      layer,
      typeStr: type,
      props,
    });
  }

  /**
   * Stage a move operation for an entity.
   *
   * The move is not executed immediately - call commit() to resolve all pending
   * movements atomically. This allows adjacent entities to move in the same
   * direction without blocking each other.
   *
   * @param fromX - Source X coordinate
   * @param fromY - Source Y coordinate
   * @param toX - Destination X coordinate
   * @param toY - Destination Y coordinate
   * @param layer - Layer the entity occupies
   * @param blockFn - Optional function to check if destination is blocked
   *
   * @example
   * ```typescript
   * // Record movement intents for a convoy
   * spatial.move(5, 5, 6, 5, 1);
   * spatial.move(6, 5, 7, 5, 1);
   * spatial.move(7, 5, 8, 5, 1);
   *
   * // Execute all moves atomically
   * spatial.commit();
   * ```
   *
   * @example
   * ```typescript
   * // Use blocking check for collision detection
   * const emptyFloorsBlock = true;
   * spatial.move(5, 5, 6, 5, GameLayers.ACTORS,
   *   (cell) => spatial.isBlocked(cell, emptyFloorsBlock)
   * );
   * spatial.commit();
   * ```
   */
  move(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    layer: Layer,
    blockFn?: (cell: LinkedCell | null) => boolean
  ): void {
    const fromCell = this.grid.cell(fromX, fromY);
    const toCell = this.grid.cell(toX, toY);

    // Validate coordinates are in bounds
    if (!fromCell || !toCell) {
      return; // Invalid coordinates - silently ignore
    }

    const entityId = fromCell.getValue(layer);
    if (entityId === undefined) {
      return; // No entity at source - silently ignore
    }

    // Stage the move operation
    this.pendingOps.push({
      type: 'move',
      entityId,
      fromX,
      fromY,
      toX,
      toY,
      layer,
      blockFn,
    });
  }

  /**
   * Stage a move operation for a specific entity (entity-centric API).
   *
   * Convenience method that looks up the entity's current position and
   * delegates to the coordinate-based move(). Useful when systems already
   * have entity IDs (e.g., from overlap detection).
   *
   * @param entityId - Entity ID to move
   * @param toX - Destination X coordinate
   * @param toY - Destination Y coordinate
   * @param blockFn - Optional function to check if destination is blocked
   * @returns true if entity found and move staged, false if entity not on grid
   *
   * @example
   * ```typescript
   * // Move entity by ID (common in system logic)
   * for (const overlap of overlaps) {
   *   for (const entityId of overlap.entityIds) {
   *     const pos = spatial.getEntityPosition(entityId);
   *     if (pos) {
   *       spatial.moveEntity(entityId, pos.x + 1, pos.y); // Move right
   *     }
   *   }
   * }
   * spatial.commit();
   * ```
   */
  moveEntity(
    entityId: number,
    toX: number,
    toY: number,
    blockFn?: (cell: LinkedCell | null) => boolean
  ): boolean {
    const pos = this.getEntityPosition(entityId);
    if (!pos) {
      return false; // Entity not on grid
    }

    this.move(pos.x, pos.y, toX, toY, pos.layer, blockFn);
    return true;
  }

  /**
   * Execute all pending operations atomically.
   *
   * Processes operations in order:
   * 1. Removals - entities removed from grid and store
   * 2. Moves - two-phase validation and execution
   * 3. Spawns - place new entities on grid
   *
   * This order prevents ghost entities from conflicting operations.
   *
   * @example
   * ```typescript
   * // Stage operations
   * spatial.spawn('enemy', 10, 10, 1);
   * spatial.move(5, 5, 6, 5, 1);
   * spatial.remove(7, 7, 1);
   *
   * // Execute all atomically
   * spatial.commit();
   * ```
   */
  commit(): void {
    if (this.pendingOps.length === 0) {
      return;
    }

    // Phase 1: Process removals first
    const removals = this.pendingOps.filter((op) => op.type === 'remove');
    for (const op of removals) {
      const cell = this.grid.cell(op.x!, op.y!);
      if (cell) {
        cell.clearValue(op.layer);
        // Update cell masks after removal
        this.updateCellMasks(cell);
      }
      this.store.remove(op.entityId!);
      this.positions.delete(op.entityId!);
    }

    // Phase 2: Process moves (existing two-phase logic)
    const moves = this.pendingOps.filter((op) => op.type === 'move');

    // Filter out moves for removed entities (prevent ghost entities)
    const validMoveCandidates = moves.filter(
      (op) => !this.pendingRemovals.has(op.entityId!)
    );

    // Two-phase commit for movements
    const sources = new Set<string>();
    const destinations = new Map<string, number[]>();
    const validMoves: boolean[] = new Array(validMoveCandidates.length).fill(
      false
    );

    // Build set of cells being vacated
    for (const move of validMoveCandidates) {
      const key = `${move.fromX},${move.fromY},${move.layer}`;
      sources.add(key);
    }

    // Collect all destination requests
    for (let i = 0; i < validMoveCandidates.length; i++) {
      const move = validMoveCandidates[i];
      const destKey = `${move.toX},${move.toY},${move.layer}`;

      if (!destinations.has(destKey)) {
        destinations.set(destKey, []);
      }
      destinations.get(destKey)!.push(i);
    }

    // Validate each move
    for (let i = 0; i < validMoveCandidates.length; i++) {
      const move = validMoveCandidates[i];
      const destKey = `${move.toX},${move.toY},${move.layer}`;
      const toCell = this.grid.cell(move.toX!, move.toY!);

      if (!toCell) {
        continue;
      }

      // Check custom blocking function if provided
      if (move.blockFn && move.blockFn(toCell)) {
        continue;
      }

      // Check if destination is walkable (not blocked by walls/actors)
      // Only check if the cell isn't being vacated by another move
      const isBeingVacated = sources.has(destKey);
      if (!isBeingVacated && this.isBlocked(toCell)) {
        continue;
      }

      // Check if destination is occupied
      const isOccupied = toCell.getValue(move.layer) !== undefined;

      // Check for conflicts (multiple entities want same destination)
      const requestsForThisDest = destinations.get(destKey) || [];
      const hasConflict = requestsForThisDest.length > 1;

      if (!hasConflict && (!isOccupied || isBeingVacated)) {
        validMoves[i] = true;
      }
    }

    // Execute valid moves: clear sources first
    for (let i = 0; i < validMoveCandidates.length; i++) {
      if (validMoves[i]) {
        const move = validMoveCandidates[i];
        const fromCell = this.grid.cell(move.fromX!, move.fromY!);
        if (fromCell) {
          fromCell.clearValue(move.layer);
          // Update masks after clearing source
          this.updateCellMasks(fromCell);
        }
      }
    }

    // Then write to destinations
    for (let i = 0; i < validMoveCandidates.length; i++) {
      if (validMoves[i]) {
        const move = validMoveCandidates[i];
        const toCell = this.grid.cell(move.toX!, move.toY!);
        if (toCell) {
          toCell.setValue(move.layer, move.entityId!);
          this.positions.set(move.entityId!, {
            x: move.toX!,
            y: move.toY!,
            layer: move.layer,
          });
          // Update masks after setting destination
          this.updateCellMasks(toCell);
        }
      }
    }

    // Phase 3: Process spawns last
    const spawns = this.pendingOps.filter((op) => op.type === 'spawn');
    for (const op of spawns) {
      const cell = this.grid.cell(op.x!, op.y!);
      if (!cell) continue;
      if (cell.getValue(op.layer) !== undefined) continue; // Occupied

      // Place entity on grid
      cell.setValue(op.layer, op.entityId!);
      this.positions.set(op.entityId!, { x: op.x!, y: op.y!, layer: op.layer });
      // Update masks after spawn
      this.updateCellMasks(cell);
    }

    // Phase 4: Clear all pending operations
    this.pendingOps = [];
    this.pendingRemovals.clear();
  }

  /**
   * Clear all pending operations without executing them.
   *
   * Useful for canceling operations or resetting state in tests.
   *
   * @example
   * ```typescript
   * spatial.move(5, 5, 6, 5, 1);
   * spatial.spawn('enemy', 10, 10, 1);
   * spatial.clearIntents(); // All operations canceled
   * ```
   */
  clearIntents(): void {
    this.pendingOps = [];
    this.pendingRemovals.clear();
  }

  /**
   * Create a pause frame for visual tests.
   *
   * This creates a snapshot that holds the current state for an additional frame,
   * useful for dramatic timing or letting users observe a state.
   *
   * Use sparingly - primarily for dramatic timing in visual tests.
   *
   * @example
   * ```typescript
   * // Show entities facing each other
   * spatial.moveEntity(player, 5, 5);
   * spatial.commit();
   *
   * // Pause to let user observe the standoff
   * spatial.pause();
   * spatial.pause(); // Second pause for longer duration
   *
   * // Then action continues
   * spatial.removeEntity(enemy);
   * spatial.commit();
   * ```
   */
  pause(): void {
    // This is a marker method that the test executor will capture
    // to create a pause snapshot showing the current state
  }

  /**
   * Stage a remove operation for an entity.
   *
   * The removal is not executed immediately - call commit() to execute.
   * The entity will be marked as "not alive" immediately (for lifecycle queries)
   * but will remain on the grid until commit().
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param layer - Layer the entity occupies
   * @returns true if entity found and staged for removal, false if not found
   *
   * @example
   * ```typescript
   * // Stage entity removal
   * spatial.remove(10, 10, 3);
   * spatial.commit(); // Entity removed from grid
   * ```
   */
  remove(x: number, y: number, layer: Layer): boolean {
    const cell = this.grid.cell(x, y);
    if (!cell) {
      return false;
    }

    const entityId = cell.getValue(layer);
    if (entityId === undefined) {
      return false;
    }

    // Stage the removal operation
    this.pendingOps.push({
      type: 'remove',
      entityId,
      x,
      y,
      layer,
    });

    // Mark as pending removal for lifecycle queries
    this.pendingRemovals.add(entityId);

    return true;
  }

  /**
   * Stage a remove operation for a specific entity (entity-centric API).
   *
   * Convenience method that looks up the entity's current position and
   * delegates to the coordinate-based remove(). Useful when systems already
   * have entity IDs.
   *
   * @param entityId - Entity ID to remove
   * @returns true if entity found and staged for removal, false if not on grid
   *
   * @example
   * ```typescript
   * // Remove entities by ID (common in combat/death logic)
   * for (const deadEntityId of deadEntities) {
   *   spatial.removeEntity(deadEntityId);
   * }
   * spatial.commit();
   * ```
   */
  removeEntity(entityId: number): boolean {
    const pos = this.getEntityPosition(entityId);
    if (!pos) {
      return false; // Entity not on grid
    }

    return this.remove(pos.x, pos.y, pos.layer);
  }

  /**
   * Get entity ID at a specific position and layer.
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param layer - Layer to check
   * @returns Entity ID if present, undefined otherwise
   *
   * @example
   * ```typescript
   * const entityId = spatial.getEntityIdAt(5, 5, 1);
   * if (entityId !== undefined) {
   *   console.log(`Found entity ${entityId}`);
   * }
   * ```
   */
  getEntityIdAt(x: number, y: number, layer: Layer): number | undefined {
    const cell = this.grid.cell(x, y);
    return cell?.getValue(layer);
  }

  /**
   * Get all entity IDs in a cell across all layers.
   *
   * Rule 7: This enables overlap detection - multiple entities can
   * occupy the same cell on different layers.
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Array of entity IDs (may be empty)
   *
   * @example
   * ```typescript
   * // Detect overlaps for area damage
   * const entities = spatial.getEntityIdsInCell(5, 5);
   * for (const id of entities) {
   *   const data = spatial.getEntityData(id);
   *   if (data.type === 'player' || data.type === 'enemy') {
   *     applyDamage(id, 10);
   *   }
   * }
   * ```
   */
  getEntityIdsInCell(x: number, y: number): number[] {
    const cell = this.grid.cell(x, y);
    if (!cell) {
      return [];
    }

    const ids: number[] = [];
    for (const id of cell.values) {
      if (id !== undefined) {
        ids.push(id);
      }
    }
    return ids;
  }

  /**
   * Get all entity IDs within a circular radius (Euclidean distance).
   *
   * Rule 5: Spatial queries for area effects, vision, etc.
   * By default, excludes entities pending removal (zombie entities).
   *
   * @param x - Center X coordinate
   * @param y - Center Y coordinate
   * @param radius - Radius in cells
   * @param options - Query options (includePendingRemovals)
   * @returns Array of entity IDs within radius
   *
   * @example
   * ```typescript
   * // Find enemies near player (excludes corpses)
   * const nearby = spatial.getEntityIdsInRadius(playerX, playerY, 5);
   * for (const id of nearby) {
   *   const data = spatial.getEntityData(id);
   *   if (data.type === 'enemy') {
   *     console.log(`Enemy ${id} nearby!`);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Include pending removals for area effect that hits corpses
   * const all = spatial.getEntityIdsInRadius(x, y, 3, { includePendingRemovals: true });
   * ```
   */
  getEntityIdsInRadius(
    x: number,
    y: number,
    radius: number,
    options?: { includePendingRemovals?: boolean }
  ): number[] {
    const cell = this.grid.cell(x, y);
    if (!cell) {
      return [];
    }

    const cells = cell.getCircle(radius);
    const ids: number[] = [];

    for (const c of cells) {
      for (const id of c.values) {
        if (id !== undefined) {
          ids.push(id);
        }
      }
    }

    // Filter out pending removals by default
    if (options?.includePendingRemovals) {
      return ids;
    }

    return ids.filter((id) => !this.pendingRemovals.has(id));
  }

  /**
   * Get all entity IDs along a line between two points.
   *
   * Uses Bresenham's line algorithm. Useful for line-of-sight,
   * projectile paths, etc.
   *
   * @param x0 - Start X coordinate
   * @param y0 - Start Y coordinate
   * @param x1 - End X coordinate
   * @param y1 - End Y coordinate
   * @returns Array of entity IDs along the line
   *
   * @example
   * ```typescript
   * // Check if shot is blocked
   * const entitiesInLine = spatial.getEntityIdsInLine(
   *   shooterX, shooterY,
   *   targetX, targetY
   * );
   *
   * for (const id of entitiesInLine) {
   *   const data = spatial.getEntityData(id);
   *   if (data.type === 'wall') {
   *     console.log('Shot blocked by wall');
   *     break;
   *   }
   * }
   * ```
   */
  getEntityIdsInLine(x0: number, y0: number, x1: number, y1: number): number[] {
    const cells = this.grid.getLine(x0, y0, x1, y1);
    const ids: number[] = [];

    for (const cell of cells) {
      for (const id of cell.values) {
        if (id !== undefined) {
          ids.push(id);
        }
      }
    }

    return ids;
  }

  /**
   * Get full entity data by ID.
   *
   * Convenience method that delegates to the store.
   *
   * @param id - Entity ID
   * @returns Entity data, or undefined if not found
   *
   * @example
   * ```typescript
   * const data = spatial.getEntityData(playerId);
   * if (data) {
   *   console.log(`${data.type} at position`);
   * }
   * ```
   */
  getEntityData(id: number): EntityData | undefined {
    return this.store.getData(id);
  }

  /**
   * Get the grid position of an entity by ID.
   *
   * Returns null if entity is not currently on the grid.
   * Entities can exist in the store without grid positions
   * (e.g., during animations, transitions, or as UI elements).
   *
   * @param id - Entity ID
   * @returns Position with x, y, and layer, or null if not on grid
   *
   * @example
   * ```typescript
   * const pos = spatial.getEntityPosition(playerId);
   * if (pos) {
   *   console.log(`Player at (${pos.x}, ${pos.y}) on layer ${pos.layer}`);
   * }
   * ```
   */
  getEntityPosition(id: number): { x: number; y: number; layer: Layer } | null {
    // Don't return position for entities pending removal
    if (this.pendingRemovals.has(id)) return null;
    return this.positions.get(id) ?? null;
  }

  /**
   * Check if entity is valid for targeting/interaction.
   *
   * Returns false if entity is pending removal (staged for death).
   * Use this in game systems to avoid targeting "zombie entities".
   *
   * @param entityId - Entity to check
   * @returns true if entity is alive and not pending removal
   *
   * @example
   * ```typescript
   * // CombatSystem checks if target is still alive
   * if (spatial.isAlive(targetId)) {
   *   applyDamage(targetId, 10);
   * }
   * ```
   */
  isAlive(entityId: number): boolean {
    if (this.pendingRemovals.has(entityId)) return false;
    return this.store.getData(entityId) !== undefined;
  }

  /**
   * Get all tracked entity positions.
   *
   * Used for overlap detection and iteration over all entities.
   * Returns an iterator of [entityId, {x, y, layer}] entries.
   *
   * @returns Iterator of entity positions
   *
   * @example
   * ```typescript
   * for (const [entityId, pos] of spatial.getAllPositions()) {
   *   console.log(`Entity ${entityId} at (${pos.x}, ${pos.y})`);
   * }
   * ```
   */
  getAllPositions(): IterableIterator<
    [number, { x: number; y: number; layer: Layer }]
  > {
    return this.positions.entries();
  }

  /**
   * Detect all overlaps (multiple entities at same position).
   *
   * Returns positions with 2+ entities across all layers.
   * Used by game loop for overlap-based mechanics (items, triggers, etc.).
   *
   * @returns Array of overlaps
   *
   * @example
   * ```typescript
   * const overlaps = spatial.detectOverlaps();
   * for (const overlap of overlaps) {
   *   console.log(`${overlap.entityIds.length} entities at (${overlap.position.x}, ${overlap.position.y})`);
   * }
   * ```
   */
  detectOverlaps(): Array<{
    position: { x: number; y: number };
    entityIds: number[];
  }> {
    const overlaps: Array<{
      position: { x: number; y: number };
      entityIds: number[];
    }> = [];
    const checked = new Set<string>();

    for (const [_, pos] of this.getAllPositions()) {
      const key = `${pos.x},${pos.y}`;
      if (checked.has(key)) continue;
      checked.add(key);

      const entities = this.getEntityIdsInCell(pos.x, pos.y);
      if (entities.length > 1) {
        overlaps.push({
          position: { x: pos.x, y: pos.y },
          entityIds: entities,
        });
      }
    }

    return overlaps;
  }

  /**
   * Get the grid used by this spatial system.
   *
   * @returns The LinkedGrid instance
   */
  getGrid(): LinkedGrid {
    return this.grid;
  }

  /**
   * Get the entity store used by this spatial system.
   *
   * @returns The SparseEntityStore instance
   */
  getStore(): SparseEntityStore {
    return this.store;
  }

  /**
   * Cancel a pending removal (e.g., for resurrection).
   *
   * Removes the removal operation from pending queue and clears the
   * pending removal flag, allowing the entity to be targeted again.
   *
   * @param entityId - Entity to resurrect
   * @returns true if removal was canceled, false if not pending
   *
   * @example
   * ```typescript
   * // CombatSystem stages removal
   * spatial.remove(x, y, layer);
   *
   * // HealingSystem resurrects
   * const data = spatial.getEntityData(entityId);
   * data.hp = data.maxHp;
   * spatial.cancelRemoval(entityId);
   * ```
   */
  cancelRemoval(entityId: number): boolean {
    if (!this.pendingRemovals.has(entityId)) return false;

    // Remove from pending removals
    this.pendingRemovals.delete(entityId);

    // Remove from pending ops
    const index = this.pendingOps.findIndex(
      (op) => op.type === 'remove' && op.entityId === entityId
    );
    if (index !== -1) {
      this.pendingOps.splice(index, 1);
    }

    return true;
  }

  /**
   * Cancel a pending spawn.
   *
   * Removes the spawn operation from pending queue.
   * Note: entity ID is still in store, but won't be placed on grid.
   *
   * @param entityId - Entity to cancel
   * @returns true if spawn was canceled, false if not pending
   *
   * @example
   * ```typescript
   * const id = spatial.spawn('enemy', 10, 10, 1);
   * spatial.cancelSpawn(id); // Entity won't appear on grid
   * ```
   */
  cancelSpawn(entityId: number): boolean {
    const index = this.pendingOps.findIndex(
      (op) => op.type === 'spawn' && op.entityId === entityId
    );

    if (index === -1) return false;

    this.pendingOps.splice(index, 1);

    // Defensive cleanup of any tracking/state
    this.pendingRemovals.delete(entityId);
    this.positions.delete(entityId);

    // Clean up entity data from store to prevent orphaned entities
    this.store.remove(entityId);
    return true;
  }

  /**
   * Get pending operations for debugging/visualization.
   *
   * Returns read-only view of staged operations.
   * Useful for visual runner and debugging.
   *
   * @returns Array of pending operations
   *
   * @example
   * ```typescript
   * const pending = spatial.getPendingOps();
   * console.log(`${pending.length} pending operations`);
   * ```
   */
  getPendingOps(): ReadonlyArray<PendingOperation> {
    return this.pendingOps;
  }

  /**
   * Get entities staged for removal.
   *
   * Returns read-only set of entity IDs pending removal.
   *
   * @returns Set of entity IDs pending removal
   *
   * @example
   * ```typescript
   * const pendingRemovals = spatial.getPendingRemovals();
   * if (pendingRemovals.has(entityId)) {
   *   console.log('Entity is a zombie - pending removal');
   * }
   * ```
   */
  getPendingRemovals(): ReadonlySet<number> {
    return this.pendingRemovals;
  }

  /**
   * Debug output showing current and pending state.
   *
   * Returns human-readable string with:
   * - Current entity count
   * - Pending operations count
   * - Detailed list of pending operations
   *
   * @returns Debug string
   *
   * @example
   * ```typescript
   * console.log(spatial.debug());
   * // === SpatialSystem Debug ===
   * // Entities: 5
   * // Pending ops: 3
   * //   - Moves: 2
   * //   - Removals: 1
   * //   - Spawns: 0
   * ```
   */
  debug(): string {
    const entityCount = Array.from(this.positions.keys()).length;
    const pendingMoves = this.pendingOps.filter(
      (op) => op.type === 'move'
    ).length;
    const pendingRemovals = this.pendingRemovals.size;
    const pendingSpawns = this.pendingOps.filter(
      (op) => op.type === 'spawn'
    ).length;

    let output = '=== SpatialSystem Debug ===\n';
    output += `Entities: ${entityCount}\n`;
    output += `Pending ops: ${this.pendingOps.length}\n`;
    output += `  - Moves: ${pendingMoves}\n`;
    output += `  - Removals: ${pendingRemovals}\n`;
    output += `  - Spawns: ${pendingSpawns}\n`;

    if (this.pendingOps.length > 0) {
      output += '\nPending operations:\n';
      for (const op of this.pendingOps) {
        if (op.type === 'move') {
          output += `  MOVE: entity ${op.entityId} (${op.fromX},${op.fromY}) → (${op.toX},${op.toY}) layer ${op.layer}\n`;
        } else if (op.type === 'remove') {
          output += `  REMOVE: entity ${op.entityId} at (${op.x},${op.y}) layer ${op.layer}\n`;
        } else if (op.type === 'spawn') {
          output += `  SPAWN: entity ${op.entityId} (${op.typeStr}) at (${op.x},${op.y}) layer ${op.layer}\n`;
        }
      }
    }

    return output;
  }

  /**
   * Update cell masks based on entities present on the cell.
   * 
   * Sets BLOCKING mask if cell has entities on WALLS or ACTORS layers.
   * Sets VISION_BLOCKING mask if cell has entities on WALLS layer.
   * 
   * @param cell - Cell to update masks for
   * @private
   */
  private updateCellMasks(cell: LinkedCell): void {
    // Check if WALLS or ACTORS layers have entities
    const hasWall = cell.getValue(GameLayers.WALLS) !== undefined;
    const hasActor = cell.getValue(GameLayers.ACTORS) !== undefined;
    
    // Set BLOCKING mask if walls or actors present
    cell.setMask(CellMasks.BLOCKING, hasWall || hasActor);
    
    // Set VISION_BLOCKING mask if walls present
    cell.setMask(CellMasks.VISION_BLOCKING, hasWall);
  }

  /**
   * Synchronize all cell masks with current grid state.
   * 
   * Scans all cells in the grid and updates their masks based on
   * entities currently present. Useful after manually setting cell
   * values or when initializing a scene.
   * 
   * @example
   * ```typescript
   * // Manually set terrain
   * grid.cell(5, 5).setValue(GameLayers.WALLS, 1);
   * 
   * // Sync masks
   * spatial.syncMasks();
   * ```
   */
  syncMasks(): void {
    for (const cell of this.grid.cells) {
      this.updateCellMasks(cell);
    }
  }

  /**
   * Checks if a cell blocks movement using the BLOCKING mask.
   *
   * The BLOCKING mask is automatically managed by SpatialSystem when entities
   * that block movement are spawned/removed (walls, closed doors, actors, etc.).
   *
   * @param cell - Cell to check
   * @param emptyFloorsBlock - If true, cells without floor entities block movement
   * @returns true if cell blocks movement
   * 
   * @example
   * ```typescript
   * const targetCell = spatial.grid.cell(5, 5);
   * if (!spatial.isBlocked(targetCell)) {
   *   spatial.move(4, 5, 5, 5, GameLayers.ACTORS);
   * }
   * ```
   */
  isBlocked(cell: LinkedCell | null, emptyFloorsBlock = false): boolean {
    if (!cell) return true;

    if (emptyFloorsBlock && cell.getValue(GameLayers.FLOOR) === undefined) {
      return true;
    }

    return cell.getMask(CellMasks.BLOCKING);
  }

  /**
   * Checks if a cell blocks vision using the VISION_BLOCKING mask.
   *
   * The VISION_BLOCKING mask is automatically managed by SpatialSystem when
   * entities that block line of sight are spawned/removed (walls, closed doors, etc.).
   *
   * @param cell - Cell to check
   * @returns true if cell blocks vision
   * 
   * @example
   * ```typescript
   * const targetCell = spatial.grid.cell(5, 5);
   * if (!spatial.blocksVision(targetCell)) {
   *   // Line of sight is clear
   * }
   * ```
   */
  blocksVision(cell: LinkedCell | null): boolean {
    if (!cell) return true;
    return cell.getMask(CellMasks.VISION_BLOCKING);
  }

  /**
   * Checks if a cell is walkable (inverse of isBlocked).
   * 
   * @param cell - Cell to check
   * @param emptyFloorsBlock - If true, cells without floor entities block movement
   * @returns true if cell is walkable
   * 
   * @example
   * ```typescript
   * const targetCell = spatial.grid.cell(5, 5);
   * if (spatial.isWalkable(targetCell)) {
   *   spatial.move(4, 5, 5, 5, GameLayers.ACTORS);
   * }
   * ```
   */
  isWalkable(cell: LinkedCell | null, emptyFloorsBlock = false): boolean {
    return !this.isBlocked(cell, emptyFloorsBlock);
  }
}
