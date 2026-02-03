/**
 * Ice Spread System
 * 
 * Handles ice spreading through water using grid layers.
 * Simple grid-value-based spreading (no entities).
 */

import { System } from '@basegrid/ecs';
import type { LinkedGrid } from '@basegrid/grid';

export interface IceSpreadConfig {
  grid: LinkedGrid<number>;
  liquidLayer: number;
  displayLayer: number;
  waterValue: number;
  iceValue: number;
  freezingValue: number;
  emptyValue: number;
  spreadInterval: number;  // Frames between spreads
}

/**
 * IceSpreadSystem
 * 
 * Spreads ice through water on a grid using cell values.
 * Ice spreads to adjacent water cells every N frames.
 * 
 * @example
 * ```typescript
 * const iceSystem = new IceSpreadSystem({
 *   grid,
 *   liquidLayer: 2,
 *   displayLayer: 0,
 *   waterValue: 2,
 *   iceValue: 3,
 *   freezingValue: 4,
 *   emptyValue: 0,
 *   spreadInterval: 3
 * });
 * world.addSystem(iceSystem);
 * ```
 */
export class IceSpreadSystem extends System {
  private config: IceSpreadConfig;
  private tickCount = 0;

  constructor(config: IceSpreadConfig) {
    super();
    this.config = config;
  }

  update(_dt: number): void {
    this.tickCount++;

    const { grid, liquidLayer, waterValue, iceValue, freezingValue, spreadInterval } = this.config;

    // Spread every N frames
    if (this.tickCount % spreadInterval === 0) {
      // 1. Convert freezing to ice
      for (const cell of grid.cells) {
        if (cell.values[liquidLayer] === freezingValue) {
          cell.setValue(liquidLayer, iceValue);
        }
      }

      // 2. Spread to new neighbors
      const toFreeze: Array<{ x: number; y: number }> = [];
      
      for (const cell of grid.cells) {
        const liquid = cell.values[liquidLayer];
        if (liquid === iceValue || liquid === freezingValue) {
          // Check neighbors
          const neighbors = cell.neighbors().filter(n => n !== null);
          
          for (const neighbor of neighbors) {
            if (neighbor && neighbor.values[liquidLayer] === waterValue) {
              toFreeze.push({ x: neighbor.x, y: neighbor.y });
            }
          }
        }
      }

      // Mark water as freezing
      for (const pos of toFreeze) {
        const cell = grid.cell(pos.x, pos.y);
        if (cell) {
          cell.setValue(liquidLayer, freezingValue);
        }
      }
    }

    // 3. Composite display layer
    this.compositeDisplay();
  }

  private compositeDisplay(): void {
    const { grid, liquidLayer, displayLayer, emptyValue } = this.config;
    const terrainLayer = 1;  // Assuming terrain is layer 1

    for (const cell of grid.cells) {
      const liquid = cell.values[liquidLayer] ?? emptyValue;
      const terrain = cell.values[terrainLayer] ?? emptyValue;

      if (liquid !== emptyValue) {
        cell.setValue(displayLayer, liquid);
      } else {
        cell.setValue(displayLayer, terrain);
      }
    }
  }
}
