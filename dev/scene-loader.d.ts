import { GameRuntime } from '../packages/spartan/core/game-runtime';
/**
 * Entity definition in JSON scene.
 */
export interface EntityDefinition {
    type: string;
    x: number;
    y: number;
    layer: number;
    data?: Record<string, unknown>;
    props?: Record<string, unknown>;
}
/**
 * Scene definition in JSON config.
 */
export interface SceneDefinition {
    id: string;
    name?: string;
    width: number;
    height: number;
    entities?: EntityDefinition[];
    metadata?: Record<string, unknown>;
}
/**
 * Complete scene configuration file format.
 */
export interface SceneConfig {
    scenes: SceneDefinition[];
    initialScene: string;
    systems?: string[];
    tickRate?: number;
    input?: {
        type: 'keyboard' | 'headless' | 'none';
        options?: {
            bufferInput?: boolean;
            directionMode?: 'continuous' | 'tap';
            cellSize?: number;
            cellGap?: number;
        };
    };
}
/**
 * SceneLoader - Parse JSON scene configs and initialize GameRuntime.
 *
 * Handles:
 * - Creating GameRuntime with initial scene
 * - Adding additional scenes to SceneManager
 * - Spawning entities in each scene
 * - Registering systems by name
 *
 * @example
 * ```typescript
 * const loader = new SceneLoader();
 * const config = await fetch('/dev/games/basic.json').then(r => r.json());
 * const runtime = loader.load(config);
 * runtime.start();
 * ```
 */
export declare class SceneLoader {
    private container?;
    constructor(container?: (HTMLElement | null) | undefined);
    /**
     * Load scene configuration and create initialized GameRuntime.
     *
     * @param config - Scene configuration from JSON
     * @returns Initialized GameRuntime ready to start
     */
    load(config: SceneConfig): GameRuntime;
    /**
     * Create input manager based on configuration.
     *
     * @param config - Input configuration from scene config
     * @param container - DOM container for keyboard/mouse input
     * @returns Input manager instance and cleanup function
     */
    private createInputManager;
    /**
     * Populate a scene with entities from definition.
     *
     * @param runtime - GameRuntime instance
     * @param sceneDef - Scene definition with entities
     */
    private populateScene;
    /**
     * Validate scene configuration.
     *
     * @param config - Scene configuration to validate
     * @returns Array of validation errors (empty if valid)
     */
    static validate(config: SceneConfig): string[];
}
//# sourceMappingURL=scene-loader.d.ts.map