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
  GuardData,
  TeleporterData,
  ItemData,
  WallData,
  SpawnerData,
} from './index';
import { CHARACTER_PERSONAS, type CharacterPersona } from '../config/personas.config';

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
 * pressure switches, inverters, conductive floors, and gates).
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
 * Pressure switches support 4 activation modes:
 * - toggle: Flips state on each step (default)
 * - hold: ON while pressed, OFF when released
 * - latch: OFF → ON on first press, stays ON forever
 * - inverted-latch: ON → OFF on first press, stays OFF forever
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
 *   switchMode: 'hold',
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
    switchMode: 'toggle' | 'hold' | 'latch' | 'inverted-latch';
    initialState: boolean;
    color: string;
    sceneId: string;
  }>
): number {
  const switchMode = overrides?.switchMode || 'toggle';
  const defaultState = switchMode === 'inverted-latch' ? true : false;
  
  // Remove initialState from overrides to avoid passing it to spawn
  const { initialState, signalState, ...restOverrides } = overrides || {};
  
  return spatial.spawn('pressure-switch', x, y, layer, {
    signalType: 'pressure',
    signalState: initialState ?? signalState ?? defaultState,
    switchMode,
    color: '#00ffff',
    ...restOverrides,
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
 * Spawn a gate entity.
 *
 * Gates are retractable walls controlled by signals:
/**
 * Spawn a gate entity.
 *
 * Behavior:
 * - Signal ON → Open (FLOOR layer, non-blocking)
 * - Signal OFF → Closed (WALLS layer, blocking)
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param layer - Layer to spawn on (WALLS for closed, FLOOR for open)
 * @param overrides - Optional property overrides
 * @returns Entity ID of spawned gate
 *
 * @example
 * ```typescript
 * // Spawn closed gate on WALLS layer (starts blocking)
 * spawnGate(spatial, 10, 5, GameLayers.WALLS, {
 *   receivedSignal: false,
 *   color: '#ff0000'
 * });
 * ```
 */
export function spawnGate(
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
  const type = layer === GameLayers.WALLS ? 'gate-closed' : 'gate-open';
  return spatial.spawn(type, x, y, layer, {
    receiverType: 'gate',
    receivedSignal: false,
    color: '#ff0000',
    ...overrides,
  });
}

/**
 * Spawn a transceiver entity.
 *
 * Transceivers are wireless signal relays that broadcast to all
 * transceivers on the same channel. They introduce a 1-tick delay
 * as active components.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param layer - Layer to spawn on (typically COLLECTIBLES)
 * @param channel - Channel identifier for wireless linking
 * @param overrides - Optional property overrides
 * @returns Entity ID of spawned transceiver
 *
 * @example
 * ```typescript
 * // Spawn transceiver on channel 'door-1'
 * spawnTransceiver(spatial, 5, 5, GameLayers.COLLECTIBLES, 'door-1', {
 *   signalState: false,
 *   color: '#00ff88'
 * });
 * ```
 */
export function spawnTransceiver(
  spatial: SpatialSystem,
  x: number,
  y: number,
  layer: number,
  channel: string,
  overrides?: Partial<{
    signalState: boolean;
    receivedSignal: boolean;
    color: string;
    sceneId: string;
  }>
): number {
  return spatial.spawn('transceiver', x, y, layer, {
    signalType: 'transceiver',
    receiverType: 'transceiver',
    signalState: false,
    receivedSignal: false,
    channel,
    color: '#00ff88',
    ...overrides,
  });
}

/**
 * Logic System Spawn Helpers
 *
 * Helper functions for spawning logic-layer entities (path nodes, sleep-wake zones).
 */

/**
 * Spawn a path node entity.
 *
 * Path nodes serve dual purpose:
 * - Define NPC patrol paths (for AI systems)
 * - Conduct signals on LOGIC layer (invisible signal network)
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param overrides - Optional property overrides
 * @returns Entity ID of spawned path node
 *
 * @example
 * ```typescript
 * // Spawn path node on LOGIC layer
 * spawnPathNode(spatial, 5, 5, {
 *   color: '#888888'
 * });
 * ```
 */
export function spawnPathNode(
  spatial: SpatialSystem,
  x: number,
  y: number,
  overrides?: Partial<{
    color: string;
    sceneId: string;
  }>
): number {
  return spatial.spawn('path-node', x, y, GameLayers.LOGIC, {
    conductiveType: 'path',
    receiverType: 'path',
    receivedSignal: false,
    color: '#888888',
    ...overrides,
  });
}

/**
 * Spawn a sleep-wake entity.
 *
 * Sleep-wake entities toggle NPC active state based on signal:
 * - Signal ON → NPCs on this cell become active (awake)
 * - Signal OFF → NPCs on this cell become inactive (asleep)
 *
 * Signals propagate to adjacent sleep-wake entities, allowing
 * users to paint contiguous zones in the editor.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param overrides - Optional property overrides
 * @returns Entity ID of spawned sleep-wake entity
 *
 * @example
 * ```typescript
 * // Spawn sleep-wake entity on LOGIC layer
 * spawnSleepWake(spatial, 5, 5, {
 *   color: '#9900ff'
 * });
 * ```
 */
export function spawnSleepWake(
  spatial: SpatialSystem,
  x: number,
  y: number,
  overrides?: Partial<{
    color: string;
    sceneId: string;
  }>
): number {
  return spatial.spawn('sleep-wake', x, y, GameLayers.LOGIC, {
    receiverType: 'sleep-wake',
    conductiveType: 'sleep-wake',
    receivedSignal: false,
    color: '#9900ff',
    ...overrides,
  });
}

/**
 * Spawner System Spawn Helpers
 *
 * Helper functions for spawning spawner entities.
 */

/**
 * Spawn a spawner entity.
 *
 * Spawners spawn other entities in open adjacent cells when activated.
 * Activation occurs when player is within range (with optional LOS check)
 * or when the spawner is on an active sleep-wake zone.
 *
 * Spawners should typically be placed on WALLS layer to block movement.
 * Add hp/maxHp properties to make spawners damageable.
 *
 * Adjacent spawners (cardinal) are automatically grouped and share:
 * - Spawn limit (total living spawned entities)
 * - Cooldown (single timer for the group)
 * - Aggregated open cells for spawning
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param layer - Layer to spawn spawner on (use WALLS to block movement)
 * @param props - Required spawner properties
 * @returns Entity ID of spawned spawner
 *
 * @example
 * ```typescript
 * // Spawn a blocking, damageable enemy spawner
 * spawnSpawner(spatial, 5, 5, GameLayers.WALLS, {
 *   spawnType: 'enemy',
 *   spawnLimit: 3,
 *   cooldown: 20,
 *   activationRange: 8,
 *   spawnLayer: GameLayers.ACTORS,
 *   color: '#ff00ff',
 *   hp: 50,
 *   maxHp: 50,
 * });
 *
 * // Spawn a missile spawner with no proximity activation (sleep-wake only)
 * spawnSpawner(spatial, 10, 10, GameLayers.WALLS, {
 *   spawnType: 'homing-missile',
 *   spawnLimit: 2,
 *   cooldown: 30,
 *   activationRange: 0,
 *   spawnLayer: GameLayers.EPHEMERALS,
 *   requiresLineOfSight: false,
 *   color: '#ff8800',
 *   hp: 30,
 *   maxHp: 30,
 * });
 * ```
 */
export function spawnSpawner(
  spatial: SpatialSystem,
  x: number,
  y: number,
  layer: number,
  props: Omit<SpawnerData, 'id' | 'type'>
): number {
  return spatial.spawn('spawner', x, y, layer, {
    requiresLineOfSight: true,  // Default to requiring LOS
    spawnProps: {},             // Default to empty to prevent undefined
    ...props,
  });
}

// ============================================================
// Character Persona Spawn Helpers
// ============================================================

/**
 * Spawn an NPC (enemy) using a character persona preset.
 *
 * Merges persona defaults with per-instance overrides.
 * The persona defines base stats (hp, armor, damage, speed, scoreValue, etc.)
 * and overrides can customize any property.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param personaName - Name of the persona preset (e.g., 'grunt', 'soldier', 'elite', 'boss')
 * @param overrides - Optional per-instance property overrides
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * // Spawn a tier-1 grunt
 * const gruntId = spawnNPC(spatial, 5, 5, 'grunt', { sceneId: 'arena' });
 *
 * // Spawn a tier-3 elite with custom color
 * const eliteId = spawnNPC(spatial, 10, 10, 'elite', {
 *   sceneId: 'arena',
 *   color: '#ff00ff',
 * });
 * ```
 */
export function spawnNPC(
  spatial: SpatialSystem,
  x: number,
  y: number,
  personaName: string,
  overrides?: Record<string, unknown>
): number {
  const persona = CHARACTER_PERSONAS[personaName];
  if (!persona) {
    throw new Error(`Unknown character persona: "${personaName}"`);
  }

  return spawnNPCFromPersona(spatial, x, y, persona, overrides);
}

/**
 * Spawn an NPC from a CharacterPersona object directly.
 *
 * Use this when you have a custom persona not registered in CHARACTER_PERSONAS.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param persona - Character persona configuration
 * @param overrides - Optional per-instance property overrides
 * @returns Entity ID
 */
export function spawnNPCFromPersona(
  spatial: SpatialSystem,
  x: number,
  y: number,
  persona: CharacterPersona,
  overrides?: Record<string, unknown>
): number {
  // Build entity data from persona + overrides
  const entityData: Record<string, unknown> = {
    hp: persona.hp,
    maxHp: persona.maxHp ?? persona.hp,
    healthState: 'alive',
    damage: persona.damage ?? 0,
    aiState: 'idle',
  };

  // Optional persona properties
  if (persona.armor !== undefined) entityData.armor = persona.armor;
  if (persona.hardness !== undefined) entityData.hardness = persona.hardness;
  if (persona.scoreValue !== undefined) entityData.scoreValue = persona.scoreValue;
  if (persona.shield !== undefined) {
    entityData.shield = persona.shield;
    entityData.maxShield = persona.maxShield ?? persona.shield;
  }
  if (persona.resistance !== undefined) entityData.resistance = persona.resistance;
  if (persona.meleeDamage !== undefined) {
    entityData.meleeDamage = persona.meleeDamage;
    entityData.meleeCooldown = persona.meleeCooldown ?? 3;
    entityData.meleeRange = persona.meleeRange ?? 1;
  }
  if (persona.color !== undefined) entityData.color = persona.color;

  // NPC movement (if persona defines movement mode)
  if (persona.movementMode) {
    entityData.movementMode = persona.movementMode;
    if (persona.speed !== undefined) entityData.speed = persona.speed;
  }

  // Apply overrides
  if (overrides) {
    Object.assign(entityData, overrides);
  }

  // Use 'enemy' type for entities with movement, 'enemy' for simpler ones
  return spatial.spawn('enemy', x, y, GameLayers.ACTORS, entityData);
}

// ============================================================
// Objective Entity Spawn Helpers
// ============================================================

/**
 * Spawn a coin entity.
 *
 * Coins award score points when collected by the player.
 * Placed on COLLECTIBLES layer.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param scoreValue - Points awarded when collected
 * @param overrides - Optional property overrides
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const coinId = spawnCoin(spatial, 5, 5, 10);
 * ```
 */
export function spawnCoin(
  spatial: SpatialSystem,
  x: number,
  y: number,
  scoreValue: number,
  overrides?: Partial<{ color: string; sceneId: string }>
): number {
  return spatial.spawn('coin', x, y, GameLayers.COLLECTIBLES, {
    scoreValue,
    collectibleId: 'coin',
    color: '#ffd700',
    ...overrides,
  });
}

/**
 * Spawn a flag entity.
 *
 * Flags are objective markers collected by the player.
 * When all flags with a given objectiveId are collected,
 * the matching 'collect-flag' objective is completed.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param objectiveId - Objective identifier (links to ObjectiveDefinition.targetId)
 * @param overrides - Optional property overrides
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const flagId = spawnFlag(spatial, 10, 10, 'red-flag', { color: '#ff0000' });
 * ```
 */
export function spawnFlag(
  spatial: SpatialSystem,
  x: number,
  y: number,
  objectiveId: string,
  overrides?: Partial<{ color: string; sceneId: string }>
): number {
  return spatial.spawn('flag', x, y, GameLayers.COLLECTIBLES, {
    objectiveId,
    collectibleId: 'flag',
    color: '#ff0000',
    ...overrides,
  });
}

/**
 * Spawn an exit entity.
 *
 * Exits mark the target for 'reach-exit' objectives.
 * Player overlapping an exit triggers objective completion.
 * Placed on FLOOR layer (non-blocking).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param overrides - Optional property overrides
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const exitId = spawnExit(spatial, 15, 15, { color: '#00ff00' });
 * ```
 */
export function spawnExit(
  spatial: SpatialSystem,
  x: number,
  y: number,
  overrides?: Partial<{ color: string; sceneId: string }>
): number {
  return spatial.spawn('exit', x, y, GameLayers.FLOOR, {
    activated: false,
    color: '#00ff00',
    ...overrides,
  });
}
