import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import type { LinkedGrid } from '@basegrid/grid';

/**
 * @component Portal
 * @category level-mechanics
 * @icon portal
 * @description Unified portal for intra-scene teleportation and inter-scene transitions
 * 
 * Portal Component - Unified system for both teleportation and scene transitions
 * 
 * Supports:
 * - Intra-scene teleport pads (same grid, instant)
 * - Inter-scene doors (different grid, scene change)
 * - Color-coded pairing (red, blue, green, yellow, purple)
 * - Optional key-based locking
 * - Floor-based (walkable) or wall-based (blocking)
 * 
 * Examples:
 * - Teleport pads (Pac-Man style wrapping)
 * - Portal pairs (two-way travel within scene)
 * - Colored doors (scene transitions with keys)
 * - Level exits and entrances
 * 
 * @property {string} color - Color channel for visual grouping and pairing
 * @property {string} portalType - Portal type (floor-pad or door)
 * @property {number} destinationX - For intra-scene: target X coordinate
 * @property {number} destinationY - For intra-scene: target Y coordinate
 * @property {LinkedGrid} destinationGrid - Target grid (if undefined, same grid)
 * @property {string} targetSceneName - For inter-scene: scene name (editor-friendly)
 * @property {string} targetSceneGuid - For inter-scene: scene GUID (runtime)
 * @property {boolean} spawnAtPairedPortal - Auto-pair with matching color portal
 * @property {boolean} locked - Whether portal is locked (requires key)
 * @property {string} requiredKeyColor - Key color required to unlock
 * @property {boolean} active - Whether portal is currently active
 * @property {number} cooldown - Cooldown to prevent instant re-teleport (ticks)
 * @property {string[]} affectsTags - Only teleport these tags
 * @property {string[]} ignoresTags - Don't teleport these tags
 * 
 * @example
 * ```typescript
 * // Intra-scene teleport pad (floor-based, walkable)
 * const pad = world.createEntity();
 * world.addComponent(pad, PortalComponent, {
 *   color: 'red',
 *   portalType: 'floor-pad',
 *   destinationX: 25,
 *   destinationY: 15,
 *   cooldown: 30
 * });
 * 
 * // Inter-scene door (wall-based, blocking when locked)
 * const door = world.createEntity();
 * world.addComponent(door, PortalComponent, {
 *   color: 'blue',
 *   portalType: 'door',
 *   targetSceneName: 'cave-entrance',
 *   spawnAtPairedPortal: true,
 *   locked: true,
 *   requiredKeyColor: 'blue'
 * });
 * ```
 */
export interface Portal {
  // === Appearance ===
  /** Color channel for visual grouping and pairing */
  color: 'red' | 'blue' | 'green' | 'yellow' | 'purple';
  
  /** Portal type determines blocking behavior */
  portalType: 'floor-pad' | 'door';  // floor = walkable, door = blocks when locked
  
  // === Destination (Intra-scene) ===
  /** For intra-scene: direct coordinates */
  destinationX?: number;
  destinationY?: number;
  destinationGrid?: LinkedGrid<number>;  // If undefined, same grid (intra-scene)
  
  // === Destination (Inter-scene) ===
  /** For inter-scene: scene reference */
  targetSceneName?: string;       // Editor-friendly name
  targetSceneGuid?: string;        // Runtime GUID
  
  /** Auto-pair with matching color portal in target scene */
  spawnAtPairedPortal?: boolean;
  
  // === Locking ===
  /** Whether portal is locked (requires key) */
  locked?: boolean;
  
  /** Key color required to unlock (matches portal color by default) */
  requiredKeyColor?: 'red' | 'blue' | 'green' | 'yellow' | 'purple';
  
  /** Whether portal is active (can be toggled off) */
  active?: boolean;
  
  // === Cooldown (prevent instant re-teleport) ===
  /** Cooldown duration to prevent instant re-teleport (ticks) */
  cooldown?: number;
  
  // === Filtering ===
  /** Tags that this portal affects (e.g., ['player', 'enemy']) */
  affectsTags?: string[];
  
  /** Tags that this portal ignores */
  ignoresTags?: string[];
  
  // === Usage Limits ===
  /** Max uses (portal disables after this many uses) */
  maxUses?: number;
  
  /** Current use count */
  useCount?: number;
  
  // === Callbacks ===
  /** Callback when entity teleports */
  onTeleport?: (traveler: Entity, fromX: number, fromY: number, toX: number, toY: number) => void;
  
  /** Callback when locked portal is attempted */
  onLocked?: (portal: Entity, traveler: Entity) => void;
  
  /** Callback when portal is unlocked */
  onUnlock?: (portal: Entity, unlocker: Entity) => void;
}

export const PortalComponent = defineComponent<Portal>();

/**
 * PortalCooldown component - Tracks portal cooldown per entity.
 * 
 * This is automatically added by PortalSystem to entities that teleport,
 * to prevent them from immediately teleporting again.
 * 
 * @internal Used by PortalSystem
 */
export interface PortalCooldown {
  /** Remaining cooldown ticks */
  remaining: number;
}

export const PortalCooldownComponent = defineComponent<PortalCooldown>();

// Legacy exports for backwards compatibility
export const TeleporterComponent = PortalComponent;
export const TeleportCooldownComponent = PortalCooldownComponent;
export type Teleporter = Portal;
export type TeleportCooldown = PortalCooldown;
