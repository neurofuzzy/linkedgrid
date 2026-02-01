import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { GameManager } from '../core/game-manager';
import type { LinkedCell } from '../core/grid/linked-cell';
import { GameLayers } from '../config/layers.config';
import {
  hasSignalEmitter,
  hasSignalReceiver,
  hasConductive,
} from '../traits/trait-guards';

/**
 * SignalSystem - Manages signal propagation through conductive networks.
 *
 * Implements a signal broadcasting system where switches generate on/off signals
 * that propagate through conductive paths to receivers (bollards, inverters).
 *
 * @system
 * @reactsTo Signal emitters (oscillators, pressure switches), entity overlaps
 * @modifies Signal states, bollard layers (WALLS ↔ FLOOR)
 *
 * Processing Phases:
 * 1. Update signal sources (oscillators auto-toggle, pressure switches detect steps)
 * 2. Propagate signals through conductive network (flood-fill from active emitters)
 * 3. Apply signals to receivers (bollards open/close, inverters invert)
 *
 * Signal Propagation Rules:
 * - Signals flow through conductive entities (conductive floors, switches, receivers)
 * - Propagation is 4-directional (UP, DOWN, LEFT, RIGHT)
 * - Signals propagate vertically through layers (FLOOR → WALLS/ACTORS)
 * - Propagation is instantaneous (completes within one tick)
 *
 * @example
 * ```typescript
 * const signalSystem = new SignalSystem(gameManager);
 * gameLoop.addSystem(signalSystem);
 * ```
 */
export class SignalSystem extends BaseReactiveSystem {
  // Oscillator tick counts for timing
  private oscillatorTicks = new Map<number, number>();

  // Pressure switch pressed states for edge detection
  private pressureSwitchStates = new Map<number, boolean>();

  constructor(private gameManager: GameManager) {
    super();
  }

  /**
   * Main update loop - called every tick.
   */
  update(context: GameContext): void {
    // Phase 1: Update signal sources
    this.updateOscillators(context);
    this.updatePressureSwitches(context);

    // Phase 2: Propagate signals through conductive network
    this.propagateSignals(context);

    // Phase 3: Apply signals to receivers
    this.applyToReceivers(context);
  }

  /**
   * Phase 1a: Update oscillators - auto-toggle at period intervals.
   */
  private updateOscillators(context: GameContext): void {
    for (const [entityId, _pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalEmitter(data) || data.signalType !== 'oscillator') {
        continue;
      }

      const period = data.oscillatorPeriod ?? 40;
      const halfPeriod = Math.floor(period / 2);

      // Get or initialize tick count for this oscillator
      let elapsed = this.oscillatorTicks.get(entityId) ?? 0;

      // Increment tick counter first
      elapsed++;
      this.oscillatorTicks.set(entityId, elapsed);

      // Toggle every half-period (at 20, 40, 60, etc.)
      if (elapsed % halfPeriod === 0) {
        const newState = !data.signalState;
        this.gameManager.gameState.entityStore.setData(entityId, {
          signalState: newState,
        });
      }
    }
  }

  /**
   * Phase 1b: Update pressure switches - toggle on entity entry.
   */
  private updatePressureSwitches(context: GameContext): void {
    for (const [switchId, pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(switchId);
      if (!data || !hasSignalEmitter(data) || data.signalType !== 'pressure') {
        continue;
      }

      // Check if entity on same cell (ACTORS layer)
      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      const actorId = cell.getValue(GameLayers.ACTORS);

      // Get previous pressed state (default to false if not tracked yet)
      const wasPressed = this.pressureSwitchStates.get(switchId) === true;
      const isPressed = actorId !== undefined;

      // Toggle on entry (edge detection: transition from not-pressed to pressed)
      if (isPressed && !wasPressed) {
        const newState = !data.signalState;
        this.gameManager.gameState.entityStore.setData(switchId, {
          signalState: newState,
        });
      }

      // Update pressed state
      this.pressureSwitchStates.set(switchId, isPressed);
    }
  }

  /**
   * Phase 2: Propagate signals through conductive network.
   *
   * Uses flood-fill from all active emitters to spread signals through
   * conductive paths.
   */
  private propagateSignals(context: GameContext): void {
    // Clear previous signal states on all receivers
    this.clearReceiverSignals(context);

    // Find all active emitters (signalState = true)
    const activeEmitters = this.getActiveEmitters(context);

    // For each active emitter, flood-fill through conductive network
    for (const emitterId of activeEmitters) {
      const emitterPos = context.spatial.getEntityPosition(emitterId);
      if (!emitterPos) continue;

      const emitterData = context.spatial.getEntityData(emitterId);
      if (!emitterData || !hasSignalEmitter(emitterData)) continue;

      const signalState = emitterData.signalState;

      // BFS through conductive cells
      this.floodFillSignal(context, emitterPos.x, emitterPos.y, signalState, emitterId);
    }
  }

  /**
   * Clear receivedSignal state on all receivers before propagation.
   */
  private clearReceiverSignals(context: GameContext): void {
    for (const [entityId, _pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalReceiver(data)) continue;

      this.gameManager.gameState.entityStore.setData(entityId, {
        receivedSignal: false,
      });
    }
  }

  /**
   * Get all active signal emitters (signalState = true).
   */
  private getActiveEmitters(context: GameContext): number[] {
    const emitters: number[] = [];

    for (const [entityId, _pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalEmitter(data)) continue;

      if (data.signalState) {
        emitters.push(entityId);
      }
    }

    return emitters;
  }

  /**
   * Flood-fill signal propagation from a start position.
   *
   * Signals propagate through conductive cells in 4 directions.
   */
  private floodFillSignal(
    context: GameContext,
    startX: number,
    startY: number,
    signal: boolean,
    emitterId: number
  ): void {
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      const key = `${x}:${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const cell = context.spatial.grid.cell(x, y);
      if (!cell) continue;

      // Apply signal to receivers in this cell (vertical propagation)
      // Fix: Don't apply signal to the emitter itself (prevents Inverter loops)
      this.applySignalToCell(context, x, y, signal, emitterId);

      // Check if cell is conductive (can carry signal)
      // Exception: If this is the start node (emitter), it can always broadcast to neighbors
      // event if it blocks pass-through (like Inverters)
      const isStartNode = x === startX && y === startY;
      if (!isStartNode && !this.isCellConductive(context, cell)) continue;

      // Propagate to 4 neighbors
      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ];

      for (const neighbor of neighbors) {
        // Check bounds
        if (
          neighbor.x < 0 ||
          neighbor.x >= context.spatial.grid.width ||
          neighbor.y < 0 ||
          neighbor.y >= context.spatial.grid.height
        ) {
          continue;
        }

        queue.push(neighbor);
      }
    }
  }

  /**
   * Apply signal to all receivers in a cell (vertical propagation).
   */
  private applySignalToCell(
    context: GameContext,
    x: number,
    y: number,
    signal: boolean,
    sourceEntityId: number
  ): void {
    const cell = context.spatial.grid.cell(x, y);
    if (!cell) return;

    // Check multiple layers for receivers
    const layers = [
      GameLayers.FLOOR,
      GameLayers.COLLECTIBLES,
      GameLayers.WALLS,
    ];

    for (const layer of layers) {
      const entityId = cell.getValue(layer);
      if (!entityId || entityId === sourceEntityId) continue; // Don't signal self

      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalReceiver(data)) continue;

      // Set received signal
      this.gameManager.gameState.entityStore.setData(entityId, {
        receivedSignal: signal,
      });
    }
  }

  /**
   * Check if a cell is conductive (can carry signals).
   *
   * A cell is conductive if it contains:
   * - A conductive entity (conductive floors)
   * - A signal emitter (switches)
   * - A signal receiver (bollards, inverters)
   */
  private isCellConductive(context: GameContext, cell: LinkedCell): boolean {
    // Check multiple layers for conductive entities
    const layers = [
      GameLayers.FLOOR,
      GameLayers.COLLECTIBLES,
      GameLayers.WALLS,
    ];

    for (const layer of layers) {
      const entityId = cell.getValue(layer);
      if (!entityId) continue;

      const data = context.spatial.getEntityData(entityId);
      if (!data) continue;

      // Fix: Inverters should NOT conduct signals (they block and re-emit inverted)
      // Must check this first because Inverters are also Emitters!
      if (hasSignalReceiver(data) && data.receiverType === 'inverter') {
        return false;
      }

      // Conductive if has any signal trait or is explicitly conductive
      if (hasConductive(data)) return true;
      if (hasSignalEmitter(data)) return true;
      if (hasSignalReceiver(data)) return true;
    }

    return false;
  }

  /**
   * Phase 3: Apply signals to receivers.
   *
   * - Bollards: Open (FLOOR) when signal ON, close (WALLS) when signal OFF
   * - Inverters: Set signalState to opposite of receivedSignal
   */
  private applyToReceivers(context: GameContext): void {
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalReceiver(data)) continue;

      if (data.receiverType === 'bollard') {
        this.applyToBollard(context, entityId, pos, data);
      } else if (data.receiverType === 'inverter' && hasSignalEmitter(data)) {
        this.applyToInverter(entityId, data);
      }
    }
  }

  /**
   * Apply signal to bollard: open when ON, close when OFF.
   */
  private applyToBollard(
    context: GameContext,
    entityId: number,
    pos: { x: number; y: number; layer: number },
    data: any
  ): void {
    const shouldBeOpen = data.receivedSignal; // ON signal = open
    const isOpen = pos.layer !== GameLayers.WALLS;

    if (shouldBeOpen && !isOpen) {
      // Open: move to FLOOR layer (spawn new entity)
      context.spatial.remove(entityId);
      context.spatial.spawn(
        'bollard-open',
        pos.x,
        pos.y,
        GameLayers.FLOOR,
        {
          receiverType: 'bollard',
          receivedSignal: true,
          color: data.color || '#ff0000',
          sceneId: data.sceneId,
        }
      );
    } else if (!shouldBeOpen && isOpen) {
      // Close: move to WALLS layer (spawn new entity)
      context.spatial.remove(entityId);
      context.spatial.spawn(
        'bollard-closed',
        pos.x,
        pos.y,
        GameLayers.WALLS,
        {
          receiverType: 'bollard',
          receivedSignal: false,
          color: data.color || '#ff0000',
          sceneId: data.sceneId,
        }
      );
    }
  }

  /**
   * Apply signal to inverter: output opposite of input.
   */
  private applyToInverter(entityId: number, data: any): void {
    const invertedState = !data.receivedSignal;
    this.gameManager.gameState.entityStore.setData(entityId, {
      signalState: invertedState,
    });
  }

  /**
   * Reset system state (for testing/scene transitions).
   */
  public override resetState(): void {
    this.oscillatorTicks.clear();
    this.pressureSwitchStates.clear();
  }

  /**
   * Get debug state for troubleshooting.
   */
  public override getDebugState() {
    return {
      systemType: 'SignalSystem',
      oscillatorCount: this.oscillatorTicks.size,
      pressureSwitchCount: this.pressureSwitchStates.size,
      oscillators: Array.from(this.oscillatorTicks.entries()).map(
        ([id, tick]) => ({
          entityId: id,
          tickCount: tick,
        })
      ),
      pressureSwitches: Array.from(this.pressureSwitchStates.entries()).map(
        ([id, pressed]) => ({
          entityId: id,
          isPressed: pressed,
        })
      ),
    };
  }
}
