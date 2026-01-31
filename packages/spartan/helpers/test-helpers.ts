import { GameLoop } from '../core/game-loop';
import { SYSTEM_CONFIG } from '../config/systems.config';

/**
 * Advance game loop until fire spreads (based on configured tick rate).
 */
export function advanceUntilFireSpreads(gameLoop: GameLoop): void {
  gameLoop.tickN(SYSTEM_CONFIG.Fire.tickRate);
}

/**
 * Advance game loop until liquid flows.
 */
export function advanceUntilLiquidFlows(gameLoop: GameLoop): void {
  gameLoop.tickN(SYSTEM_CONFIG.Liquid.tickRate);
}

/**
 * Advance game loop by N cycles of fire spread.
 */
export function advanceSpreadCycles(gameLoop: GameLoop, cycles: number = 1): void {
  const rate = SYSTEM_CONFIG.Fire.tickRate;
  gameLoop.tickN(rate * cycles);
}
