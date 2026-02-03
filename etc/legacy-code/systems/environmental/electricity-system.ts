import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { ConductorComponent } from '@basegrid/gameplay';
import { PowerSourceComponent } from '@basegrid/gameplay';
import { PoweredComponent } from '@basegrid/gameplay';
import { PoweredDeviceComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Electricity System - Manages power propagation through conductor networks
 * 
 * Handles electrical mechanics:
 * 1. **Power sources**: Generate electricity
 * 2. **Conductors**: Transmit power to adjacent conductors
 * 3. **Powered state**: Calculated via BFS from sources
 * 4. **Devices**: Activate when receiving sufficient power
 * 
 * Power propagation algorithm:
 * - BFS from each active PowerSource
 * - Spreads through adjacent Conductors
 * - Tracks distance and power level
 * - Activates PoweredDevices when threshold met
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const electricitySystem = new ElectricitySystem();
 * world.addSystem(electricitySystem);
 * 
 * // Create power source
 * const generator = world.createEntity();
 * world.addComponent(generator, PowerSourceComponent, { active: true, powerLevel: 100 });
 * world.addComponent(generator, GridPositionComponent, { x: 5, y: 7, grid });
 * 
 * // Create wire
 * const wire = world.createEntity();
 * world.addComponent(wire, ConductorComponent, { conductive: true });
 * world.addComponent(wire, GridPositionComponent, { x: 6, y: 7, grid });
 * 
 * // Create light
 * const light = world.createEntity();
 * world.addComponent(light, PoweredDeviceComponent, { powerThreshold: 10, active: false });
 * world.addComponent(light, GridPositionComponent, { x: 7, y: 7, grid });
 * 
 * // System automatically powers wire and activates light
 * world.update(16.67);
 * ```
 */
export class ElectricitySystem extends System {
  /**
   * Update electricity system
   */
  update(_dt: number): void {
    // 1. Clear all powered states (recalculate from scratch each frame)
    this.clearPoweredStates();
    
    // 2. Propagate power from each active source
    this.propagatePowerFromSources();
    
    // 3. Update device states based on power
    this.updateDeviceStates();
  }
  
  /**
   * Clear all Powered components
   */
  private clearPoweredStates(): void {
    const toRemove: Entity[] = [];
    
    for (const [entity, _] of this.world.query(PoweredComponent)) {
      toRemove.push(entity);
    }
    
    for (const entity of toRemove) {
      this.world.removeComponent(entity, PoweredComponent);
    }
  }
  
  /**
   * Propagate power from all active sources
   */
  private propagatePowerFromSources(): void {
    for (const [entity, source] of this.world.query(PowerSourceComponent)) {
      if (!source.active) continue;
      
      const sourcePos = this.world.getComponent(entity, GridPositionComponent);
      if (!sourcePos) continue;
      
      const powerLevel = source.powerLevel ?? 100;
      
      // BFS to propagate power through conductors
      this.propagatePower(entity, sourcePos, powerLevel);
    }
  }
  
  /**
   * Propagate power from a source using BFS
   */
  private propagatePower(sourceEntity: Entity, sourcePos: any, initialPower: number): void {
    interface QueueItem {
      entity: Entity;
      pos: any;
      power: number;
      distance: number;
    }
    
    const queue: QueueItem[] = [{ 
      entity: sourceEntity, 
      pos: sourcePos, 
      power: initialPower, 
      distance: 0 
    }];
    const visited = new Set<Entity>();
    
    // Mark source as powered
    this.world.addComponent(sourceEntity, PoweredComponent, {
      powerLevel: initialPower,
      distanceFromSource: 0
    });
    visited.add(sourceEntity);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const cell = current.pos.grid.cell(current.pos.x, current.pos.y);
      if (!cell) continue;
      
      // Get neighbors
      const neighbors = cell.neighbors().filter(n => n !== null);
      
      for (const neighbor of neighbors) {
        if (!neighbor) continue;
        
        // Find entities at neighbor position
        for (const [neighborEntity, neighborPos] of this.world.query(GridPositionComponent)) {
          // Skip if already visited
          if (visited.has(neighborEntity)) continue;
          
          // Only same grid
          if (neighborPos.grid !== current.pos.grid) continue;
          
          // Check if at neighbor position
          if (neighborPos.x !== neighbor.x || neighborPos.y !== neighbor.y) continue;
          
          // Check if it's a conductor or device
          const conductor = this.world.getComponent(neighborEntity, ConductorComponent);
          const device = this.world.getComponent(neighborEntity, PoweredDeviceComponent);
          
          if (!conductor && !device) continue;
          
          // Calculate power loss from resistance
          let transmittedPower = current.power;
          if (conductor?.resistance) {
            transmittedPower = Math.max(0, transmittedPower - conductor.resistance);
          }
          
          // Skip if power too low
          if (transmittedPower <= 0) continue;
          
          // Mark as powered
          this.world.addComponent(neighborEntity, PoweredComponent, {
            powerLevel: transmittedPower,
            distanceFromSource: current.distance + 1
          });
          visited.add(neighborEntity);
          
          // Continue propagation through conductors only
          if (conductor && conductor.conductive) {
            queue.push({
              entity: neighborEntity,
              pos: neighborPos,
              power: transmittedPower,
              distance: current.distance + 1
            });
          }
        }
      }
    }
  }
  
  /**
   * Update powered device states
   */
  private updateDeviceStates(): void {
    for (const [entity, device] of this.world.query(PoweredDeviceComponent)) {
      const powered = this.world.getComponent(entity, PoweredComponent);
      
      const newActiveState = powered ? powered.powerLevel >= device.powerThreshold : false;
      
      // Check if state changed
      if (newActiveState !== device.active) {
        device.active = newActiveState;
        
        // Trigger callback
        if (device.onStateChange) {
          device.onStateChange(entity, newActiveState);
        }
      }
    }
  }
}
