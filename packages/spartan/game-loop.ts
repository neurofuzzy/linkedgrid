import { SpatialSystem } from './spatial-system.js';
import type { GameSystem, GameContext } from './types.js';

/**
 * GameLoop - Orchestrates one game tick for a SpatialSystem.
 * 
 * Runs the tick cycle:
 * 1. Detect overlaps from committed state
 * 2. Run all systems (which stage movement intents)
 * 3. Commit all intents atomically
 * 
 * @example
 * ```typescript
 * const gameLoop = new GameLoop(scene.spatial);
 * gameLoop.addSystem(new TeleporterSystem());
 * gameLoop.addSystem(new EnemyAISystem());
 * 
 * // Each turn/frame
 * gameLoop.tick();
 * ```
 */
export class GameLoop {
    private systems: GameSystem[] = [];
    
    constructor(private spatial: SpatialSystem) {}
    
    /**
     * Register a game system to run each tick.
     * 
     * Systems are executed in registration order.
     * 
     * @param system - Game system to register
     * 
     * @example
     * ```typescript
     * gameLoop.addSystem(new TeleporterSystem(gameManager));
     * gameLoop.addSystem(new EnemyAISystem());
     * ```
     */
    addSystem(system: GameSystem): void {
        this.systems.push(system);
    }
    
    /**
     * Execute one game tick synchronously.
     * 
     * 1. Detect overlaps from committed state
     * 2. Run all systems (they stage intents)
     * 3. Commit all intents atomically
     * 
     * @example
     * ```typescript
     * // Manual tick (for testing or turn-based)
     * gameLoop.tick();
     * 
     * // Or called by GameRuntime in real-time loop
     * ```
     */
    tick(): void {
        // 1. Detect overlaps
        const overlaps = this.spatial.detectOverlaps();
        
        // 2. Run systems
        const context: GameContext = {
            overlaps,
            spatial: this.spatial
        };
        
        for (const system of this.systems) {
            system.update(context);
        }
        
        // 3. Commit intents
        this.spatial.commit();
    }
}
