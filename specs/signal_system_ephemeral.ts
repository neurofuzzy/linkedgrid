/**
 * @brief Signal System - Ephemeral Event Architecture (FIXED)
 *
 * Signals are transient events that propagate and disappear.
 * Entity state (receivedSignal) persists, but signals themselves don't.
 *
 * Key principles:
 * 1. A signal is unique by source Entity ID + tick (immutable)
 * 2. A signal can only affect a cell once (via visitedCells)
 * 3. Signals are naturally GC'd when propagation completes
 * 4. Signal values are simply ON/OFF booleans
 * 5. Conductors propagate instantly (within same tick)
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
} from '../traits/trait-guards';

/**
 * SignalEvent - Ephemeral pulse that propagates once then disappears
 * Unique by sourceId + current tick
 */
class SignalEvent {
  readonly id: string;
  readonly visitedCells: Set<string> = new Set();

  constructor(
    public readonly sourceId: number,
    public readonly tick: number,
    public readonly value: boolean
  ) {
    // Unique identifier ensures one signal per source per tick
    this.id = `${sourceId}-${tick}`;
  }
}

export class SignalSystem extends BaseReactiveSystem {
  private oscillatorTicks = new Map<number, number>();
  private pressureSwitchStates = new Map<number, boolean>();
  private channelStates = new Map<string, boolean>();
  private tickCount = 0;

  // Track previous emitter states to detect changes (only for PRIMARY sources)
  private previousEmitterStates = new Map<number, boolean>();

  constructor(private gameManager: GameManager) {
    super();
  }

  update(context: GameContext): void {
    this.tickCount++;

    // Phase 1: Apply pending states from previous tick
    this.phase1_applyPending(context);

    // Phase 2: Update generators (oscillators, pressure switches)
    this.updateOscillators(context);
    this.updatePressureSwitches(context);

    // Phase 3: Detect state changes and create ephemeral events
    const events = this.phase3_detectChanges(context);

    // Phase 4: Propagate events (instant, within same tick)
    for (const event of events) {
      this.phase4_propagateEvent(context, event);
    }
    // Events are now dereferenced and GC'd

    // Phase 5: Handle transceivers (wireless relay)
    this.propagateTransceivers(context);

    // Phase 6: Calculate next states for receivers (1-tick delay)
    this.phase6_calculateNext(context);
  }

  /**
   * Phase 1: Apply pending signals from previous tick
   * This is where the 1-tick delay happens for receivers
   */
  private phase1_applyPending(context: GameContext): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalReceiver(data)) continue;

      if (data.pendingSignal !== undefined) {
        const updates: any = {
          receivedSignal: data.pendingSignal,
          pendingSignal: undefined
        };

        // Inverters flip their output when input changes
        if (data.receiverType === 'inverter') {
          updates.signalState = !data.pendingSignal;
        }

        this.gameManager.gameState.entityStore.setData(entityId, updates);
      }
    }
  }

  /**
   * Phase 3: Detect changes and create ephemeral events
   *
   * CRITICAL: We only create events for PRIMARY SOURCES that changed state.
   * Conductors and receivers don't generate new events - they relay existing ones.
   */
  private phase3_detectChanges(context: GameContext): SignalEvent[] {
    const events: SignalEvent[] = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data) continue;

      // Only check PRIMARY signal emitters
      if (!hasSignalEmitter(data)) continue;

      let currentState: boolean;
      let shouldEmit = false;

      // Primary sources: oscillators and pressure switches
      if (data.signalType === 'oscillator' || data.signalType === 'pressure') {
        currentState = data.signalState;
        const previousState = this.previousEmitterStates.get(entityId);

        // Emit signal if state changed OR it's first time
        if (previousState === undefined || previousState !== currentState) {
          shouldEmit = true;
          this.previousEmitterStates.set(entityId, currentState);
        }
      }
      // Inverters emit based on their output state
      else if (data.signalType === 'inverter') {
        currentState = data.signalState;
        const previousState = this.previousEmitterStates.get(entityId);

        if (previousState === undefined || previousState !== currentState) {
          shouldEmit = true;
          this.previousEmitterStates.set(entityId, currentState);
        }
      }
      // Transceivers are handled separately
      else {
        continue;
      }

      if (shouldEmit) {
        events.push(new SignalEvent(entityId, this.tickCount, currentState!));
      }
    }

    return events;
  }

  /**
   * Phase 4: Propagate ephemeral event through conductive network
   *
   * Event updates entity state along its path, then is garbage collected.
   * Propagation is INSTANT - all conductors update in same tick.
   */
  private phase4_propagateEvent(context: GameContext, event: SignalEvent): void {
    const queue: number[] = [event.sourceId];

    // Mark source position as visited
    const sourcePos = context.spatial.getPosition(event.sourceId);
    if (sourcePos) {
      event.visitedCells.add(`${sourcePos.x}:${sourcePos.y}`);
    }

    while (queue.length > 0) {
      const entityId = queue.shift()!;
      const pos = context.spatial.getPosition(entityId);
      if (!pos) continue;

      // Check 4 neighbors (cardinal directions)
      const neighbors = [
        { x: pos.x - 1, y: pos.y },
        { x: pos.x + 1, y: pos.y },
        { x: pos.x, y: pos.y - 1 },
        { x: pos.x, y: pos.y + 1 }
      ];

      for (const neighbor of neighbors) {
        const key = `${neighbor.x}:${neighbor.y}`;

        // Each cell can only be affected once per signal
        if (event.visitedCells.has(key)) continue;
        if (!context.spatial.grid.isValid(neighbor.x, neighbor.y)) continue;

        const cell = context.spatial.grid.cell(neighbor.x, neighbor.y);
        if (!cell) continue;

        const entities = this.getEntitiesAtCell(context, cell);

        // Check if this cell has any conductive/receiver entities
        const hasConnection = entities.some(id => {
          const data = context.spatial.getEntityData(id);
          if (!data) return false;
          return hasConductive(data) || hasSignalReceiver(data) || hasSignalEmitter(data);
        });

        if (!hasConnection) continue;

        // Mark cell as visited
        event.visitedCells.add(key);

        // Update all entities at this cell
        for (const id of entities) {
          const data = context.spatial.getEntityData(id);
          if (!data) continue;

          // Pure conductors get instant visual update
          if (hasConductive(data) && !hasSignalReceiver(data)) {
            this.gameManager.gameState.entityStore.setData(id, {
              receivedSignal: event.value
            });
          }
          // Conductive receivers (e.g., conductive floor) also get instant visual
          else if (hasConductive(data) && hasSignalReceiver(data)) {
            this.gameManager.gameState.entityStore.setData(id, {
              receivedSignal: event.value
            });
          }
          // Pure receivers (gates, inverters) just mark that they received signal
          // Their reaction happens in phase6 with 1-tick delay
          else if (hasSignalReceiver(data)) {
            this.gameManager.gameState.entityStore.setData(id, {
              receivedSignal: event.value
            });
          }
        }

        // Check if signal can propagate through this cell
        const canPropagate = entities.some(id => {
          const data = context.spatial.getEntityData(id);
          return data && this.isPureConductor(data);
        });

        if (canPropagate) {
          // Find any conductor to continue propagation
          const conductorId = entities.find(id => {
            const data = context.spatial.getEntityData(id);
            return data && this.isPureConductor(data);
          });

          if (conductorId !== undefined) {
            queue.push(conductorId);
          }
        }
      }
    }

    // Event is now complete and will be garbage collected
  }

  /**
   * Phase 6: Calculate next states for receivers
   *
   * Receivers have 1-tick delay: signal arrives this tick, effect happens next tick.
   * Pure conductors already updated in phase4, so we skip them here.
   */
  private phase6_calculateNext(context: GameContext): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data) continue;

      // Only process receivers with delay (gates, inverters, etc.)
      if (hasSignalReceiver(data)) {
        const isPowered = data.receivedSignal === true;

        // Set pending for next tick
        this.gameManager.gameState.entityStore.setData(entityId, {
          pendingSignal: isPowered
        });
      }
    }
  }

  /**
   * Phase 5: Wireless signal relay via transceivers
   */
  private propagateTransceivers(context: GameContext): void {
    const transceivers = this.getTransceivers(context);
    this.channelStates.clear();

    // Determine which channels are active
    for (const tx of transceivers) {
      const data = context.spatial.getEntityData(tx.id);
      if (data && hasSignalReceiver(data) && data.receivedSignal === true) {
        this.channelStates.set(tx.channel, true);
      }
    }

    // Create wireless events for active channels
    const wirelessEvents: SignalEvent[] = [];
    for (const tx of transceivers) {
      if (this.channelStates.get(tx.channel) === true) {
        // Check if this transceiver changed state
        const data = context.spatial.getEntityData(tx.id);
        if (data && hasSignalEmitter(data)) {
          const previousState = this.previousEmitterStates.get(tx.id);
          if (previousState !== true) {
            wirelessEvents.push(new SignalEvent(tx.id, this.tickCount, true));
            this.previousEmitterStates.set(tx.id, true);
          }
        }
      } else {
        // Channel is off
        const data = context.spatial.getEntityData(tx.id);
        if (data && hasSignalEmitter(data)) {
          const previousState = this.previousEmitterStates.get(tx.id);
          if (previousState !== false) {
            this.previousEmitterStates.set(tx.id, false);
          }
        }
      }
    }

    // Propagate wireless events
    for (const event of wirelessEvents) {
      this.phase4_propagateEvent(context, event);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if entity is a pure conductor (allows signal propagation)
   */
  private isPureConductor(data: any): boolean {
    // Receivers that block propagation
    if (hasSignalReceiver(data)) {
      const blockingTypes = ['gate', 'inverter', 'transceiver'];
      if (blockingTypes.includes(data.receiverType)) {
        return false;
      }
    }

    // Pure conductive entities
    if (hasConductive(data)) return true;

    // Emitters on conductive floors
    if (hasSignalEmitter(data)) {
      const conductiveEmitters = ['oscillator', 'pressure'];
      if (conductiveEmitters.includes(data.signalType)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all entities at a cell across relevant layers
   */
  private getEntitiesAtCell(context: GameContext, cell: LinkedCell): number[] {
    const ids: number[] = [];
    const layers = [GameLayers.FLOOR, GameLayers.COLLECTIBLES, GameLayers.WALLS, GameLayers.LOGIC];

    for (const layer of layers) {
      const id = cell.getValue(layer);
      if (id !== undefined) ids.push(id);
    }

    return ids;
  }

  /**
   * Get all transceiver entities
   */
  private getTransceivers(context: GameContext): Array<{ id: number; channel: string }> {
    const transceivers: Array<{ id: number; channel: string }> = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (data && isTransceiver(data)) {
        transceivers.push({ id: entityId, channel: data.channel });
      }
    }

    return transceivers;
  }

  /**
   * Update oscillator state based on elapsed ticks
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

      // Toggle state every half-period
      if (elapsed % halfPeriod === 0) {
        this.gameManager.gameState.entityStore.setData(entityId, {
          signalState: !data.signalState
        });
      }
    }
  }

  /**
   * Update pressure switch state based on actor presence
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

      switch (switchMode) {
        case 'toggle':
          if (isPressed && !wasPressed) {
            this.gameManager.gameState.entityStore.setData(switchId, {
              signalState: !data.signalState
            });
          }
          break;

        case 'hold':
          if (isPressed !== data.signalState) {
            this.gameManager.gameState.entityStore.setData(switchId, {
              signalState: isPressed
            });
          }
          break;

        case 'latch':
          if (isPressed && !wasPressed && !data.signalState) {
            this.gameManager.gameState.entityStore.setData(switchId, {
              signalState: true
            });
          }
          break;

        case 'inverted-latch':
          if (isPressed && !wasPressed && data.signalState) {
            this.gameManager.gameState.entityStore.setData(switchId, {
              signalState: false
            });
          }
          break;
      }

      this.pressureSwitchStates.set(switchId, isPressed);
    }
  }

  // ============================================================================
  // System Lifecycle
  // ============================================================================

  public override resetState(): void {
    this.oscillatorTicks.clear();
    this.pressureSwitchStates.clear();
    this.previousEmitterStates.clear();
    this.channelStates.clear();
    this.tickCount = 0;
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      tickCount: this.tickCount,
      oscillatorCount: this.oscillatorTicks.size,
      switchCount: this.pressureSwitchStates.size,
      trackedEmitters: this.previousEmitterStates.size,
      activeChannels: this.channelStates.size
    };
  }
}
