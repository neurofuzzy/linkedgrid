/**
 * Type-Safe Entity Spawn Helpers
 *
 * Provides typed helper functions for spawning entity archetypes with compile-time
 * property validation. These functions wrap SpatialSystem.spawn() with
 * strongly-typed interfaces.
 *
 * Benefits:
 * - Type safety: TypeScript enforces all required trait properties
 * - IDE autocomplete: Trait properties are discoverable
 * - Documentation: Clear contracts for each entity archetype
 * - Non-breaking: Raw spawn() still available for flexibility
 *
 * Usage:
 * - Use these helpers when entity contract is known at compile time
 * - Use raw spawn() when properties are dynamic or deserialized
 *
 * @example
 * ```typescript
 * // Type-safe spawn with compile-time validation
 * const playerId = spawnPlayer(spatial, 5, 5, {
 *   hp: 100,
 *   maxHp: 100,
 *   damage: 10,
 *   sceneId: 'room1'
 * }); // TypeScript enforces all required trait properties
 *
 * // Raw spawn still works (for flexibility)
 * const enemyId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
 *   hp: 50,
 *   maxHp: 50,
 *   damage: 5,
 *   aiState: 'idle'
 * });
 * ```
 */

import type { SpatialSystem } from '../core/spatial-system';
import { GameLayers } from '../config/layers.config';
import type {
  PlayerData,
  EnemyData,
  TeleporterData,
  ItemData,
  WallData,
} from './index';

/**
 * Spawn a player entity with type-safe properties.
 *
 * Automatically places on ACTORS layer (layer 5).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Player properties (hp, maxHp, damage, sceneId)
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const playerId = spawnPlayer(spatial, 5, 5, {
 *   hp: 100,
 *   maxHp: 100,
 *   damage: 10,
 *   sceneId: 'room1'
 * });
 * ```
 */
export function spawnPlayer(
  spatial: SpatialSystem,
  x: number,
  y: number,
  props: Omit<PlayerData, 'id' | 'type'>
): number {
  return spatial.spawn('player', x, y, GameLayers.ACTORS, props);
}

/**
 * Spawn an enemy entity with type-safe properties.
 *
 * Automatically places on ACTORS layer (layer 5).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Enemy properties (hp, maxHp, damage, aiState)
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const enemyId = spawnEnemy(spatial, 10, 10, {
 *   hp: 50,
 *   maxHp: 50,
 *   damage: 5,
 *   aiState: 'idle'
 * });
 * ```
 */
export function spawnEnemy(
  spatial: SpatialSystem,
  x: number,
  y: number,
  props: Omit<EnemyData, 'id' | 'type'>
): number {
  return spatial.spawn('enemy', x, y, GameLayers.ACTORS, props);
}

/**
 * Spawn a teleporter entity with type-safe properties.
 *
 * Automatically places on FLOOR layer (layer 1).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Teleporter properties (targetKey, sceneId)
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const teleporterId = spawnTeleporter(spatial, 5, 7, {
 *   targetKey: 'red',
 *   sceneId: 'room1'
 * });
 * ```
 */
export function spawnTeleporter(
  spatial: SpatialSystem,
  x: number,
  y: number,
  props: Omit<TeleporterData, 'id' | 'type'>
): number {
  return spatial.spawn('teleporter', x, y, GameLayers.FLOOR, props);
}

/**
 * Spawn an item entity with type-safe properties.
 *
 * Automatically places on COLLECTIBLES layer (layer 3).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Item properties (itemType, and any additional properties)
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const itemId = spawnItem(spatial, 8, 8, {
 *   itemType: 'health_potion'
 * });
 * ```
 */
export function spawnItem(
  spatial: SpatialSystem,
  x: number,
  y: number,
  props: Omit<ItemData, 'id' | 'type'>
): number {
  return spatial.spawn('item', x, y, GameLayers.COLLECTIBLES, props);
}

/**
 * Spawn a wall entity with type-safe properties.
 *
 * Automatically places on WALLS layer (layer 4).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Optional additional wall properties
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const wallId = spawnWall(spatial, 10, 5);
 * ```
 */
export function spawnWall(
  spatial: SpatialSystem,
  x: number,
  y: number,
  props?: Omit<WallData, 'id' | 'type'>
): number {
  return spatial.spawn('wall', x, y, GameLayers.WALLS, props || {});
}

/**
 * Advanced: Spawn player with specific ID (for scene transitions).
 *
 * WARNING: Use sparingly! Only for save/load and scene transitions.
 * Normal spawning should use spawnPlayer() for proper ID management.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param entityId - Specific entity ID to use
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Player properties
 *
 * @example
 * ```typescript
 * // Scene transition: move player entity #42 to new scene
 * spawnPlayerWithId(spatial, 42, 10, 10, {
 *   hp: 100,
 *   maxHp: 100,
 *   damage: 10,
 *   sceneId: 'room2'
 * });
 * ```
 */
export function spawnPlayerWithId(
  spatial: SpatialSystem,
  entityId: number,
  x: number,
  y: number,
  props: Omit<PlayerData, 'id' | 'type'>
): void {
  spatial.spawnWithId(entityId, 'player', x, y, GameLayers.ACTORS, props);
}

/**
 * Signal System Spawn Helpers
 *
 * Helper functions for spawning signal-related entities (oscillators,
 * pressure switches, inverters, conductive floors, and bollards).
 */

/**
 * Spawn an oscillator entity.
 *
 * Oscillators automatically toggle on/off at a fixed period.
 * Default: 40 ticks (20 on, 20 off) = 4 seconds total at 10 TPS.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param layer - Layer to spawn on (typically COLLECTIBLES)
 * @param overrides - Optional property overrides
 * @returns Entity ID of spawned oscillator
 *
 * @example
 * ```typescript
 * // Spawn oscillator on COLLECTIBLES layer
 * spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
 *   signalState: true,
 *   oscillatorPeriod: 40,
 *   color: '#ffff00'
 * });
 * ```
 */
export function spawnOscillator(
  spatial: SpatialSystem,
  x: number,
  y: number,
  layer: number,
  overrides?: Partial<{
    signalState: boolean;
    oscillatorPeriod: number;
    color: string;
    sceneId: string;
  }>
): number {
  return spatial.spawn('oscillator', x, y, layer, {
    signalType: 'oscillator',
    signalState: false,
    oscillatorPeriod: 40,
    color: '#ffff00',
    ...overrides,
  });
}

/**
 * Spawn a pressure switch entity.
 *
 * Pressure switches toggle when an entity steps on them.
 * Edge-triggered: only toggles on entry, not while standing.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param layer - Layer to spawn on (typically COLLECTIBLES)
 * @param overrides - Optional property overrides
 * @returns Entity ID of spawned pressure switch
 *
 * @example
 * ```typescript
 * // Spawn pressure switch on COLLECTIBLES layer
 * spawnPressureSwitch(spatial, 7, 5, GameLayers.COLLECTIBLES, {
 *   signalState: false,
 *   color: '#00ffff'
 * });
 * ```
 */
export function spawnPressureSwitch(
  spatial: SpatialSystem,
  x: number,
  y: number,
  layer: number,
  overrides?: Partial<{
    signalState: boolean;
    color: string;
    sceneId: string;
  }>
): number {
  return spatial.spawn('pressure-switch', x, y, layer, {
    signalType: 'pressure',
    signalState: false,
    color: '#00ffff',
    ...overrides,
  });
}

/**
 * Spawn an inverter entity.
 *
 * Inverters receive signals and emit the opposite state (NOT gate).
 * One tick delay between input change and output effect.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param layer - Layer to spawn on (typically COLLECTIBLES)
 * @param overrides - Optional property overrides
 * @returns Entity ID of spawned inverter
 *
 * @example
 * ```typescript
 * // Spawn inverter on COLLECTIBLES layer
 * spawnInverter(spatial, 9, 5, GameLayers.COLLECTIBLES, {
 *   signalState: false,
 *   receivedSignal: false,
 *   color: '#ff00ff'
 * });
 * ```
 */
export function spawnInverter(
  spatial: SpatialSystem,
  x: number,
  y: number,
  layer: number,
  overrides?: Partial<{
    signalState: boolean;
    receivedSignal: boolean;
    color: string;
    sceneId: string;
  }>
): number {
  return spatial.spawn('inverter', x, y, layer, {
    signalType: 'inverter',
    receiverType: 'inverter',
    signalState: false,
    receivedSignal: false,
    color: '#ff00ff',
    ...overrides,
  });
}

/**
 * Spawn a conductive floor entity.
 *
 * Conductive floors carry signals in 4 directions (up, down, left, right).
 * Used to connect switches and receivers in a signal network.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param overrides - Optional property overrides
 * @returns Entity ID of spawned conductive floor
 *
 * @example
 * ```typescript
 * // Spawn conductive floor tile on FLOOR layer
 * spawnConductiveFloor(spatial, 6, 5, {
 *   color: '#808080'
 * });
 * ```
 */
export function spawnConductiveFloor(
  spatial: SpatialSystem,
  x: number,
  y: number,
  overrides?: Partial<{
    color: string;
    sceneId: string;
  }>
): number {
  return spatial.spawn('conductive-floor', x, y, GameLayers.FLOOR, {
    conductiveType: 'floor',
    receiverType: 'floor',
    receivedSignal: false,
    color: overrides?.color || '#808080',
    sceneId: overrides?.sceneId || 'default',
  });
}

/**
 * Spawn a bollard entity.
 *
 * Bollards are retractable walls controlled by signals:
 * - Signal ON → Open (FLOOR layer, non-blocking)
 * - Signal OFF → Closed (WALLS layer, blocking)
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param layer - Layer to spawn on (WALLS for closed, FLOOR for open)
 * @param overrides - Optional property overrides
 * @returns Entity ID of spawned bollard
 *
 * @example
 * ```typescript
 * // Spawn closed bollard on WALLS layer (starts blocking)
 * spawnBollard(spatial, 10, 5, GameLayers.WALLS, {
 *   receivedSignal: false,
 *   color: '#ff0000'
 * });
 * ```
 */
export function spawnBollard(
  spatial: SpatialSystem,
  x: number,
  y: number,
  layer: number,
  overrides?: Partial<{
    receivedSignal: boolean;
    color: string;
    sceneId: string;
  }>
): number {
  const type = layer === GameLayers.WALLS ? 'bollard-closed' : 'bollard-open';
  return spatial.spawn(type, x, y, layer, {
    receiverType: 'bollard',
    receivedSignal: false,
    color: '#ff0000',
    ...overrides,
  });
}

