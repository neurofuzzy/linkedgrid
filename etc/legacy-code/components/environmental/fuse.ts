import { defineComponent } from '@basegrid/ecs';

/**
 * @component Fuse
 * @icon zap-off
 * @description Chain reaction conductor (burn and spread to bombs)
 * 
 * Fuse component for entities that conduct fire/explosions.
 * 
 * Fuses are chain reaction conductors:
 * - Start unlit
 * - When lit, burn for duration
 * - Spread to adjacent fuses
 * - Trigger bombs when connected
 * 
 * States:
 * - **Unlit**: Waiting to be ignited
 * - **Lit**: Currently burning
 * - **Burned**: Already burned out
 * 
 * @property {string} state - Current state (unlit, lit, burned)
 * @property {number} burnDuration - How long to burn before burning out (ticks)
 * @property {number} ticksLit - Ticks since lit
 * 
 * @example
 * ```typescript
 * // Create fuse segment
 * const fuse = world.createEntity();
 * world.addComponent(fuse, FuseComponent, {
 *   burnDuration: 30,  // Burns for 30 ticks
 *   state: 'unlit'
 * });
 * world.addComponent(fuse, GridPositionComponent, { x: 5, y: 7, grid });
 * 
 * // FuseSystem will handle spreading
 * ```
 */
export interface Fuse {
  /** Current state */
  state: 'unlit' | 'lit' | 'burned';
  
  /** How long to burn before burning out (ticks) */
  burnDuration: number;
  
  /** Internal: Ticks since lit */
  ticksLit?: number;
}

export const FuseComponent = defineComponent<Fuse>();
