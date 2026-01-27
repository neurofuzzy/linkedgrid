/**
 * GameState - Global game state that persists across scenes.
 * 
 * Manages player progression, inventory, upgrades, and entity ID generation.
 * Decoupled from spatial state (which lives in individual scenes).
 * 
 * @example
 * ```typescript
 * const gameState = new GameState();
 * gameState.lives = 3;
 * gameState.score = 1000;
 * gameState.inventory.set('key', 3);
 * 
 * // Global entity ID generation
 * const id1 = gameState.generateEntityId(); // 1
 * const id2 = gameState.generateEntityId(); // 2
 * ```
 */
export class GameState {
    /** Player entity ID (tracked globally across scenes) */
    playerEntityId: number = 0;

    /** Player lives/health pool */
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

    /** Arbitrary game-specific data */
    data: Map<string, unknown> = new Map();

    /** Cross-scene connections: key → array of scene locations */
    connections: Map<string, Array<{sceneId: string, x: number, y: number, layer: number}>> = new Map();

    /** Global entity ID counter (prevents collisions across scenes) */
    private nextEntityId: number = 1;

    /**
     * Generate a globally unique entity ID.
     * 
     * This ensures entity IDs are unique across all scenes in the game.
     * All SparseEntityStore instances should use this generator.
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
    addConnection(key: string, sceneId: string, x: number, y: number, layer: number): void {
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
    getConnections(key: string): Array<{sceneId: string, x: number, y: number, layer: number}> {
        return this.connections.get(key) || [];
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
                const filtered = existing.filter(conn => conn.sceneId !== sceneId);
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
     * 
     * @returns Plain object representation
     */
    serialize(): object {
        return {
            playerEntityId: this.playerEntityId,
            lives: this.lives,
            score: this.score,
            inventory: Array.from(this.inventory.entries()),
            buffs: Array.from(this.buffs.entries()),
            upgrades: Array.from(this.upgrades),
            flags: Array.from(this.flags.entries()),
            data: Array.from(this.data.entries()),
            connections: Array.from(this.connections.entries()),
            nextEntityId: this.nextEntityId,
        };
    }

    /**
     * Deserialize GameState from plain object.
     * 
     * @param data - Serialized game state data
     * @returns New GameState instance
     */
    static deserialize(data: any): GameState {
        const state = new GameState();
        state.playerEntityId = data.playerEntityId ?? 0;
        state.lives = data.lives ?? 3;
        state.score = data.score ?? 0;
        state.inventory = new Map(data.inventory ?? []);
        state.buffs = new Map(data.buffs ?? []);
        state.upgrades = new Set(data.upgrades ?? []);
        state.flags = new Map(data.flags ?? []);
        state.data = new Map(data.data ?? []);
        state.connections = new Map(data.connections ?? []);
        state.nextEntityId = data.nextEntityId ?? 1;
        return state;
    }
}
