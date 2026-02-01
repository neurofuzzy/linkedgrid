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

  // Input latching: Track which direction signal came from for each receiver
  // Key: receiverEntityId, Value: 'up' | 'down' | 'left' | 'right'
  // When an Inverter emits, it will NOT emit back towards this direction.
  private inputLatches = new Map<number, string>();

  // Transient set of powered entities for the current tick
  // Used to ensure instantaneous propagation without flicker
  private currentTickSignals = new Set<number>();

  constructor(private gameManager: GameManager) {
    super();
  }

  /**
   * Main update loop - called every tick.
   */
  update(context: GameContext): void {
    this.currentTickSignals.clear();

    // Phase 1: Update signal sources (Oscillators, Pressure Switches)
    this.updateOscillators(context);
    this.updatePressureSwitches(context);

    // Phase 2: Instantaneous Signal Propagation
    // This resolves the entire circuit state for the current tick.
    this.resolveCircuit(context);

    // Phase 3: Apply final states to receivers
    // Updates visual state and physical objects (bollards)
    this.applyToReceivers(context);
  }

  /**
   * Resolve the signal network in two passes to handle NOT gates instantaneously.
   */
  private resolveCircuit(context: GameContext): void {
    // PASS 1: Propagate from Primary Sources (Oscillators, Switches)
    // This determines the base "Powered" state of the network.
    const primarySources = this.getActivePrimarySources(context);
    this.floodFill(context, primarySources, true);

    // PASS 2: Update Inverter States & Propagate from Secondary Sources
    // Inverters check if they received signal in Pass 1.
    // If NOT (input is OFF), they become active sources for Pass 2.
    const activeInverters: number[] = [];

    // Check all Inverters
    for (const [entityId, _pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(entityId);
      if (!data || !hasSignalReceiver(data) || data.receiverType !== 'inverter') {
        continue;
      }

      // Inverter Logic:
      // If it received a signal in Pass 1, it turns OFF.
      // If it received NO signal, it turns ON and becomes a source.
      const receivedSignal = this.currentTickSignals.has(entityId);

      // Update persistent state for next frame/visuals
      this.gameManager.gameState.entityStore.setData(entityId, {
        signalState: !receivedSignal
      });

      if (!receivedSignal) {
        activeInverters.push(entityId);
      }
    }

    // Propagate from active Inverters
    // CRITICAL: Prevent back-feed using Input Latching logic
    this.floodFill(context, activeInverters, false);
  }

  /**
   * Flood Fill Algorithm
   * @param updateLatches - If true, updates input latches (Pass 1). If false, respects latches (Pass 2).
   */
  private floodFill(context: GameContext, starts: number[], updateLatches: boolean): void {
    const queue: Array<{ x: number; y: number; fromDir?: string }> = [];
    const visited = new Set<string>();
    const startCoords = new Set<string>();

    for (const id of starts) {
      const pos = context.spatial.getEntityPosition(id);
      if (pos) {
        queue.push({ x: pos.x, y: pos.y });
        this.currentTickSignals.add(id);
        startCoords.add(`${pos.x}:${pos.y}`);
      }
    }

    while (queue.length > 0) {
      const { x, y, fromDir } = queue.shift()!;
      const key = `${x}:${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const cell = context.spatial.grid.cell(x, y);
      if (!cell) continue;

      // Mark conductive entities at this location as powered
      this.markCellAsPowered(context, cell, fromDir, updateLatches);

      // Check Conductivity
      // Primary sources propagate through everything (except blocking walls, etc)
      // Inverters (Secondary) also propagate, BUT they stop at other Inverters inputs (logic-wise).
      // However, visually, the wire leading to an inverter should light up.
      // The `isCellConductive` check handles what entities *bridge* the connection.
      // Exclude start nodes from blocking (they are the sources!)
      if (!startCoords.has(key) && !this.isCellConductive(context, cell)) continue;

      // Determine valid directions
      // If updateLatches=false (Inverter Source), don't propagate back towards our own Latch.
      // E.g. If Inverter at (X,Y) has Latch 'LEFT', it means its input is from LEFT.
      // So it should NOT emit LEFT.
      let blockedDir: string | undefined;

      if (!updateLatches) { // Pass 2
        // Check if the CURRENT cell contains an entity that has a latch
        // If so, we are emitting *from* this entity.
        const ids = this.getIdsInCell(cell);
        for (const id of ids) {
          const latch = this.inputLatches.get(id);
          if (latch) {
            blockedDir = latch;
            break;
          }
        }
      }

      const neighbors = [
        { x: x - 1, y, dir: 'left' },   // Neighbor is Left of Current
        { x: x + 1, y, dir: 'right' },  // Neighbor is Right of Current
        { x, y: y - 1, dir: 'up' },     // Neighbor is Up of Current
        { x, y: y + 1, dir: 'down' }    // Neighbor is Down of Current
      ];

      for (const n of neighbors) {
        // If this direction is blocked by latch, skip
        if (blockedDir && blockedDir === n.dir) {
          continue;
        }

        // Check bounds
        if (n.x < 0 || n.x >= context.spatial.grid.width || n.y < 0 || n.y >= context.spatial.grid.height) continue;

        // 'fromDir' for the neighbor is the OPPOSITE of 'n.dir'?
        // No, 'fromDir' is where the signal entered the neighbor FROM.
        // If neighbor is to the LEFT (x-1), signal came FROM RIGHT.
        let nextFromDir = '';
        if (n.dir === 'left') nextFromDir = 'right';
        if (n.dir === 'right') nextFromDir = 'left';
        if (n.dir === 'up') nextFromDir = 'down';
        if (n.dir === 'down') nextFromDir = 'up';

        queue.push({ x: n.x, y: n.y, fromDir: nextFromDir });
      }
    }
  }

  private markCellAsPowered(
    context: GameContext,
    cell: LinkedCell,
    fromDir: string | undefined,
    updateLatches: boolean
  ): void {
    const layers = [GameLayers.FLOOR, GameLayers.COLLECTIBLES, GameLayers.WALLS];

    for (const layer of layers) {
      const id = cell.getValue(layer);
      if (!id) continue;

      const data = context.spatial.getEntityData(id);
      if (!data) continue;

      // Mark as powered for this tick (if receiver or conductive)
      if (hasSignalReceiver(data) || hasConductive(data)) {
        this.currentTickSignals.add(id);

        // Update Input Latch if applicable
        // Only Receivers latch input.
        // Only update in Pass 1 (Primary Source).
        if (updateLatches && hasSignalReceiver(data) && fromDir) {
          this.inputLatches.set(id, fromDir);
        }
      }
    }
  }

  private getActivePrimarySources(context: GameContext): number[] {
    const sources: number[] = [];
    for (const [id, _pos] of context.spatial.getAllPositions()) {
      const data = context.spatial.getEntityData(id);
      if (data && hasSignalEmitter(data)) {
        // Inverters are sources, but handled in Pass 2.
        // We only want Primary sources here.
        if (data.signalType === 'inverter') continue;

        if (data.signalState) {
          sources.push(id);
        }
      }
    }
    return sources;
  }

  private getIdsInCell(cell: LinkedCell): number[] {
    const ids: number[] = [];
    for (const val of cell.values) {
      if (val !== undefined) ids.push(val);
    }
    return ids;
  }

  // ... (Keep updateOscillators, updatePressureSwitches as is) 

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

  // ... (Previous propagateSignals, clearReceiverSignals, getActiveEmitters, floodFillSignal, applySignalToCell REMOVED/REPLACED by resolveCircuit)

  private isCellConductive(context: GameContext, cell: LinkedCell): boolean {
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

      // Inverters block pass-through conduction (they are logic gates, not wires)
      // Visually nodes connect to them, but signals don't pass THROUGH them.
      if (hasSignalReceiver(data) && data.receiverType === 'inverter') {
        return false;
      }

      if (hasConductive(data)) {
        return true;
      }
      if (hasSignalEmitter(data)) {
        return true;
      }
      if (hasSignalReceiver(data)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Phase 3: Apply signals to receivers.
   */
  private applyToReceivers(context: GameContext): void {
    // Apply visual/logical state from currentTickSignals
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const hasSignal = this.currentTickSignals.has(entityId);

      // Update 'receivedSignal' property on entity for Renderer
      // This ensures visuals match the resolved state
      const data = context.spatial.getEntityData(entityId);
      if (data && (hasSignalReceiver(data) || hasConductive(data))) {
        // Skip writing if not changed? 
        // For simple sync, just write it.
        // Avoid overwriting Inverter 'signalState' which was set in resolveCircuit
        if (data.receiverType !== 'inverter' || !('signalState' in data)) {
          // Only update strictly receiver props
        }

        // Actually, we must update receivedSignal for EVERYONE who cares
        this.gameManager.gameState.entityStore.setData(entityId, {
          receivedSignal: hasSignal
        });
      }

      if (data && hasSignalReceiver(data)) {
        if (data.receiverType === 'bollard') {
          this.applyToBollard(context, entityId, pos, { ...data, receivedSignal: hasSignal });
        }
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
   * (Now handled inside resolveCircuit)
   */
  private applyToInverter(entityId: number, data: any): void {
    // Deprecated/Folded into resolveCircuit
  }

  /**
   * Reset system state (for testing/scene transitions).
   */
  public override resetState(): void {
    this.oscillatorTicks.clear();
    this.pressureSwitchStates.clear();
    this.inputLatches.clear();
    this.currentTickSignals.clear();
  }

  /**
   * Get debug state for troubleshooting.
   */
  public override getDebugState() {
    return {
      systemType: 'SignalSystem',
      oscillatorCount: this.oscillatorTicks.size,
      pressureSwitchCount: this.pressureSwitchStates.size,
      activeSignals: this.currentTickSignals.size,
      inputLatches: Array.from(this.inputLatches.entries()).map(([id, dir]) => ({
        id, dir
      }))
    };
  }
}
