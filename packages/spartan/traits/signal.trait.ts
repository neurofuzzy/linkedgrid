/**
 * Signal system traits for switches, conductors, and receivers.
 * 
 * These traits enable signal propagation through conductive networks:
 * - Emitters generate on/off signals (oscillators, pressure switches, inverters)
 * - Conductors carry signals between cells (conductive floors)
 * - Receivers respond to signals (bollards, inverters)
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
  signalType: 'oscillator' | 'pressure' | 'inverter';

  /** Current signal state (on = true, off = false) */
  signalState: boolean;

  /** Oscillator-specific: Ticks per full cycle (default 40 = 20 on, 20 off) */
  oscillatorPeriod?: number;
}

/**
 * HasSignalReceiver - Entity can receive and respond to signals.
 * 
 * Used by:
 * - Bollards: Open when receiving ON signal, close when OFF
 * - Inverters: Invert received signal and emit it
 */
export interface HasSignalReceiver {
  /** Type of receiver */
  receiverType: 'bollard' | 'inverter' | 'floor';

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
