/**
 * @brief Utilities for writing game tests.
 */
import { GameLoop } from '../core/game-loop';
import { SYSTEM_CONFIG } from '../config/systems.config';

/**
 * Advance game loop for N ticks.
 *
 * Helper to advance multiple ticks since GameLoop.tick() advances one tick.
 */
function tickN(gameLoop: GameLoop, n: number): void {
  for (let i = 0; i < n; i++) {
    gameLoop.tick();
  }
}

/**
 * Advance game loop until fire spreads (based on configured tick rate).
 */
export function advanceUntilFireSpreads(gameLoop: GameLoop): void {
  tickN(gameLoop, SYSTEM_CONFIG.Fire.tickRate);
}

/**
 * Advance game loop until liquid flows.
 */
export function advanceUntilLiquidFlows(gameLoop: GameLoop): void {
  tickN(gameLoop, SYSTEM_CONFIG.Liquid.tickRate);
}

/**
 * Advance game loop by N cycles of fire spread.
 */
export function advanceSpreadCycles(gameLoop: GameLoop, cycles: number = 1): void {
  const rate = SYSTEM_CONFIG.Fire.tickRate;
  tickN(gameLoop, rate * cycles);
}
