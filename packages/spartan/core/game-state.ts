import { SparseEntityStore } from './entity-store';
import type { ObjectiveDefinition } from '../traits/objective.trait';
import { VisualEventBus } from './visual-event-bus';
import { EffectsQueue } from './effects-queue';

/**
 * GameState - Global game state that persists across scenes.
 *
 * Manages player progression, inventory, upgrades, and entity ID generation.
 * Now includes the global entity store - all entities exist here regardless of scene.
 *
 * @example
 * ```typescript
 * const gameState = new GameState();
 * gameState.lives = 3;
 * gameState.score = 1000;
 * gameState.inventory.set('key', 3);
 *
 * // Global entity storage
 * const playerId = gameState.entityStore.createId('player', { sceneId: 'room1', hp: 100 });
 * ```
 */
/**
 * @brief Persistent state management including connectivity and flags.
 */
export class GameState {
  /** Global entity store - all entities in the game live here */
  entityStore: SparseEntityStore;

  /** Player entity ID (tracked globally across scenes) */
  playerEntityId: number = 0;

  /** Initial scene ID (for fallback respawn when no checkpoint) */
  initialSceneId: string = '';

  /** Maximum lives (starting lives, used for reset) */
  maxLives: number = 3;

  /** Current player lives */
  lives: number = 3;

  /** Player score */
  score: number = 0;

  /** Inventory: item type → quantity */
  inventory: Map<string, number> = new Map();

  /** Temporary buffs: buff name → expiration timestamp */
  buffs: Map<string, number> = new Map();

  /** Permanent upgrades: upgrade name */
  upgrades: Set<string> = new Set();

  /** Boolean flags: flag name → state */
  flags: Map<string, boolean> = new Map();

  /** Game objectives (tracked by ObjectiveSystem) */
  objectives: ObjectiveDefinition[] = [];

  /** Arbitrary game-specific data */
  data: Map<string, unknown> = new Map();

  /** Visual event bus for view layer subscriptions (persists across scenes) */
  visualEventBus: VisualEventBus = new VisualEventBus();

  /** Effects queue for view layer consumption (persists across scenes) */
  effectsQueue: EffectsQueue = new EffectsQueue();

  /** Cross-scene connections: key → array of scene locations */
  connections: Map<
    string,
    Array<{ sceneId: string; x: number; y: number; layer: number }>
  > = new Map();

  /** Global entity ID counter (prevents collisions across scenes) */
  private nextEntityId: number = 1;

  constructor() {
    // Initialize global entity store with this GameState's ID generator
    this.entityStore = new SparseEntityStore(() => this.generateEntityId());
  }

  /**
   * Generate a globally unique entity ID.
   *
   * This ensures entity IDs are unique across all scenes in the game.
   * Used internally by the global entityStore.
   *
   * @returns A unique entity ID
   *
   * @example
   * ```typescript
   * const playerId = gameState.generateEntityId();
   * const enemyId = gameState.generateEntityId();
   * // playerId !== enemyId, guaranteed unique
   * ```
   */
  generateEntityId(): number {
    return this.nextEntityId++;
  }

  /**
   * Add a connection between scenes.
   *
   * Used for teleporters, linked switches, multi-room puzzles.
   *
   * @param key - Connection identifier (e.g., 'teleporter:red', 'switch:A')
   * @param sceneId - Target scene ID
   * @param x - X coordinate in target scene
   * @param y - Y coordinate in target scene
   * @param layer - Layer in target scene
   *
   * @example
   * ```typescript
   * // Link two teleporters
   * gameState.addConnection('teleporter:red', 'room1', 5, 5, 3);
   * gameState.addConnection('teleporter:red', 'room2', 10, 10, 3);
   * ```
   */
  addConnection(
    key: string,
    sceneId: string,
    x: number,
    y: number,
    layer: number
  ): void {
    const existing = this.connections.get(key) || [];
    existing.push({ sceneId, x, y, layer });
    this.connections.set(key, existing);
  }

  /**
   * Get all connections for a given key.
   *
   * @param key - Connection identifier
   * @returns Array of connection locations, or empty array if not found
   *
   * @example
   * ```typescript
   * const teleporters = gameState.getConnections('teleporter:red');
   * for (const loc of teleporters) {
   *   console.log(`Teleporter at ${loc.sceneId} (${loc.x}, ${loc.y})`);
   * }
   * ```
   */
  getConnections(
    key: string
  ): Array<{ sceneId: string; x: number; y: number; layer: number }> {
    return this.connections.get(key) || [];
  }

  /**
   * Get all connection keys and their endpoints.
   *
   * Used for debugging, editor visualization, and validation.
   *
   * @returns Copy of the connections map
   *
   * @example
   * ```typescript
   * const allConnections = gameState.getAllConnections();
   * for (const [key, endpoints] of allConnections) {
   *   console.log(`Connection "${key}" has ${endpoints.length} endpoints`);
   * }
   * ```
   */
  getAllConnections(): Map<
    string,
    Array<{ sceneId: string; x: number; y: number; layer: number }>
  > {
    return new Map(this.connections);
  }

  /**
   * Remove connections by key.
   *
   * If sceneId is provided, only removes connections to that scene.
   * Otherwise removes all connections for the key.
   *
   * @param key - Connection identifier
   * @param sceneId - Optional scene ID to filter by
   *
   * @example
   * ```typescript
   * // Remove all red teleporters
   * gameState.removeConnection('teleporter:red');
   *
   * // Remove only red teleporters in room1
   * gameState.removeConnection('teleporter:red', 'room1');
   * ```
   */
  removeConnection(key: string, sceneId?: string): void {
    if (sceneId) {
      const existing = this.connections.get(key);
      if (existing) {
        const filtered = existing.filter((conn) => conn.sceneId !== sceneId);
        if (filtered.length > 0) {
          this.connections.set(key, filtered);
        } else {
          this.connections.delete(key);
        }
      }
    } else {
      this.connections.delete(key);
    }
  }

  /**
   * Serialize GameState to plain object for saving.
   *
   * Converts Maps and Sets to arrays for JSON serialization.
   * Includes all entities from the global entity store.
   *
   * @returns Plain object representation
   */
  serialize(): object {
    // Serialize all entities
    const entities = this.entityStore
      .getAllIds()
      .map((id) => this.entityStore.getData(id));

    return {
      playerEntityId: this.playerEntityId,
      initialSceneId: this.initialSceneId,
      maxLives: this.maxLives,
      lives: this.lives,
      score: this.score,
      objectives: this.objectives,
      inventory: Array.from(this.inventory.entries()),
      buffs: Array.from(this.buffs.entries()),
      upgrades: Array.from(this.upgrades),
      flags: Array.from(this.flags.entries()),
      data: Array.from(this.data.entries()),
      connections: Array.from(this.connections.entries()),
      nextEntityId: this.nextEntityId,
      entities,
    };
  }

  /**
   * Deserialize GameState from plain object.
   *
   * @param data - Serialized game state data
   * @returns New GameState instance
   */
  static deserialize(data: {
    playerEntityId?: number;
    initialSceneId?: string;
    maxLives?: number;
    lives?: number;
    score?: number;
    objectives?: ObjectiveDefinition[];
    inventory?: Array<[string, number]>;
    buffs?: Array<[string, number]>;
    upgrades?: string[];
    flags?: Array<[string, boolean]>;
    data?: Array<[string, unknown]>;
    connections?: Array<[string, Array<{ sceneId: string; x: number; y: number; layer: number }>]>;
    nextEntityId?: number;
    entities?: Array<{ id: number; type: string;[key: string]: unknown }>;
  }): GameState {
    const state = new GameState();
    state.playerEntityId = data.playerEntityId ?? 0;
    state.initialSceneId = data.initialSceneId ?? '';
    state.maxLives = data.maxLives ?? 3;
    state.lives = data.lives ?? 3;
    state.score = data.score ?? 0;
    state.objectives = data.objectives ?? [];
    state.inventory = new Map(data.inventory ?? []);
    state.buffs = new Map(data.buffs ?? []);
    state.upgrades = new Set(data.upgrades ?? []);
    state.flags = new Map(data.flags ?? []);
    state.data = new Map(data.data ?? []);
    state.connections = new Map(data.connections ?? []);
    state.nextEntityId = data.nextEntityId ?? 1;

    // Restore all entities to global store
    for (const entityData of data.entities || []) {
      state.entityStore.createWithId(entityData.id, entityData.type, {
        ...entityData,
        id: undefined,
        type: undefined,
      });
    }

    return state;
  }
}
