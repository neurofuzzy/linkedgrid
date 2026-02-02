/**
 * @brief Signal System - Ephemeral Event Architecture
 *
 * Signals are transient events that propagate and disappear.
 * Entity state (receivedSignal) persists, but signals themselves don't.
 *
 * Key principle: A signal is like a pulse of electricity - it happens once,
 * changes state along its path, then disappears. State lives in entities,
 * not in signal objects.
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
 */
class SignalEvent {
  constructor(
    public readonly sourceId: number,
    public readonly value: boolean,
    public readonly visitedCells: Set<string> = new Set()
  ) {}
}

export class SignalSystem extends BaseReactiveSystem {
  private oscillatorTicks = new Map<number, number>();
  private pressureSwitchStates = new Map<number, boolean>();

  // Track previous source states to detect changes
  private previousSourceStates = new Map<number, boolean>();

  private channelStates = new Map<string, boolean>();

  constructor(private gameManager: GameManager) {
    super();
  }

  update(context: GameContext): void {
    // Phase 1: Apply pending states
    this.phase1_applyPending(context);
    this.updateOscillators(context);
    this.updatePressureSwitches(context);

    // Phase 2: Detect state changes and create ephemeral events
    const events = this.phase2_detectChanges(context);

    // Phase 3: Propagate events (they update entity state, then disappear)
    for (const event of events) {
      this.phase3_propagateEvent(context, event);
    }
    // Events are now dereferenced and GC'd

    // Phase 3b: Handle transceivers
    this.propagateTransceivers(context);

    // Phase 4: Calculate next states
    this.phase4_calculateNext(context);
  }

  private phase1_applyPending(context: GameContext): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalReceiver(data)) continue;

      if (data.pendingSignal !== undefined) {
        const updates: any = {
          receivedSignal: data.pendingSignal,
          pendingSignal: undefined
        };

        if (data.receiverType === 'inverter') {
          updates.signalState = !data.pendingSignal;
        }

        this.gameManager.gameState.entityStore.setData(entityId, updates);
      }
    }
  }

  /**
   * Phase 2: Detect changes and create ephemeral events
   * Only create events when source state CHANGES
   */
  private phase2_detectChanges(context: GameContext): SignalEvent[] {
    const events: SignalEvent[] = [];

    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data) continue;

      let currentState: boolean | null = null;

      // Check generators
      if (hasSignalEmitter(data)) {
        if (data.signalType === 'oscillator' || data.signalType === 'pressure') {
          currentState = data.signalState;
        } else if (data.signalType === 'inverter') {
          currentState = data.signalState;
        }
      }

      // Check gates (act as sources when open)
      if (hasSignalReceiver(data) && data.receiverType === 'gate') {
        if (data.receivedSignal === true && pos.layer === GameLayers.FLOOR) {
          currentState = true;
        } else {
          currentState = false;
        }
      }

      // Detect state change
      if (currentState !== null) {
        const previousState = this.previousSourceStates.get(entityId);

        if (previousState !== currentState) {
          // State changed - create ephemeral event
          events.push(new SignalEvent(entityId, currentState));
          this.previousSourceStates.set(entityId, currentState);
        }
      }
    }

    return events;
  }

  /**
   * Phase 3: Propagate ephemeral event
   * Event updates entity state along its path, then disappears
   */
  private phase3_propagateEvent(context: GameContext, event: SignalEvent): void {
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

      // Update entity's received signal state
      const data = context.spatial.getEntityData(entityId);
      if (data && (hasConductive(data) || hasSignalReceiver(data))) {
        // Entity receives this signal value
        if (hasConductive(data) && !hasSignalReceiver(data)) {
          // Pure conductor: Update visual immediately
          this.gameManager.gameState.entityStore.setData(entityId, {
            receivedSignal: event.value
          });
        }
      }

      // Check 4 neighbors
      const neighbors = [
        { x: pos.x - 1, y: pos.y },
        { x: pos.x + 1, y: pos.y },
        { x: pos.x, y: pos.y - 1 },
        { x: pos.x, y: pos.y + 1 }
      ];

      for (const neighbor of neighbors) {
        const key = `${neighbor.x}:${neighbor.y}`;
        if (event.visitedCells.has(key)) continue;
        if (!context.spatial.grid.isValid(neighbor.x, neighbor.y)) continue;

        const cell = context.spatial.grid.cell(neighbor.x, neighbor.y);
        if (!cell) continue;

        const entities = this.getEntitiesAtCell(context, cell);

        // Check if conductive
        const conductiveEntities = entities.filter(id => {
          const data = context.spatial.getEntityData(id);
          if (!data) return false;
          return hasConductive(data) || hasSignalReceiver(data) || hasSignalEmitter(data);
        });

        if (conductiveEntities.length === 0) continue;

        event.visitedCells.add(key);

        // Update all conductive entities at this cell
        for (const id of conductiveEntities) {
          const data = context.spatial.getEntityData(id);
          if (!data) continue;

          // Update visual/state
          if (hasConductive(data) && !hasSignalReceiver(data)) {
            this.gameManager.gameState.entityStore.setData(id, {
              receivedSignal: event.value
            });
          }
        }

        // Can we propagate through?
        const canPropagate = entities.some(id => {
          const data = context.spatial.getEntityData(id);
          return data && this.isPureConductor(data);
        });

        if (canPropagate) {
          const propagatorId = entities.find(id => {
            const data = context.spatial.getEntityData(id);
            return data && this.isPureConductor(data);
          });
          if (propagatorId) queue.push(propagatorId);
        }
      }
    }

    // Event is now complete and will be garbage collected
  }

  /**
   * Phase 4: Calculate next states for receivers
   * Use current receivedSignal state (which was updated by events)
   */
  private phase4_calculateNext(context: GameContext): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data) continue;

      // Only process receivers (not pure conductors)
      if (hasSignalReceiver(data)) {
        const isPowered = data.receivedSignal === true;

        // Conductive receivers: Visual already updated
        if (hasConductive(data)) {
          // Already updated in phase 3
        }

        // Set pending for next tick (1-tick delay)
        this.gameManager.gameState.entityStore.setData(entityId, {
          pendingSignal: isPowered
        });
      }
    }
  }

  private propagateTransceivers(context: GameContext): void {
    const transceivers = this.getTransceivers(context);
    this.channelStates.clear();

    // Check which channels are active
    for (const tx of transceivers) {
      const data = context.spatial.getEntityData(tx.id);
      if (data && hasSignalReceiver(data) && data.receivedSignal === true) {
        this.channelStates.set(tx.channel, true);
      }
    }

    // Create events for transceivers on active channels
    const wirelessEvents: SignalEvent[] = [];
    for (const tx of transceivers) {
      if (this.channelStates.get(tx.channel) === true) {
        wirelessEvents.push(new SignalEvent(tx.id, true));
      }
    }

    // Propagate wireless events
    for (const event of wirelessEvents) {
      this.phase3_propagateEvent(context, event);
    }
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private isPureConductor(data: any): boolean {
    if (hasSignalReceiver(data)) {
      const receiverTypes = ['gate', 'inverter', 'transceiver'];
      if (receiverTypes.includes(data.receiverType)) {
        return false;
      }
    }

    if (hasConductive(data)) return true;

    if (hasSignalEmitter(data)) {
      const emitterTypes = ['oscillator', 'pressure'];
      if (emitterTypes.includes(data.signalType)) {
        return true;
      }
    }

    return false;
  }

  private getEntitiesAtCell(context: GameContext, cell: LinkedCell): number[] {
    const ids: number[] = [];
    const layers = [GameLayers.FLOOR, GameLayers.COLLECTIBLES, GameLayers.WALLS, GameLayers.LOGIC];

    for (const layer of layers) {
      const id = cell.getValue(layer);
      if (id !== undefined) ids.push(id);
    }

    return ids;
  }

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
          signalState: !data.signalState
        });
      }
    }
  }

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

  public override resetState(): void {
    this.oscillatorTicks.clear();
    this.pressureSwitchStates.clear();
    this.previousSourceStates.clear();
    this.channelStates.clear();
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      oscillatorCount: this.oscillatorTicks.size,
      switchCount: this.pressureSwitchStates.size,
      trackedSources: this.previousSourceStates.size,
      activeChannels: this.channelStates.size
    };
  }
}
