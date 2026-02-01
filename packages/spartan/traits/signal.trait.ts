/**
 * Signal system traits for switches, conductors, and receivers.
 * 
 * These traits enable signal propagation through conductive networks:
 * - Emitters generate on/off signals (oscillators, pressure switches, inverters)
 * - Conductors carry signals between cells (conductive floors)
 * - Receivers respond to signals (gates, inverters)
 */

/**
 * HasSignalEmitter - Entity can generate and broadcast signals.
 * 
 * Used by:
 * - Oscillators: Auto-toggle every N ticks
 * - Pressure switches: Toggle when stepped on
 * - Inverters: Emit inverted input signal
 */
export interface HasSignalEmitter {
  /** Type of signal emitter */
  signalType: 'oscillator' | 'pressure' | 'inverter' | 'transceiver';

  /** Current signal state (on = true, off = false) */
  signalState: boolean;

  /** Oscillator-specific: Ticks per full cycle (default 40 = 20 on, 20 off) */
  oscillatorPeriod?: number;
}

/**
 * HasSignalReceiver - Entity can receive and respond to signals.
 * 
 * Used by:
 * - Gates: Open when receiving ON signal, close when OFF
 * - Inverters: Invert received signal and emit it
 */
export interface HasSignalReceiver {
  /** Type of receiver */
  receiverType: 'gate' | 'inverter' | 'floor' | 'transceiver';

  /** Current received signal state */
  receivedSignal: boolean;
}

/**
 * HasConductive - Entity can carry signals to adjacent cells.
 * 
 * Used by:
 * - Conductive floors: Carry signals in 4 directions
 * 
 * Note: Signal emitters and receivers are also implicitly conductive
 * (signals can propagate through them).
 */
export interface HasConductive {
  /** Type of conductor */
  conductiveType: 'floor';
}

// ============================================================================
// Signal Propagation System
// ============================================================================

/**
 * Signal - Represents a propagating signal with origin tracking.
 * 
 * Signals are created by emitters and propagate through the grid.
 * Each signal tracks its origin tick and source for proper delay handling.
 */
export interface Signal {
  /** Tick when this signal was created */
  originTick: number;

  /** Entity ID that originally emitted this signal */
  sourceId: number;

  /** Signal power state */
  power: boolean;

  /** Optional channel for transceiver broadcast */
  channel?: string;
}

/**
 * SignalGrid - Manages per-cell signal state for the current tick.
 * 
 * Key features:
 * - Tracks signals per cell coordinate
 * - Distinguishes receiving vs emitting via sourceId
 * - Enables tick-delay by comparing originTick
 */
export class SignalGrid {
  private cellSignals = new Map<string, Signal[]>();
  private entitySignals = new Map<number, Signal>();

  /** Current game tick for signal creation */
  public currentTick = 0;

  /** Clear all signals (call at start of each tick) */
  clear(): void {
    this.cellSignals.clear();
    this.entitySignals.clear();
  }

  /** Add a signal at a cell coordinate */
  addSignal(x: number, y: number, signal: Signal): void {
    const key = `${x}:${y}`;
    const existing = this.cellSignals.get(key) || [];
    existing.push(signal);
    this.cellSignals.set(key, existing);
  }

  /** Mark an entity as having signal (for quick lookup) */
  markEntity(entityId: number, signal: Signal): void {
    this.entitySignals.set(entityId, signal);
  }

  /** Check if entity has any signal this tick */
  hasSignal(entityId: number): boolean {
    return this.entitySignals.has(entityId);
  }

  /** Get the signal for an entity (if any) */
  getSignal(entityId: number): Signal | undefined {
    return this.entitySignals.get(entityId);
  }

  /** 
   * Check if entity received signal (not from itself).
   * Returns true if entity has signal AND was not the source.
   */
  isReceiving(entityId: number): boolean {
    const signal = this.entitySignals.get(entityId);
    return signal !== undefined && signal.sourceId !== entityId;
  }

  /**
   * Check if signal is from previous tick (for tick-delay).
   * Returns true if entity has signal from originTick < currentTick.
   */
  hasDelayedSignal(entityId: number): boolean {
    const signal = this.entitySignals.get(entityId);
    return signal !== undefined && signal.originTick < this.currentTick;
  }

  /** Get all entity IDs that have signals */
  getAllSignaledEntities(): number[] {
    return Array.from(this.entitySignals.keys());
  }
}
