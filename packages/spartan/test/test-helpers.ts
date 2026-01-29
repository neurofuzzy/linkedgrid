import { GameRuntime } from '../game-runtime';
import type { GameSystem } from '../types';

/**
 * Create GameRuntime with systems properly registered.
 *
 * This helper ensures systems are added to both runtime.systems
 * and the current gameLoop, so they persist across scene transitions.
 *
 * Without this helper, systems added only via gameLoop.addSystem()
 * are lost when a scene transition occurs. See specs/spartan-system-registration.md
 * for detailed explanation.
 *
 * @param config - Runtime configuration
 * @param config.initialScene - Initial scene definition
 * @param config.systems - Game systems to register (optional)
 * @param config.tickRate - Ticks per second (optional, default: 10)
 * @returns Initialized GameRuntime with systems properly registered
 *
 * @example
 * ```typescript
 * const runtime = createRuntimeWithSystems({
 *   initialScene: { id: 'test', width: 10, height: 10 },
 *   systems: [new TeleporterSystem(gameManager)],
 *   tickRate: 10
 * });
 * ```
 */
export function createRuntimeWithSystems(config: {
  initialScene: {
    id: string;
    width: number;
    height: number;
    metadata?: Record<string, unknown>;
  };
  systems?: GameSystem[];
  tickRate?: number;
}): GameRuntime {
  // Create runtime with empty systems array
  const runtime = GameRuntime.new({
    initialScene: config.initialScene,
    systems: [],
    tickRate: config.tickRate,
  });

  // Register systems with double-registration pattern
  // This ensures they survive scene transitions
  if (config.systems) {
    for (const system of config.systems) {
      // Add to persistent systems array (survives transitions)
      (runtime as any).systems.push(system);

      // Add to current gameLoop (active immediately)
      (runtime as any).gameLoop.addSystem(system);
    }
  }

  return runtime;
}
