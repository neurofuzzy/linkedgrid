/**
 * Signal system entities: switches, conductors, and receivers.
 * 
 * These entities form signal propagation networks:
 * - Oscillators and pressure switches generate signals
 * - Conductive floors carry signals between cells
 * - Bollards and inverters respond to signals
 */

import type { BaseEntityData } from './base.entity';
import type { HasColor } from '../traits/visual.trait';
import type { HasSignalEmitter, HasSignalReceiver, HasConductive } from '../traits/signal.trait';

/**
 * Oscillator - Automatically toggles on/off signal at fixed intervals.
 * 
 * Default period: 40 ticks (20 on, 20 off) = 4 seconds total at 10 TPS
 * 
 * @example
 * ```typescript
 * spatial.spawn('oscillator', 5, 5, GameLayers.COLLECTIBLES, {
 *   signalState: true,
 *   oscillatorPeriod: 40,
 *   color: '#ffff00'
 * });
 * ```
 */
export type OscillatorData = BaseEntityData & HasSignalEmitter & HasColor & {
  type: 'oscillator';
  signalType: 'oscillator';
};

/**
 * Pressure Switch - Toggles signal when an entity steps on it.
 * 
 * Toggle behavior: Steps on → switches state (on→off or off→on)
 * Edge-triggered: Only toggles on entry, not while standing
 * 
 * @example
 * ```typescript
 * spatial.spawn('pressure-switch', 5, 5, GameLayers.COLLECTIBLES, {
 *   signalState: false,
 *   color: '#00ffff'
 * });
 * ```
 */
export type PressureSwitchData = BaseEntityData & HasSignalEmitter & HasColor & {
  type: 'pressure-switch';
  signalType: 'pressure';
};

/**
 * Inverter - Receives signal and emits inverted signal (NOT gate).
 * 
 * Behavior:
 * - Receives ON → Emits OFF
 * - Receives OFF → Emits ON
 * - One tick delay between input change and output effect
 * 
 * @example
 * ```typescript
 * spatial.spawn('inverter', 7, 5, GameLayers.COLLECTIBLES, {
 *   signalState: false,
 *   receivedSignal: false,
 *   color: '#ff00ff'
 * });
 * ```
 */
export type InverterData = BaseEntityData & HasSignalEmitter & HasSignalReceiver & HasColor & {
  type: 'inverter';
  signalType: 'inverter';
  receiverType: 'inverter';
};

/**
 * Conductive Floor - Carries signals in 4 directions (up, down, left, right).
 * 
 * Signals propagate through conductive networks via flood-fill.
 * Conductive floors allow signals to jump between switches and receivers.
 * 
 * @example
 * ```typescript
 * spatial.spawn('conductive-floor', 6, 5, GameLayers.FLOOR, {
 *   color: '#808080'
 * });
 * ```
 */
export type ConductiveFloorData = BaseEntityData & HasConductive & HasSignalReceiver & HasColor & {
  type: 'conductive-floor';
  conductiveType: 'floor';
  receiverType: 'floor';
};

/**
 * Bollard - Retractable wall controlled by signal.
 * 
 * Signal ON → Bollard opens (moves to FLOOR, non-blocking)
 * Signal OFF → Bollard closes (moves to WALLS, blocking)
 * 
 * Initial state: Closed (WALLS layer)
 * 
 * @example
 * ```typescript
 * // Spawn closed bollard
 * spatial.spawn('bollard', 8, 5, GameLayers.WALLS, {
 *   receivedSignal: false,
 *   color: '#ff0000'
 * });
 * ```
 */
export type BollardData = BaseEntityData & HasSignalReceiver & HasColor & {
  type: 'bollard' | 'bollard-open' | 'bollard-closed';
  receiverType: 'bollard';
};
