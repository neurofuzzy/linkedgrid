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
  signalType: 'oscillator' | 'pressure' | 'inverter' | 'transceiver' | 'range-sensor';

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
 * - Path nodes: Visual feedback for signal state on LOGIC layer
 * - Sleep-wake entities: Toggle NPC active state on LOGIC layer
 */
export interface HasSignalReceiver {
  /** Type of receiver */
  receiverType: 'gate' | 'inverter' | 'floor' | 'transceiver' | 'path' | 'sleep-wake';

  /** Current received signal state */
  receivedSignal: boolean;

  /** Pending signal for 1-tick delay (set this tick, act next tick) */
  pendingSignal?: boolean;
}

/**
 * HasConductive - Entity can carry signals to adjacent cells.
 * 
 * Used by:
 * - Conductive floors: Carry signals in 4 directions on FLOOR layer
 * - Path nodes: Carry signals on LOGIC layer (invisible signal network)
 * - Sleep-wake entities: Carry signals on LOGIC layer (propagate through zones)
 * 
 * Note: Signal emitters and receivers are also implicitly conductive
 * (signals can propagate through them).
 */
export interface HasConductive {
  /** Type of conductor */
  conductiveType: 'floor' | 'path' | 'sleep-wake';
}

// ============================================================================
// Signal Propagation System
// ============================================================================

// ============================================================================
// Signal Propagation System
// ============================================================================

/**
 * SignalGrid - Manages powered state of entities for the current tick.
 * 
 * Simplified to just track presence of signal (ON value).
 * The logic system handles delays and propagation rules.
 */
export class SignalGrid {
  private poweredEntities = new Set<number>();

  /** Clear all signals (call at start of each tick) */
  clear(): void {
    this.poweredEntities.clear();
  }

  /** Mark an entity as powered */
  set(entityId: number): void {
    this.poweredEntities.add(entityId);
  }

  /** Check if entity is powered */
  has(entityId: number): boolean {
    return this.poweredEntities.has(entityId);
  }

  /** Get all entity IDs that have signals */
  getAllSignaledEntities(): number[] {
    return Array.from(this.poweredEntities);
  }
}

