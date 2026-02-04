/**
 * @brief Signal System - Queue-Based Event Architecture
 *
 * CORE CONCEPT: Signals are EVENTS that propagate through networks.
 * - Signals are uniquely identified by sourceId + originTick
 * - Signals track visited cells to prevent loops and backfeed
 * - Conductors propagate instantly (same tick), update receivedSignal
 * - STEs (gates, inverters, transceivers) use pendingSignal (1-tick delay)
 * - When pending is applied, STEs emit new signals with backfeed protection
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import type { LinkedCell } from '../core/grid/linked-cell';
import { GameLayers } from '../config/layers.config';
import {
  hasSignalEmitter,
  hasSignalReceiver,
  hasConductive,
  isTransceiver,
  hasAI,
} from '../traits/trait-guards';

/**
 * Signal - Represents a propagating event in the signal network.
 *
 * Immutable event object that tracks:
 * - Origin (sourceId + originTick for unique identification)
 * - Value (ON/OFF boolean)
 * - Visited cells (prevents loops and backfeed)
 */
class Signal {
  readonly id: string;
  readonly visitedCells: Set<string>;

  constructor(
    public readonly sourceId: number,
    public readonly originTick: number,
    public readonly value: boolean,
    visitedCells?: Set<string>
  ) {
    this.id = `${sourceId}-${originTick}`;
    this.visitedCells = visitedCells ? new Set(visitedCells) : new Set();
  }

  /**
   * Mark a cell as visited by this signal.
   */
  markVisited(x: number, y: number): void {
    this.visitedCells.add(`${x}:${y}`);
  }

  /**
   * Check if this signal has already visited a cell.
   */
  hasVisited(x: number, y: number): boolean {
    return this.visitedCells.has(`${x}:${y}`);
  }
}

/**
 * PendingEmission - Tracks STEs that need to emit on next tick.
 * Retains visited cells from incoming signal to prevent backfeed.
 */
interface PendingEmission {
  entityId: number;
  visitedCells: Set<string>;
}

export class SignalSystem extends BaseReactiveSystem {
  // Generator state tracking
  private oscillatorTicks = new Map<number, number>();
  private pressureSwitchStates = new Map<number, boolean>();
  private previousGeneratorStates = new Map<number, boolean>();

  // Track pending emissions for next tick (for backfeed prevention)
  private pendingEmissions: PendingEmission[] = [];

  // Transceiver state tracking
  // Tracks whether each transceiver is powered via WIRED network (not via channel)
  private wiredTransceiverStates = new Map<number, boolean>();
  private channelStates = new Map<string, boolean>();

  // Topology change detection - tracks conductive entity positions
  private conductivePositions = new Map<number, string>();
  // Flag to skip topology reset on first tick (initialization)
  private initialized = false;

  // Tick counter
  private tickCount = 0;

  constructor(private gameManager: GameManager) {
    super();
  }

  update(context: GameContext): void {
    this.tickCount++;

    // Phase 1: Apply pending signals to STEs (gates, inverters, transceivers)
    // This is where pendingSignal becomes receivedSignal
    const emissions = this.applyPendingSignals(context);

    // Update wired transceiver states from applied pending signals
    for (const emission of emissions) {
      const data = context.spatial.getEntityData(emission.entityId);
      if (data && isTransceiver(data) && hasSignalReceiver(data)) {
        // Track wired power state based on the applied signal
        this.wiredTransceiverStates.set(
          emission.entityId,
          data.receivedSignal === true
        );
      }
    }

    // Phase 2: Check if network topology changed (conductive entities moved)
    const topologyChanged = this.checkTopologyChanged(context);

    // Phase 3: Update generators (oscillators, pressure switches)
    this.updateOscillators(context);
    this.updatePressureSwitches(context);

    // Phase 4: Create and propagate signals from generators
    // If topology changed, re-propagate from ALL active generators
    this.propagateFromGenerators(context, topologyChanged);

    // Phase 5: Propagate signals from STEs that just applied pending
    for (const emission of emissions) {
      this.propagateFromSTE(context, emission);
    }

    // Phase 6: Process transceivers (wireless broadcast)
    this.processTransceivers(context);

    // Phase 7: Check inverters for state corrections (handles no-input case)
    this.correctInverterStates(context);
  }

  /**
   * Phase 2: Check if network topology changed.
   * Detects when conductive entities move, which requires re-propagation.
   */
  /**
   * Phase 2: Check if network topology changed.
   * Detects when conductive entities move, which requires re-propagation.
   * Returns false on first tick (initialization) to avoid unnecessary resets.
   */
  private checkTopologyChanged(context: GameContext): boolean {
    let changed = false;
    const currentPositions = new Map<number, string>();

    // Scan all entities for conductive ones
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data) continue;

      // Check if entity is conductive (conductors, signal emitters/receivers)
      if (hasConductive(data) || hasSignalEmitter(data) || hasSignalReceiver(data)) {
        const posKey = `${pos.x}:${pos.y}`;
        currentPositions.set(entityId, posKey);

        // Only check for changes after initialization
        if (this.initialized) {
          const previousPos = this.conductivePositions.get(entityId);
          if (previousPos !== posKey) {
            changed = true;
          }
        }
      }
    }

    // Check for removed entities (only after initialization)
    if (this.initialized) {
      for (const entityId of this.conductivePositions.keys()) {
        if (!currentPositions.has(entityId)) {
          changed = true;
        }
      }
    }

    // Update tracked positions
    this.conductivePositions = currentPositions;

    // Mark as initialized after first scan
    if (!this.initialized) {
      this.initialized = true;
    }

    return changed;
  }

  /**
   * Phase 1: Apply pending signals to STEs.
   * Returns list of entities that should emit signals this tick.
   */
  private applyPendingSignals(context: GameContext): PendingEmission[] {
    // Get pending emissions from last tick
    const emissions = [...this.pendingEmissions];
    this.pendingEmissions = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalReceiver(data)) continue;
      if (data.pendingSignal === undefined) continue;

      const pendingValue = data.pendingSignal;
      const previousReceived = data.receivedSignal;

      // Build update object
      const updates: Record<string, unknown> = {
        receivedSignal: pendingValue,
        pendingSignal: undefined,
      };

      // Inverters: update output state immediately when applying pending
      if (data.receiverType === 'inverter' && hasSignalEmitter(data)) {
        updates.signalState = !pendingValue;
      }

      this.gameManager.gameState.entityStore.setData(entityId, updates);

      // If state changed, find the pending emission (if any) for backfeed protection
      if (previousReceived !== pendingValue) {
        const existingEmission = emissions.find(e => e.entityId === entityId);
        if (!existingEmission) {
          // No existing emission, create one with empty visited cells
          emissions.push({
            entityId,
            visitedCells: new Set(),
          });
        }
      }
    }

    return emissions;
  }

  /**
   * Update oscillator states based on their periods.
   */
  private updateOscillators(context: GameContext): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalEmitter(data) || data.signalType !== 'oscillator') {
        continue;
      }

      const period = data.oscillatorPeriod ?? 40;
      const halfPeriod = Math.floor(period / 2);

      let elapsed = this.oscillatorTicks.get(entityId) ?? 0;
      elapsed++;
      this.oscillatorTicks.set(entityId, elapsed);

      if (elapsed % halfPeriod === 0) {
        this.gameManager.gameState.entityStore.setData(entityId, {
          signalState: !data.signalState,
        });
      }
    }
  }

  /**
   * Update pressure switch states based on actor presence.
   */
  private updatePressureSwitches(context: GameContext): void {
    for (const [switchId, pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(switchId);
      if (!data || !hasSignalEmitter(data) || data.signalType !== 'pressure') {
        continue;
      }

      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      const actorId = cell.getValue(GameLayers.ACTORS);
      const wasPressed = this.pressureSwitchStates.get(switchId) === true;
      const isPressed = actorId !== undefined;
      const switchMode = data.switchMode || 'toggle';

      let newState = data.signalState;

      switch (switchMode) {
        case 'toggle':
          if (isPressed && !wasPressed) {
            newState = !data.signalState;
          }
          break;

        case 'hold':
          newState = isPressed;
          break;

        case 'latch':
          if (isPressed && !wasPressed && !data.signalState) {
            newState = true;
          }
          break;

        case 'inverted-latch':
          if (isPressed && !wasPressed && data.signalState) {
            newState = false;
          }
          break;
      }

      if (newState !== data.signalState) {
        this.gameManager.gameState.entityStore.setData(switchId, {
          signalState: newState,
        });
      }

      this.pressureSwitchStates.set(switchId, isPressed);
    }
  }

  /**
   * Phase 3: Propagate from generators (oscillators, pressure switches).
   */
  /**
   * Phase 4: Propagate from generators (oscillators, pressure switches).
   * If topologyChanged is true, re-propagate from ALL active generators,
   * not just those whose state changed. This ensures the network reflects
   * the current topology after conductive entities move.
   */
  private propagateFromGenerators(context: GameContext, topologyChanged: boolean): void {
    // If topology changed (after initialization), reset ALL receivers to OFF, 
    // then re-propagate. This ensures broken circuits turn off.
    if (topologyChanged) {
      for (const [entityId] of context.spatial.getAllPositions()) {
        const data = context.spatial.getEntityData(entityId);
        if (!data || !hasSignalReceiver(data)) continue;

        const receiverType = data.receiverType;

        // Reset simple conductors immediately
        if (receiverType === 'floor' || receiverType === 'path' || receiverType === 'sleep-wake') {
          this.gameManager.gameState.entityStore.setData(entityId, {
            receivedSignal: false,
          });
        }

        // Reset STEs (gates, inverters, transceivers) via pending
        if (receiverType === 'gate' || receiverType === 'inverter' || receiverType === 'transceiver') {
          this.gameManager.gameState.entityStore.setData(entityId, {
            pendingSignal: false,
          });
        }
      }
    }

    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalEmitter(data)) continue;

      // Skip inverters and transceivers (handled as STEs)
      if (data.signalType === 'transceiver' || data.signalType === 'inverter') {
        continue;
      }

      const currentState = data.signalState;
      const previousState = this.previousGeneratorStates.get(entityId);

      // Propagate if state changed OR if topology changed and generator is active
      const stateChanged = previousState !== currentState;
      const shouldPropagate = stateChanged || (topologyChanged && currentState);

      if (shouldPropagate) {
        this.previousGeneratorStates.set(entityId, currentState);

        const pos = context.spatial.getPosition(entityId);
        if (pos) {
          const signal = new Signal(entityId, this.tickCount, currentState);
          signal.markVisited(pos.x, pos.y);
          this.propagateSignal(context, signal);
        }
      }
    }
  }

  /**
   * Phase 4: Propagate from an STE that just applied its pending signal.
   */
  private propagateFromSTE(context: GameContext, emission: PendingEmission): void {
    const data = context.spatial.getEntityData(emission.entityId);
    if (!data) return;

    const pos = context.spatial.getPosition(emission.entityId);
    if (!pos) return;

    // Determine the value to emit
    let emitValue: boolean;

    if (hasSignalEmitter(data) && data.signalType === 'inverter') {
      // Inverters emit their signalState (which is !receivedSignal)
      emitValue = data.signalState as boolean;
    } else if (hasSignalReceiver(data)) {
      // Gates and other receivers emit their receivedSignal
      emitValue = data.receivedSignal as boolean;
    } else {
      return;
    }

    // Create signal with retained visited cells to prevent backfeed
    const signal = new Signal(
      emission.entityId,
      this.tickCount,
      emitValue,
      emission.visitedCells
    );
    signal.markVisited(pos.x, pos.y);

    this.propagateSignal(context, signal);
  }

  /**
   * Propagate a signal through the network.
   * - Conductors: instant receivedSignal update, continue BFS
   * - STEs: set pendingSignal, store for next tick emission
   */
  private propagateSignal(context: GameContext, signal: Signal): void {
    const queue: Array<{ x: number; y: number }> = [];

    // Start from signal source position
    const sourcePos = context.spatial.getPosition(signal.sourceId);
    if (!sourcePos) return;

    // Add neighbors of source to queue
    const neighbors = this.getNeighbors(sourcePos.x, sourcePos.y);
    for (const neighbor of neighbors) {
      if (!signal.hasVisited(neighbor.x, neighbor.y)) {
        queue.push(neighbor);
      }
    }

    while (queue.length > 0) {
      const pos = queue.shift()!;

      // Skip if already visited
      if (signal.hasVisited(pos.x, pos.y)) continue;

      // Check if valid grid position
      if (!context.spatial.grid.isValid(pos.x, pos.y)) continue;

      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      // Get all signal-relevant entities at this cell
      const entities = this.getSignalEntitiesAtCell(context, cell);
      if (entities.length === 0) continue;

      // Mark cell as visited
      signal.markVisited(pos.x, pos.y);

      // Process entities at this cell
      let shouldContinueBFS = false;

      for (const entityId of entities) {
        const data = context.spatial.getEntityData(entityId);
        if (!data) continue;

        const entityType = this.classifyEntity(data);

        switch (entityType) {
          case 'conductor':
            // Conductors: instant update, continue BFS
            if (hasSignalReceiver(data)) {
              this.gameManager.gameState.entityStore.setData(entityId, {
                receivedSignal: signal.value,
              });
            }
            shouldContinueBFS = true;

            // Sleep-wake: also handle actor activation
            if (hasSignalReceiver(data) && data.receiverType === 'sleep-wake') {
              this.handleSleepWake(context, pos.x, pos.y, signal.value);
            }
            break;

          case 'inverter':
          case 'gate':
          case 'transceiver':
            // STEs: set pending, queue for next tick
            if (hasSignalReceiver(data)) {
              this.gameManager.gameState.entityStore.setData(entityId, {
                pendingSignal: signal.value,
              });

              // Queue emission with visited cells for backfeed prevention
              this.pendingEmissions.push({
                entityId,
                visitedCells: new Set(signal.visitedCells),
              });
            }
            // STEs block BFS
            break;
        }
      }

      // Continue BFS through conductors
      if (shouldContinueBFS) {
        const cellNeighbors = this.getNeighbors(pos.x, pos.y);
        for (const neighbor of cellNeighbors) {
          if (!signal.hasVisited(neighbor.x, neighbor.y)) {
            queue.push(neighbor);
          }
        }
      }
    }
  }

  /**
   * Classify an entity for signal processing.
   */
  private classifyEntity(
    data: Record<string, unknown>
  ): 'conductor' | 'inverter' | 'gate' | 'transceiver' | 'none' {
    // Check for STE types first (more specific)
    if (hasSignalReceiver(data)) {
      if (data.receiverType === 'inverter') return 'inverter';
      if (data.receiverType === 'gate') return 'gate';
      if (data.receiverType === 'transceiver') return 'transceiver';
    }

    // Conductors
    if (hasConductive(data)) return 'conductor';

    // Emitters acting as conductors
    if (hasSignalEmitter(data)) {
      if (data.signalType === 'oscillator' || data.signalType === 'pressure') {
        return 'conductor';
      }
    }

    return 'none';
  }

  /**
   * Phase 6: Correct inverters with mismatched signalState.
   * Handles the case where an inverter hasn't received any signal
   * but its signalState doesn't match !receivedSignal.
   */
  private correctInverterStates(context: GameContext): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalEmitter(data) || data.signalType !== 'inverter') {
        continue;
      }
      if (!hasSignalReceiver(data)) continue;

      // Skip if inverter has pending (will be handled next tick)
      if (data.pendingSignal !== undefined) continue;

      const expectedOutput = !data.receivedSignal;
      const currentOutput = data.signalState;

      // If output doesn't match expected, correct it and queue emission
      if (currentOutput !== expectedOutput) {
        this.gameManager.gameState.entityStore.setData(entityId, {
          signalState: expectedOutput,
        });

        // Queue emission for next tick
        this.pendingEmissions.push({
          entityId,
          visitedCells: new Set(),
        });
      }
    }
  }

  /**
   * Handle sleep-wake entity activation/deactivation of actors.
   */
  private handleSleepWake(
    context: GameContext,
    x: number,
    y: number,
    signalValue: boolean
  ): void {
    const cell = context.spatial.grid.cell(x, y);
    if (!cell) return;

    const actorId = cell.getValue(GameLayers.ACTORS);
    if (actorId === undefined) return;

    const actorData = context.spatial.getEntityData(actorId);
    if (!actorData || !hasAI(actorData)) return;

    this.gameManager.gameState.entityStore.setData(actorId, {
      aiActive: signalValue,
    });
  }

  /**
   * Phase 5: Process transceivers for wireless signal broadcast.
   * Uses wiredTransceiverStates to determine which transceivers power the channel.
   */
  private processTransceivers(context: GameContext): void {
    // Collect all transceivers
    const transceivers: Array<{
      id: number;
      channel: string;
      x: number;
      y: number;
    }> = [];

    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (data && isTransceiver(data)) {
        transceivers.push({
          id: entityId,
          channel: data.channel,
          x: pos.x,
          y: pos.y,
        });
      }
    }

    // Determine which channels are active based on WIRED-powered transceivers only
    // This prevents feedback loops where channel-powered transceivers keep the channel active
    this.channelStates.clear();
    for (const tx of transceivers) {
      // Only count transceivers that are powered via wired network
      if (this.wiredTransceiverStates.get(tx.id) === true) {
        this.channelStates.set(tx.channel, true);
      }
    }

    // Process transceivers on active channels
    for (const tx of transceivers) {
      const isChannelActive = this.channelStates.get(tx.channel) === true;
      const data = context.spatial.getEntityData(tx.id);
      if (!data) continue;

      const previousState = this.previousGeneratorStates.get(tx.id);

      if (isChannelActive) {
        // Mark transceiver as powered (via channel)
        if (hasSignalReceiver(data) && !data.receivedSignal) {
          this.gameManager.gameState.entityStore.setData(tx.id, {
            receivedSignal: true,
          });
        }

        // Emit if state changed
        if (previousState !== true) {
          this.previousGeneratorStates.set(tx.id, true);

          const signal = new Signal(tx.id, this.tickCount, true);
          signal.markVisited(tx.x, tx.y);
          this.propagateSignal(context, signal);
        }
      } else {
        // Channel not active - turn off transceivers that were channel-powered
        if (hasSignalReceiver(data) && data.receivedSignal) {
          this.gameManager.gameState.entityStore.setData(tx.id, {
            receivedSignal: false,
          });
        }

        if (previousState === true) {
          this.previousGeneratorStates.set(tx.id, false);

          const signal = new Signal(tx.id, this.tickCount, false);
          signal.markVisited(tx.x, tx.y);
          this.propagateSignal(context, signal);
        }
      }
    }
  }

  /**
   * Get 4-cardinal neighbors of a position.
   */
  private getNeighbors(x: number, y: number): Array<{ x: number; y: number }> {
    return [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];
  }

  /**
   * Get all signal-relevant entities at a cell.
   * Checks FLOOR, COLLECTIBLES, LOGIC, WALLS, and ACTORS layers.
   * ACTORS layer is included to support conductive pushable entities.
   */
  private getSignalEntitiesAtCell(
    context: GameContext,
    cell: LinkedCell
  ): number[] {
    const ids: number[] = [];
    const layers = [
      GameLayers.FLOOR,
      GameLayers.COLLECTIBLES,
      GameLayers.LOGIC,
      GameLayers.WALLS,
      GameLayers.ACTORS,
    ];

    for (const layer of layers) {
      const id = cell.getValue(layer);
      if (id !== undefined) {
        const data = context.spatial.getEntityData(id);
        if (
          data &&
          (hasSignalEmitter(data) ||
            hasSignalReceiver(data) ||
            hasConductive(data))
        ) {
          ids.push(id);
        }
      }
    }

    return ids;
  }

  public override resetState(): void {
    this.oscillatorTicks.clear();
    this.pressureSwitchStates.clear();
    this.previousGeneratorStates.clear();
    this.pendingEmissions = [];
    this.wiredTransceiverStates.clear();
    this.channelStates.clear();
    this.conductivePositions.clear();
    this.initialized = false;
    this.tickCount = 0;
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      tickCount: this.tickCount,
      oscillatorCount: this.oscillatorTicks.size,
      switchCount: this.pressureSwitchStates.size,
      trackedGenerators: this.previousGeneratorStates.size,
      pendingEmissions: this.pendingEmissions.length,
      activeChannels: this.channelStates.size,
    };
  }
}
