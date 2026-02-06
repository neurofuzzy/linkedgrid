/**
 * @brief Container for a spatial game level and its grid.
 */
import { LinkedGrid } from './grid';
import { SpatialSystem } from './spatial-system';
import { GameState } from './game-state';
import type { Layer } from './types';

/**
 * Scene - Container for a spatial game scene.
 *
 * Wraps grid and spatial system. Entities are stored globally in GameState.entityStore
 * and reference this scene via their `sceneId` property.
 *
 * @example
 * ```typescript
 * const gameState = new GameState();
 * const scene = new Scene('dungeon-1', 20, 20, gameState);
 *
 * // Spawn entities in this scene (stored globally, referenced by sceneId)
 * const player = scene.spatial.spawn('player', 10, 10, 5, { sceneId: scene.id, hp: 100 });
 *
 * // Check player position
 * const pos = scene.getPlayerPosition();
 * if (pos) {
 *   console.log(`Player at (${pos.x}, ${pos.y})`);
 * }
 * ```
 */
export class Scene {
  /** Unique scene identifier */
  readonly id: string;

  /** Grid for this scene */
  readonly grid: LinkedGrid;

  /** Spatial system for this scene */
  readonly spatial: SpatialSystem;

  /** Scene-specific metadata (name, music, etc.) */
  metadata: Record<string, unknown>;

  /** Reference to global game state */
  private gameState: GameState;

  /**
   * Create a new Scene.
   *
   * @param id - Unique scene identifier
   * @param width - Grid width
   * @param height - Grid height
   * @param gameState - Global game state (provides global entity store)
   * @param metadata - Optional scene metadata
   *
   * @example
   * ```typescript
   * const scene = new Scene('room1', 30, 20, gameState, {
   *   name: 'Treasure Room',
   *   music: 'dungeon-theme.mp3'
   * });
   * ```
   */
  constructor(
    id: string,
    width: number,
    height: number,
    gameState: GameState,
    metadata: Record<string, unknown> = {}
  ) {
    this.id = id;
    this.gameState = gameState;
    this.metadata = metadata;

    // Create grid and spatial system with global entity store
    this.grid = new LinkedGrid(width, height);
    this.spatial = new SpatialSystem(this.grid, gameState.entityStore);
  }

  /**
   * Get the player's position in this scene.
   *
   * Returns null if the player is not in this scene or not on the grid.
   * Uses the global playerEntityId from GameState.
   *
   * @returns Player position or null
   *
   * @example
   * ```typescript
   * const pos = scene.getPlayerPosition();
   * if (pos) {
   *   console.log(`Player in scene at (${pos.x}, ${pos.y}) on layer ${pos.layer}`);
   * } else {
   *   console.log('Player not in this scene');
   * }
   * ```
   */
  getPlayerPosition(): { x: number; y: number; layer: Layer } | null {
    if (this.gameState.playerEntityId === 0) {
      return null; // No player entity assigned yet
    }
    return this.spatial.getEntityPosition(this.gameState.playerEntityId);
  }

  /**
   * Serialize scene to plain object for saving.
   *
   * Includes sparse cell data. Entity data is stored globally in GameState.
   *
   * @returns Plain object representation
   */
  serialize(): object {
    // Collect sparse cell data (only cells with values)
    const cells: Array<{
      x: number;
      y: number;
      values: (number | undefined)[];
      masks: boolean[];
      distances: number[];
    }> = [];

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const cell = this.grid.cell(x, y);
        if (cell) {
          // Check if cell has any data
          const hasValues = cell.values.some((v) => v !== undefined);
          const hasMasks = cell.masks.some((m) => m === true);
          const hasDistances = cell.distances.some((d) => d !== 0);

          if (hasValues || hasMasks || hasDistances) {
            cells.push({
              x,
              y,
              values: [...cell.values],
              masks: [...cell.masks],
              distances: [...cell.distances],
            });
          }
        }
      }
    }

    return {
      id: this.id,
      width: this.grid.width,
      height: this.grid.height,
      metadata: this.metadata,
      cells,
    };
  }

  /**
   * Deserialize scene from plain object.
   *
   * Entities are restored from GameState.entityStore (not scene data).
   *
   * @param data - Serialized scene data
   * @param gameState - Global game state reference
   * @returns New Scene instance
   */
  static deserialize(data: {
    id: string;
    width: number;
    height: number;
    metadata?: Record<string, unknown>;
    cells?: Array<{
      x: number;
      y: number;
      values: (number | undefined)[];
      masks: boolean[];
      distances: number[];
    }>;
  }, gameState: GameState): Scene {
    const scene = new Scene(
      data.id,
      data.width,
      data.height,
      gameState,
      data.metadata || {}
    );

    // Restore cell data
    for (const cellData of data.cells || []) {
      const cell = scene.grid.cell(cellData.x, cellData.y);
      if (cell) {
        // Restore values array
        for (let layer = 0; layer < cellData.values.length; layer++) {
          const value = cellData.values[layer];
          if (value !== undefined) {
            cell.setValue(layer, value);
          }
        }
        // Restore masks array (boolean flags)
        for (let layer = 0; layer < cellData.masks.length; layer++) {
          if (cellData.masks[layer] === true) {
            cell.setMask(layer, true);
          }
        }
        // Restore distances array
        if (cellData.distances && cellData.distances.some((d) => d !== 0)) {
          cell.restoreDistances([...cellData.distances]);
        }
      }
    }

    // Rebuild position tracking in spatial system
    for (const cellData of data.cells || []) {
      for (let layer = 0; layer < cellData.values.length; layer++) {
        const entityId = cellData.values[layer];
        if (entityId !== undefined) {
          // Update position tracking directly
          scene.spatial.restorePosition(entityId, cellData.x, cellData.y, layer);
        }
      }
    }

    return scene;
  }
}
