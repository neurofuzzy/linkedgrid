/**
 * @brief Signal System - Event Bubbling Architecture
 *
 * CORE CONCEPT: Signals are EVENTS, not STATE.
 * - Events bubble instantly from generators through conductors
 * - State (receivedSignal) is what entities have after events pass through
 * - Only GENERATORS create events when their state changes
 * - Conductors/receivers just update their state when events bubble through
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
 * SignalEvent - Ephemeral event that bubbles once then disappears
 */
class SignalEvent {
  readonly id: string;
  readonly visitedCells: Set<string> = new Set();

  constructor(
    public readonly sourceId: number,
    public readonly tick: number,
    public readonly value: boolean
  ) {
    this.id = `${sourceId}-${tick}`;
  }
}

export class SignalSystem extends BaseReactiveSystem {
  private oscillatorTicks = new Map<number, number>();
  private pressureSwitchStates = new Map<number, boolean>();
  private channelStates = new Map<string, boolean>();
  private tickCount = 0;

  // Track generator states to detect changes
  private previousGeneratorStates = new Map<number, boolean>();

  constructor(private gameManager: GameManager) {
    super();
  }

  update(context: GameContext): void {
    this.tickCount++;

    // Phase 1: Apply pending states (1-tick delay for active components)
    this.applyPending(context);

    // Phase 2: Update generators
    this.updateOscillators(context);
    this.updatePressureSwitches(context);

    // Phase 3: Create events from generators that changed
    const events = this.createEvents(context);

    // Phase 4: Bubble events through network
    for (const event of events) {
      this.bubbleEvent(context, event);
    }

    // Phase 5: Transceivers
    this.propagateTransceivers(context);
  }

  /**
   * Create signal events ONLY from generators when they change state
   */
  private createEvents(context: GameContext): SignalEvent[] {
    const events: SignalEvent[] = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalEmitter(data)) continue;

      let currentState: boolean | undefined;

      if (data.signalType === 'oscillator' || data.signalType === 'pressure') {
        currentState = data.signalState;
      } else if (data.signalType === 'inverter') {
        currentState = data.signalState;
      } else if (data.signalType === 'transceiver') {
        continue; // Handled separately
      }

      if (currentState !== undefined) {
        const previousState = this.previousGeneratorStates.get(entityId);

        if (previousState !== currentState) {
          events.push(new SignalEvent(entityId, this.tickCount, currentState));
          this.previousGeneratorStates.set(entityId, currentState);
        }
      }
    }

    return events;
  }

  /**
   * Bubble event through conductive network
   * - Pure conductors update instantly (receivedSignal)
   * - Receivers with delay set pending (applied next tick)
   */
  private bubbleEvent(context: GameContext, event: SignalEvent): void {
    const queue: number[] = [event.sourceId];

    const sourcePos = context.spatial.getPosition(event.sourceId);
    if (sourcePos) {
      event.visitedCells.add(`${sourcePos.x}:${sourcePos.y}`);
    }

    while (queue.length > 0) {
      const entityId = queue.shift()!;
      const pos = context.spatial.getPosition(entityId);
      if (!pos) continue;

      // Update this entity's state as event passes through
      const data = context.spatial.getEntityData(entityId);
      if (data) {
        // Pure conductors: instant update (no delay)
        if (hasConductive(data) && !hasSignalReceiver(data)) {
          this.gameManager.gameState.entityStore.setData(entityId, {
            receivedSignal: event.value
          });
        }
        // Receivers: 1-tick delay (set pending, will apply next tick)
        else if (hasSignalReceiver(data)) {
          this.gameManager.gameState.entityStore.setData(entityId, {
            pendingSignal: event.value
          });
        }
      }

      // Check neighbors
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

        const hasConnection = entities.some(id => {
          const d = context.spatial.getEntityData(id);
          return d && (hasConductive(d) || hasSignalReceiver(d) || hasSignalEmitter(d));
        });

        if (!hasConnection) continue;

        event.visitedCells.add(key);

        // Update all entities at this cell
        for (const id of entities) {
          const d = context.spatial.getEntityData(id);
          if (!d) continue;

          // Pure conductors: instant update
          if (hasConductive(d) && !hasSignalReceiver(d)) {
            this.gameManager.gameState.entityStore.setData(id, {
              receivedSignal: event.value
            });
          }
          // Receivers: set pending (1-tick delay)
          else if (hasSignalReceiver(d)) {
            this.gameManager.gameState.entityStore.setData(id, {
              pendingSignal: event.value
            });
          }
        }

        // Continue bubbling through pure conductors
        const canPropagate = entities.some(id => {
          const d = context.spatial.getEntityData(id);
          return d && this.isPureConductor(d);
        });

        if (canPropagate) {
          const conductorId = entities.find(id => {
            const d = context.spatial.getEntityData(id);
            return d && this.isPureConductor(d);
          });

          if (conductorId !== undefined) {
            queue.push(conductorId);
          }
        }
      }
    }
  }

  private applyPending(context: GameContext): void {
    const newEvents: SignalEvent[] = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalReceiver(data)) continue;

      if (data.pendingSignal !== undefined) {
        const previousState = data.receivedSignal;

        const updates: any = {
          receivedSignal: data.pendingSignal,
          pendingSignal: undefined
        };

        if (data.receiverType === 'inverter') {
          updates.signalState = !data.pendingSignal;
        }

        this.gameManager.gameState.entityStore.setData(entityId, updates);

        // If state changed, this entity becomes a new event source
        if (previousState !== data.pendingSignal) {
          newEvents.push(new SignalEvent(entityId, this.tickCount, data.pendingSignal));
        }
      }
    }

    // Propagate events created from receivers
    for (const event of newEvents) {
      this.bubbleEvent(context, event);
    }
  }

  private propagateTransceivers(context: GameContext): void {
    const transceivers = this.getTransceivers(context);
    this.channelStates.clear();

    for (const tx of transceivers) {
      const data = context.spatial.getEntityData(tx.id);
      if (data && hasSignalReceiver(data) && data.receivedSignal === true) {
        this.channelStates.set(tx.channel, true);
      }
    }

    const wirelessEvents: SignalEvent[] = [];
    for (const tx of transceivers) {
      if (this.channelStates.get(tx.channel) === true) {
        const data = context.spatial.getEntityData(tx.id);
        if (data && hasSignalEmitter(data)) {
          const previousState = this.previousGeneratorStates.get(tx.id);
          if (previousState !== true) {
            wirelessEvents.push(new SignalEvent(tx.id, this.tickCount, true));
            this.previousGeneratorStates.set(tx.id, true);
          }
        }
      } else {
        const data = context.spatial.getEntityData(tx.id);
        if (data && hasSignalEmitter(data)) {
          const previousState = this.previousGeneratorStates.get(tx.id);
          if (previousState !== false) {
            this.previousGeneratorStates.set(tx.id, false);
          }
        }
      }
    }

    for (const event of wirelessEvents) {
      this.bubbleEvent(context, event);
    }
  }

  private isPureConductor(data: any): boolean {
    // Pure conductive entities always propagate
    if (hasConductive(data) && !hasSignalReceiver(data)) {
      return true;
    }

    // Conductive receivers (conductive-floor with receiver trait) always propagate
    if (hasConductive(data) && hasSignalReceiver(data)) {
      return true;
    }

    // Emitters (oscillators, pressure switches) on conductive floors
    if (hasSignalEmitter(data)) {
      const conductiveEmitters = ['oscillator', 'pressure'];
      return conductiveEmitters.includes(data.signalType);
    }

    // Gates, inverters, transceivers BLOCK (1-tick delay)
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
    this.previousGeneratorStates.clear();
    this.channelStates.clear();
    this.tickCount = 0;
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      tickCount: this.tickCount,
      oscillatorCount: this.oscillatorTicks.size,
      switchCount: this.pressureSwitchStates.size,
      trackedGenerators: this.previousGeneratorStates.size,
      activeChannels: this.channelStates.size
    };
  }
}
