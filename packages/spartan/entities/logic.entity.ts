/**
 * Logic layer entities for AI, signals, and invisible game mechanics.
 * 
 * These entities exist on the LOGIC layer (invisible to player in gameplay):
 * - Path nodes: NPC patrol paths that also conduct signals
 * - Sleep-wake entities: Signal-controlled zones that activate/deactivate NPCs
 * - Chain links: Propagation entities for chain reactions
 */

import type { BaseEntityData } from './base.entity';
import type { HasColor } from '../traits/visual.trait';
import type { HasSignalReceiver, HasConductive } from '../traits/signal.trait';

/**
 * Chain Link - Entity for chain reaction propagation.
 * 
 * Used by chain reaction system to propagate effects through linked entities.
 * 
 * @example
 * ```typescript
 * spatial.spawn('chain-link', 5, 5, GameLayers.LOGIC, {
 *   propagationType: 'chain',
 *   spreadRate: 1,
 *   spreadLayer: GameLayers.LOGIC,
 *   spreadType: 'chain-link',
 *   color: '#ff6600'
 * });
 * ```
 */
export type ChainLinkData = BaseEntityData & HasColor & {
  type: 'chain-link';
  propagationType: 'chain';
  spreadRate: number;
  spreadLayer: number;
  spreadType: string;
};

/**
 * Path Node - NPC patrol path waypoint that also conducts signals.
 * 
 * Dual purpose:
 * - Defines NPC movement paths (for AI systems)
 * - Conducts signals on LOGIC layer (invisible signal network)
 * 
 * Signals propagate through adjacent path nodes, enabling
 * "behind the scenes" automation without visible wiring.
 * 
 * @example
 * ```typescript
 * spatial.spawn('path-node', 5, 5, GameLayers.LOGIC, {
 *   conductiveType: 'path',
 *   receivedSignal: false,
 *   color: '#888888'
 * });
 * ```
 */
export type PathNodeData = BaseEntityData & HasConductive & HasSignalReceiver & HasColor & {
  type: 'path-node';
  conductiveType: 'path';
  receiverType: 'path';
};

/**
 * Sleep-Wake Entity - Signal-controlled NPC activation zone.
 * 
 * Behavior:
 * - receivedSignal = true → NPCs on this cell become active (awake)
 * - receivedSignal = false → NPCs on this cell become inactive (asleep)
 * - Signals propagate to adjacent sleep-wake entities
 * 
 * Users paint contiguous areas in editor to create zones.
 * Signal enters one entity and propagates through the painted region.
 * 
 * Use cases:
 * - Performance: Keep distant NPCs asleep until player approaches
 * - Dramatic reveals: Wake room of enemies when pressure plate triggered
 * - Scripted encounters: Trigger ambush when entering area
 * 
 * @example
 * ```typescript
 * spatial.spawn('sleep-wake', 5, 5, GameLayers.LOGIC, {
 *   receiverType: 'sleep-wake',
 *   conductiveType: 'sleep-wake',
 *   receivedSignal: false,
 *   color: '#9900ff'
 * });
 * ```
 */
export type SleepWakeData = BaseEntityData & HasSignalReceiver & HasConductive & HasColor & {
  type: 'sleep-wake';
  receiverType: 'sleep-wake';
  conductiveType: 'sleep-wake';
};
