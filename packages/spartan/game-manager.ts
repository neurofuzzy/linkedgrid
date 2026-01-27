import { GameState } from './game-state';
import { SceneManager } from './scene-manager';
import { Scene } from './scene';
import type { Layer } from './types';

/**
 * GameManager - Top-level container for game state and scenes.
 * 
 * Provides a unified interface for managing both global game state
 * and all spatial scenes in the game.
 * 
 * @example
 * ```typescript
 * const game = new GameManager();
 * 
 * // Create scenes
 * game.sceneManager.createScene('overworld', 100, 100);
 * game.sceneManager.createScene('dungeon', 30, 30);
 * 
 * // Manage global state
 * game.gameState.lives = 3;
 * game.gameState.score = 1000;
 * 
 * // Find player across scenes
 * const playerScene = game.getPlayerScene();
 * const playerPos = game.getPlayerPosition();
 * ```
 */
export class GameManager {
    /** Global game state (lives, score, inventory, etc.) */
    readonly gameState: GameState;

    /** Scene manager for all spatial scenes */
    readonly sceneManager: SceneManager;

    /** Pending scene transition (queued until tick boundary) */
    private pendingSceneTransition?: {
        sceneId: string;
        x: number;
        y: number;
        layer: Layer;
    };

    /**
     * Create a new GameManager.
     * 
     * Initializes both GameState and SceneManager.
     * 
     * @example
     * ```typescript
     * const game = new GameManager();
     * game.gameState.lives = 3;
     * const scene = game.sceneManager.createScene('level1', 20, 20);
     * ```
     */
    constructor() {
        this.gameState = new GameState();
        this.sceneManager = new SceneManager(this.gameState);
    }

    /**
     * Find which scene contains the player entity.
     * 
     * Searches all scenes for the player entity ID.
     * Returns null if player hasn't been spawned yet.
     * 
     * @returns Scene containing the player, or null
     * 
     * @example
     * ```typescript
     * const playerScene = game.getPlayerScene();
     * if (playerScene) {
     *   console.log(`Player is in scene: ${playerScene.id}`);
     * }
     * ```
     */
    getPlayerScene(): Scene | null {
        const playerId = this.gameState.playerEntityId;
        if (playerId === 0) {
            return null; // No player spawned yet
        }

        // Search all scenes for the player entity
        for (const sceneId of this.sceneManager.getAllSceneIds()) {
            const scene = this.sceneManager.getScene(sceneId);
            if (scene) {
                const pos = scene.spatial.getEntityPosition(playerId);
                if (pos !== null) {
                    return scene;
                }
            }
        }

        return null;
    }

    /**
     * Get the player's position across all scenes.
     * 
     * Returns position with scene ID, or null if player not found.
     * 
     * @returns Player position with scene ID, or null
     * 
     * @example
     * ```typescript
     * const pos = game.getPlayerPosition();
     * if (pos) {
     *   console.log(`Player at (${pos.x}, ${pos.y}) in scene ${pos.sceneId}`);
     * }
     * ```
     */
    getPlayerPosition(): {sceneId: string, x: number, y: number, layer: Layer} | null {
        const scene = this.getPlayerScene();
        if (!scene) {
            return null;
        }

        const pos = scene.getPlayerPosition();
        if (!pos) {
            return null;
        }

        return {
            sceneId: scene.id,
            x: pos.x,
            y: pos.y,
            layer: pos.layer
        };
    }

    /**
     * Queue a scene transition to execute at tick boundary.
     * 
     * Queues the transition instead of executing immediately to prevent
     * zombie scenes (systems running in old scene after player leaves).
     * 
     * Call executePendingTransition() to execute the queued transition.
     * 
     * @param targetSceneId - Scene to move player to
     * @param x - X coordinate in target scene
     * @param y - Y coordinate in target scene
     * @param layer - Layer in target scene
     * 
     * @example
     * ```typescript
     * // Teleport player to dungeon entrance (queued)
     * game.movePlayerToScene('dungeon', 5, 5, 5);
     * // Transition executes at end of tick
     * ```
     */
    movePlayerToScene(
        targetSceneId: string,
        x: number,
        y: number,
        layer: Layer
    ): void {
        // Queue instead of executing immediately
        this.pendingSceneTransition = { sceneId: targetSceneId, x, y, layer };
    }

    /**
     * Execute pending scene transition, if any.
     * 
     * Should be called by GameRuntime after game loop tick completes.
     * Returns true if a transition was executed.
     * 
     * @returns true if transition executed, false if no pending transition
     * 
     * @example
     * ```typescript
     * // In GameRuntime.tick()
     * gameLoop.tick();
     * const sceneChanged = game.executePendingTransition();
     * if (sceneChanged) {
     *   // Rebuild game loop for new scene
     * }
     * ```
     */
    executePendingTransition(): boolean {
        if (!this.pendingSceneTransition) return false;
        
        const { sceneId, x, y, layer } = this.pendingSceneTransition;
        
        // Execute the actual transition
        const success = this._movePlayerToSceneImmediate(sceneId, x, y, layer);
        
        this.pendingSceneTransition = undefined;
        return success;
    }

    /**
     * Move player entity from current scene to target scene (immediate execution).
     * 
     * Internal method - use movePlayerToScene() to queue transitions safely.
     * 
     * Safely transfers player entity between scenes:
     * 1. Gets player data from current scene
     * 2. Removes player from current scene
     * 3. Spawns player in target scene
     * 4. Updates active scene
     * 
     * @param targetSceneId - Scene to move player to
     * @param x - X coordinate in target scene
     * @param y - Y coordinate in target scene
     * @param layer - Layer in target scene
     * @returns true if successful, false if failed
     */
    private _movePlayerToSceneImmediate(
        targetSceneId: string,
        x: number,
        y: number,
        layer: Layer
    ): boolean {
        const playerId = this.gameState.playerEntityId;
        if (playerId === 0) {
            return false; // No player to move
        }

        // Get target scene
        const targetScene = this.sceneManager.getScene(targetSceneId);
        if (!targetScene) {
            return false; // Target scene doesn't exist
        }

        // Find current player scene
        const currentScene = this.getPlayerScene();
        if (!currentScene) {
            return false; // Player not in any scene
        }

        // Get player position before removing
        const currentPos = currentScene.spatial.getEntityPosition(playerId);
        if (!currentPos) {
            return false; // Player position not found
        }

        // Get player data before removing
        const playerData = currentScene.store.getData(playerId);
        if (!playerData) {
            return false; // Player data not found
        }

        // Extract properties (excluding id and type which will be set by spawn)
        const playerProps = { ...playerData };
        delete playerProps.id;
        delete playerProps.type;

        // Get stores for rollback
        const currentStore = currentScene.store as any;
        const targetStore = targetScene.store as any;

        // Remove player from current scene
        currentScene.spatial.remove(currentPos.x, currentPos.y, currentPos.layer);
        currentScene.spatial.commit();

        // Spawn player in target scene
        try {
            // We need to spawn with the same ID, so we'll manually handle this
            // First, create the entity data in the target store
            targetStore.data.set(playerId, playerData);

            // Then place in spatial system
            const targetCell = targetScene.grid.cell(x, y);
            if (!targetCell) {
                // Rollback: restore player to original scene
                const originalPos = currentScene.spatial.getEntityPosition(playerId);
                if (originalPos) {
                    currentScene.spatial.spawn(playerData.type, originalPos.x, originalPos.y, originalPos.layer, playerProps);
                }
                return false;
            }

            // Check if layer is occupied
            if (targetCell.getValue(layer) !== undefined) {
                // Rollback: restore player to original scene
                // Restore entity data in store
                currentStore.data.set(playerId, playerData);
                
                // Restore in grid
                const restoreCell = currentScene.grid.cell(currentPos.x, currentPos.y);
                if (restoreCell) {
                    restoreCell.setValue(currentPos.layer, playerId);
                    const positions = (currentScene.spatial as any).positions;
                    positions.set(playerId, currentPos);
                }
                return false;
            }

            // Place player entity in target cell
            targetCell.setValue(layer, playerId);

            // Update position tracking
            const positions = (targetScene.spatial as any).positions;
            positions.set(playerId, { x, y, layer });

            // Update active scene
            this.sceneManager.setActiveScene(targetSceneId);

            return true;
        } catch (error) {
            // If anything fails, attempt to restore player to original scene
            try {
                // Restore entity data in store
                currentStore.data.set(playerId, playerData);
                
                // Restore in grid
                const restoreCell = currentScene.grid.cell(currentPos.x, currentPos.y);
                if (restoreCell) {
                    restoreCell.setValue(currentPos.layer, playerId);
                    const positions = (currentScene.spatial as any).positions;
                    positions.set(playerId, currentPos);
                }
            } catch (e) {
                // Player lost - this is bad but we can't recover
                console.error('Failed to restore player after failed scene transition', e);
            }
            return false;
        }
    }

    /**
     * Save the entire game state to a plain object.
     * 
     * Includes GameState, all scenes, and active scene ID.
     * Can be serialized to JSON for persistence.
     * 
     * @returns SaveData object
     * 
     * @example
     * ```typescript
     * const saveData = game.save();
     * localStorage.setItem('save', JSON.stringify(saveData));
     * ```
     */
    save(): object {
        const scenes = this.sceneManager.getAllSceneIds().map(id => {
            const scene = this.sceneManager.getScene(id);
            return scene ? scene.serialize() : null;
        }).filter(s => s !== null);

        return {
            version: 1,
            timestamp: Date.now(),
            gameState: this.gameState.serialize(),
            scenes,
            activeSceneId: this.sceneManager.activeId
        };
    }

    /**
     * Load game from saved data.
     * 
     * @param data - SaveData object
     * @returns New GameManager instance with loaded state
     * 
     * @example
     * ```typescript
     * const savedData = JSON.parse(localStorage.getItem('save'));
     * const game = GameManager.load(savedData);
     * ```
     */
    static load(data: any): GameManager {
        const game = new GameManager();

        // Restore game state
        game.gameState.playerEntityId = data.gameState.playerEntityId || 0;
        game.gameState.lives = data.gameState.lives || 3;
        game.gameState.score = data.gameState.score || 0;
        game.gameState.inventory = new Map(data.gameState.inventory || []);
        game.gameState.buffs = new Map(data.gameState.buffs || []);
        game.gameState.upgrades = new Set(data.gameState.upgrades || []);
        game.gameState.flags = new Map(data.gameState.flags || []);
        game.gameState.data = new Map(data.gameState.data || []);
        game.gameState.connections = new Map(data.gameState.connections || []);
        (game.gameState as any).nextEntityId = data.gameState.nextEntityId || 1;

        // Restore scenes
        for (const sceneData of data.scenes || []) {
            const scene = Scene.deserialize(sceneData, game.gameState);
            (game.sceneManager as any).scenes.set(scene.id, scene);
        }

        // Restore active scene
        if (data.activeSceneId) {
            game.sceneManager.setActiveScene(data.activeSceneId);
        }

        return game;
    }
}
