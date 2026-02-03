import { defineComponent } from '@basegrid/ecs';

/**
 * @component Powered
 * @icon plug
 * @description Currently receiving electricity (auto-managed by system)
 * 
 * Powered component for entities receiving electricity.
 * 
 * This is a transient state component that gets cleared and recalculated
 * each update by ElectricitySystem. It indicates an entity is currently
 * receiving power from a PowerSource through Conductors.
 * 
 * Note: This component is added/removed automatically by ElectricitySystem.
 * You typically don't add it manually.
 * 
 * @property {number} powerLevel - Current power level received (0-100+)
 * @property {number} distanceFromSource - Distance from nearest power source
 * 
 * @example
 * ```typescript
 * // Check if entity is powered
 * const powered = world.getComponent(wire, PoweredComponent);
 * if (powered) {
 *   console.log(`Powered at level ${powered.powerLevel}`);
 *   console.log(`Distance from source: ${powered.distanceFromSource}`);
 * }
 * ```
 */
export interface Powered {
  /** Current power level received (0-100+) */
  powerLevel: number;
  
  /** Distance from nearest power source (for visualization) */
  distanceFromSource: number;
}

export const PoweredComponent = defineComponent<Powered>();
