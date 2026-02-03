import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { WireComponent } from '@basegrid/gameplay';
import { LogicGateComponent } from '@basegrid/gameplay';
import { SwitchComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';

/**
 * Logic Circuit System - Manages digital signal propagation and logic gates
 * 
 * Handles logic circuit mechanics:
 * 1. **Switches**: Generate digital signals (on/off)
 * 2. **Wires**: Propagate signals to adjacent wires
 * 3. **Logic gates**: Evaluate inputs and output results
 * 4. **Cascading**: Gates can feed other gates (multi-level circuits)
 * 
 * Signal propagation:
 * - Switches emit signals when on
 * - Signals propagate through connected wires (BFS)
 * - Gates read inputs from specific directions
 * - Gates output to specific direction
 * - Multiple evaluation passes handle cascading
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const logicSystem = new LogicCircuitSystem();
 * world.addSystem(logicSystem);
 * 
 * // Create switch
 * const switch1 = world.createEntity();
 * world.addComponent(switch1, SwitchComponent, { on: true });
 * world.addComponent(switch1, GridPositionComponent, { x: 3, y: 2, grid });
 * 
 * // Create wire
 * const wire = world.createEntity();
 * world.addComponent(wire, WireComponent, { signal: false });
 * world.addComponent(wire, GridPositionComponent, { x: 4, y: 2, grid });
 * 
 * // Create AND gate
 * const gate = world.createEntity();
 * world.addComponent(gate, LogicGateComponent, {
 *   type: 'AND',
 *   inputDirections: [Direction.UP, Direction.DN],
 *   outputDirection: Direction.RT,
 *   output: false
 * });
 * world.addComponent(gate, GridPositionComponent, { x: 7, y: 4, grid });
 * 
 * // System propagates signals and evaluates gates
 * world.update(16.67);
 * ```
 */
export class LogicCircuitSystem extends System {
  /**
   * Update logic circuit system
   */
  update(_dt: number): void {
    // 1. Clear all wire signals
    this.clearWireSignals();
    
    // 2. Propagate signals from switches
    this.propagateFromSwitches();
    
    // 3. Evaluate gates (multiple passes for cascading)
    this.evaluateGatesCascading();
  }
  
  /**
   * Clear all wire signals
   */
  private clearWireSignals(): void {
    for (const [_, wire] of this.world.query(WireComponent)) {
      wire.signal = false;
      wire.strength = 0;
    }
  }
  
  /**
   * Propagate signals from active switches
   */
  private propagateFromSwitches(): void {
    for (const [entity, switchComp] of this.world.query(SwitchComponent)) {
      if (!switchComp.on) continue;
      
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) continue;
      
      // Propagate signal from switch
      this.propagateSignal(pos, true, pos.grid);
    }
  }
  
  /**
   * Propagate signal through wire network using BFS
   */
  private propagateSignal(startPos: any, signal: boolean, grid: any): void {
    const queue: any[] = [startPos];
    const visited = new Set<string>();
    
    const key = (x: number, y: number) => `${x},${y}`;
    visited.add(key(startPos.x, startPos.y));
    
    while (queue.length > 0) {
      const pos = queue.shift()!;
      const cell = grid.cell(pos.x, pos.y);
      if (!cell) continue;
      
      // Find wire at this position and set signal
      for (const [wireEntity, wire] of this.world.query(WireComponent)) {
        const wirePos = this.world.getComponent(wireEntity, GridPositionComponent);
        if (!wirePos || wirePos.grid !== grid) continue;
        if (wirePos.x !== pos.x || wirePos.y !== pos.y) continue;
        
        wire.signal = signal;
        wire.strength = 1.0;
        break;
      }
      
      // Propagate to adjacent wires
      const neighbors = cell.neighbors().filter(n => n !== null);
      
      for (const neighbor of neighbors) {
        if (!neighbor) continue;
        
        const nKey = key(neighbor.x, neighbor.y);
        if (visited.has(nKey)) continue;
        visited.add(nKey);
        
        // Check if neighbor has wire
        let hasWire = false;
        for (const [_, wirePos] of this.world.query(GridPositionComponent, WireComponent)) {
          if (wirePos.grid !== grid) continue;
          if (wirePos.x === neighbor.x && wirePos.y === neighbor.y) {
            hasWire = true;
            break;
          }
        }
        
        if (hasWire) {
          queue.push({ x: neighbor.x, y: neighbor.y });
        }
      }
    }
  }
  
  /**
   * Evaluate gates with cascading (multiple passes)
   */
  private evaluateGatesCascading(): void {
    const maxPasses = 10; // Prevent infinite loops
    
    for (let pass = 0; pass < maxPasses; pass++) {
      const changed = this.evaluateGates();
      if (!changed) break; // No changes, circuit settled
    }
  }
  
  /**
   * Evaluate all logic gates
   * Returns true if any gate output changed
   */
  private evaluateGates(): boolean {
    let anyChanged = false;
    
    for (const [entity, gate] of this.world.query(LogicGateComponent)) {
      const gatePos = this.world.getComponent(entity, GridPositionComponent);
      if (!gatePos) continue;
      
      // Read input signals
      const inputs = this.readInputSignals(gatePos, gate.inputDirections);
      
      // Evaluate logic
      const output = this.evaluateLogic(gate.type, inputs);
      
      // Check if output changed
      if (output !== gate.output) {
        gate.output = output;
        anyChanged = true;
        
        // Callback
        if (gate.onOutputChange) {
          gate.onOutputChange(entity, output);
        }
        
        // Propagate output signal
        this.propagateGateOutput(gatePos, gate.outputDirection, output);
      }
    }
    
    return anyChanged;
  }
  
  /**
   * Read input signals from specified directions
   */
  private readInputSignals(gatePos: any, directions: Direction[]): boolean[] {
    const inputs: boolean[] = [];
    
    const cell = gatePos.grid.cell(gatePos.x, gatePos.y);
    if (!cell) return inputs;
    
    for (const dir of directions) {
      const neighbor = cell.neighbor(dir);
      if (!neighbor) {
        inputs.push(false);
        continue;
      }
      
      let signal = false;
      
      // Check if neighbor has wire with signal
      for (const [_, wire] of this.world.query(WireComponent)) {
        const wirePos = this.world.getComponent(_, GridPositionComponent);
        if (!wirePos || wirePos.grid !== gatePos.grid) continue;
        if (wirePos.x === neighbor.x && wirePos.y === neighbor.y) {
          signal = wire.signal;
          break;
        }
      }
      
      // Also check if neighbor has an active switch (direct connection)
      if (!signal) {
        for (const [_, switchComp] of this.world.query(SwitchComponent)) {
          const switchPos = this.world.getComponent(_, GridPositionComponent);
          if (!switchPos || switchPos.grid !== gatePos.grid) continue;
          if (switchPos.x === neighbor.x && switchPos.y === neighbor.y) {
            signal = switchComp.on;
            break;
          }
        }
      }
      
      inputs.push(signal);
    }
    
    return inputs;
  }
  
  /**
   * Evaluate logic based on gate type
   */
  private evaluateLogic(type: string, inputs: boolean[]): boolean {
    switch (type) {
      case 'AND':
        return inputs.length > 0 && inputs.every(i => i);
      
      case 'OR':
        return inputs.some(i => i);
      
      case 'NOT':
        return inputs.length > 0 ? !inputs[0] : false;
      
      case 'XOR':
        // XOR: true if odd number of inputs are true
        return inputs.filter(i => i).length % 2 === 1;
      
      case 'NAND':
        return !(inputs.length > 0 && inputs.every(i => i));
      
      case 'NOR':
        return !inputs.some(i => i);
      
      default:
        return false;
    }
  }
  
  /**
   * Propagate gate output signal in specified direction
   */
  private propagateGateOutput(gatePos: any, outputDir: Direction, signal: boolean): void {
    const cell = gatePos.grid.cell(gatePos.x, gatePos.y);
    if (!cell) return;
    
    const outputCell = cell.neighbor(outputDir);
    if (!outputCell) return;
    
    // Propagate from output cell
    this.propagateSignal(
      { x: outputCell.x, y: outputCell.y },
      signal,
      gatePos.grid
    );
  }
}
