import { GameRuntime } from '../core/game-runtime';
import type { GameSystem, EntityData } from '../core/types';
import { hasWeapon, hasHealth } from '../traits/trait-guards';

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
      // Add to persistent systems and game loop using public API
      runtime.addSystem(system);
    }
  }

  return runtime;
}

/**
 * Get ammo count for a specific weapon type from an entity.
 * Returns undefined if entity doesn't have weapon trait or ammo type.
 */
export function getAmmo(entity: EntityData | undefined, weaponType: string): number | undefined {
  if (!entity || !hasWeapon(entity)) return undefined;
  return entity.ammo[weaponType];
}

/**
 * Get HP from an entity.
 * Returns undefined if entity doesn't have health trait.
 */
export function getHp(entity: EntityData | undefined): number | undefined {
  if (!entity || !hasHealth(entity)) return undefined;
  return entity.hp;
}

/**
 * Get max HP from an entity.
 * Returns undefined if entity doesn't have health trait.
 */
export function getMaxHp(entity: EntityData | undefined): number | undefined {
  if (!entity || !hasHealth(entity)) return undefined;
  return entity.maxHp;
}
