import { Scene } from './scene';
import { GameState } from './game-state';

/**
 * SceneManager - Manages multiple game scenes.
 * 
 * Handles scene creation, deletion, and active scene tracking.
 * All scenes share the same GameState for global entity ID generation.
 * 
 * @example
 * ```typescript
 * const gameState = new GameState();
 * const manager = new SceneManager(gameState);
 * 
 * // Create multiple scenes
 * const dungeon = manager.createScene('dungeon-1', 30, 20, { name: 'Dark Dungeon' });
 * const town = manager.createScene('town', 50, 50, { name: 'Starting Town' });
 * 
 * // Switch between scenes
 * manager.setActiveScene('dungeon-1');
 * const active = manager.getActiveScene();
 * ```
 */
export class SceneManager {
    /** All scenes: scene ID → Scene */
    private scenes: Map<string, Scene> = new Map();

    /** Currently active scene ID */
    private activeSceneId: string | null = null;

    /** Reference to global game state */
    private gameState: GameState;

    /**
     * Create a new SceneManager.
     * 
     * @param gameState - Global game state for entity ID generation
     * 
     * @example
     * ```typescript
     * const gameState = new GameState();
     * const sceneManager = new SceneManager(gameState);
     * ```
     */
    constructor(gameState: GameState) {
        this.gameState = gameState;
    }

    /**
     * Create a new scene.
     * 
     * @param id - Unique scene identifier
     * @param width - Grid width
     * @param height - Grid height
     * @param metadata - Optional scene metadata
     * @returns The created Scene
     * @throws Error if scene ID already exists
     * 
     * @example
     * ```typescript
     * const scene = manager.createScene('room1', 20, 20, {
     *   name: 'Treasure Room',
     *   music: 'dungeon-theme.mp3',
     *   lighting: 'dark'
     * });
     * ```
     */
    createScene(
        id: string,
        width: number,
        height: number,
        metadata?: Record<string, unknown>
    ): Scene {
        if (this.scenes.has(id)) {
            throw new Error(`Scene with id "${id}" already exists`);
        }

        const scene = new Scene(id, width, height, this.gameState, metadata);
        this.scenes.set(id, scene);

        // Set as active if this is the first scene
        if (this.activeSceneId === null) {
            this.activeSceneId = id;
        }

        return scene;
    }

    /**
     * Get a scene by ID.
     * 
     * @param id - Scene identifier
     * @returns Scene if found, undefined otherwise
     * 
     * @example
     * ```typescript
     * const scene = manager.getScene('dungeon-1');
     * if (scene) {
     *   console.log(`Scene size: ${scene.grid.width}x${scene.grid.height}`);
     * }
     * ```
     */
    getScene(id: string): Scene | undefined {
        return this.scenes.get(id);
    }

    /**
     * Get the currently active scene.
     * 
     * @returns Active scene, or null if no scenes exist
     * 
     * @example
     * ```typescript
     * const active = manager.getActiveScene();
     * if (active) {
     *   console.log(`Current scene: ${active.id}`);
     * }
     * ```
     */
    getActiveScene(): Scene | null {
        if (this.activeSceneId === null) {
            return null;
        }
        return this.scenes.get(this.activeSceneId) || null;
    }

    /**
     * Set the active scene.
     * 
     * @param id - Scene identifier to make active
     * @returns true if successful, false if scene not found
     * 
     * @example
     * ```typescript
     * if (manager.setActiveScene('town')) {
     *   console.log('Switched to town scene');
     * } else {
     *   console.log('Scene not found');
     * }
     * ```
     */
    setActiveScene(id: string): boolean {
        if (!this.scenes.has(id)) {
            return false;
        }
        this.activeSceneId = id;
        return true;
    }

    /**
     * Get all scene IDs.
     * 
     * @returns Array of scene identifiers
     * 
     * @example
     * ```typescript
     * const allScenes = manager.getAllSceneIds();
     * console.log(`Total scenes: ${allScenes.length}`);
     * ```
     */
    getAllSceneIds(): string[] {
        return Array.from(this.scenes.keys());
    }

    /**
     * Delete a scene.
     * 
     * Removes the scene and cleans up its resources.
     * If deleting the active scene, sets active to null.
     * 
     * @param id - Scene identifier to delete
     * @returns true if scene was deleted, false if not found
     * 
     * @example
     * ```typescript
     * if (manager.deleteScene('old-dungeon')) {
     *   console.log('Scene removed');
     * }
     * ```
     */
    deleteScene(id: string): boolean {
        const scene = this.scenes.get(id);
        if (!scene) {
            return false;
        }

        // Clear scene data
        scene.store.clear();
        // Note: LinkedGrid and SpatialSystem don't have explicit cleanup needed

        // Remove from map
        this.scenes.delete(id);

        // Update active scene if we deleted it
        if (this.activeSceneId === id) {
            // Set to first available scene, or null if none
            const remaining = this.getAllSceneIds();
            this.activeSceneId = remaining.length > 0 ? remaining[0] : null;
        }

        return true;
    }

    /**
     * Get the active scene ID.
     * 
     * @returns Active scene ID or null
     */
    get activeId(): string | null {
        return this.activeSceneId;
    }

    /**
     * Get the number of scenes.
     * 
     * @returns Scene count
     */
    get sceneCount(): number {
        return this.scenes.size;
    }
}
