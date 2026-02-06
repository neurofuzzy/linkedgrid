/**
 * Signal system entities: switches, conductors, and receivers.
 * 
 * These entities form signal propagation networks:
 * - Oscillators and pressure switches generate signals
 * - Conductive floors carry signals between cells
 * - Gates and inverters respond to signals
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
 * Supports 4 activation modes:
 * - toggle: Flips state on each step (default)
 * - hold: ON while pressed, OFF when released
 * - latch: OFF → ON on first press, stays ON forever
 * - inverted-latch: ON → OFF on first press, stays OFF forever
 * 
 * @example
 * ```typescript
 * spatial.spawn('pressure-switch', 5, 5, GameLayers.COLLECTIBLES, {
 *   signalState: false,
 *   switchMode: 'toggle',
 *   color: '#00ffff'
 * });
 * ```
 */
export type PressureSwitchData = BaseEntityData & HasSignalEmitter & HasColor & {
  type: 'pressure-switch';
  signalType: 'pressure';
  switchMode?: 'toggle' | 'hold' | 'latch' | 'inverted-latch';
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
 * Gate - Retractable wall controlled by signal.
 * 
 * Signal ON → Gate opens (moves to FLOOR, non-blocking)
 * Signal OFF → Gate closes (moves to WALLS, blocking)
 * 
 * Initial state: Closed (WALLS layer)
 * 
 * @example
 * ```typescript
 * // Spawn closed gate
 * spatial.spawn('gate', 8, 5, GameLayers.WALLS, {
 *   receivedSignal: false,
 *   color: '#ff0000'
 * });
 * ```
 */
/**
 * Gate - Blocks movement when closed (on WALLS layer), allows movement when open (on FLOOR layer).
 * 
 * Behavior:
 * - Default: Closed (blocks path)
 * - Signal ON: Opens (allows path)
 * - Tick-delay: Immediate (within same tick)
 */
export type GateData = BaseEntityData & HasSignalReceiver & HasColor & {
  type: 'gate' | 'gate-open' | 'gate-closed';
  receiverType: 'gate';
};

/**
 * Transceiver - Wireless signal relay that broadcasts to all transceivers on same channel.
 * 
 * Behavior:
 * - Receives signal via wired connection (conductive floor)
 * - Broadcasts to ALL transceivers on same channel
 * - Introduces 1-tick delay (active component)
 * 
 * Use cases:
 * - Remote pressure plate to distant door
 * - One oscillator powering multiple isolated areas
 * - Cross-room signaling without conductive path
 * 
 * @example
 * ```typescript
 * spatial.spawn('transceiver', 5, 5, GameLayers.COLLECTIBLES, {
 *   signalState: false,
 *   receivedSignal: false,
 *   channel: 'door-1',
 *   color: '#00ff88'
 * });
 * ```
 */
export type TransceiverData = BaseEntityData & HasSignalEmitter & HasSignalReceiver & HasColor & {
  type: 'transceiver';
  signalType: 'transceiver';
  receiverType: 'transceiver';
  /** Channel identifier - transceivers on same channel are linked */
  channel: string;
};

/**
 * Range Sensor - Proximity-based signal emitter with optional line of sight.
 * 
 * Emits ON when the player is within range (and optionally has LOS),
 * emits OFF when player leaves range or LOS is broken.
 * 
 * Similar to a pressure switch, but activates at a distance.
 * 
 * @example
 * ```typescript
 * spatial.spawn('range-sensor', 5, 5, GameLayers.COLLECTIBLES, {
 *   signalState: false,
 *   sensorRange: 5,
 *   requiresLOS: true,
 *   color: '#00ffaa'
 * });
 * ```
 */
export type RangeSensorData = BaseEntityData & HasSignalEmitter & HasColor & {
  type: 'range-sensor';
  signalType: 'range-sensor';
  /** Detection range in cells (Manhattan distance) */
  sensorRange: number;
  /** Whether line of sight to player is required for activation */
  requiresLOS: boolean;
};
