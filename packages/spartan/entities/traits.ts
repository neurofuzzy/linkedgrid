/**
 * Entity Traits
 *
 * Traits are passive data contracts that entities can possess.
 * Systems operate on traits, not entity types, enabling generic reusable logic.
 *
 * Design principles:
 * - Traits are dumb data (no methods, no logic)
 * - Entities compose multiple traits
 * - Systems check for traits and operate on them
 * - Use composition over inheritance
 *
 * @example
 * ```typescript
 * // System operates on trait, not entity type
 * class HealthSystem implements GameSystem {
 *   update(context: GameContext) {
 *     for (const pos of context.spatial.getAllPositions()) {
 *       const data = context.spatial.getEntityData(pos.entityId);
 *
 *       // Works with ANY entity that has health trait
 *       if (hasHealth(data)) {
 *         if (data.hp <= 0) {
 *           context.spatial.removeEntity(pos.entityId);
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 */

/**
 * HasHealth - Entity can take damage and be destroyed.
 *
 * Used by:
 * - Health systems (track and update HP)
 * - Damage systems (apply damage)
 * - UI systems (display health bars)
 *
 * @example
 * ```typescript
 * const entity = { id: 1, type: 'player', hp: 100, maxHp: 100 };
 * if (hasHealth(entity)) {
 *   entity.hp -= 10;
 * }
 * ```
 */
export interface HasHealth {
  hp: number;
  maxHp: number;
}

/**
 * CanDealDamage - Entity can damage other entities.
 *
 * Used by:
 * - Damage systems (apply damage on overlap)
 * - Combat systems (calculate damage)
 *
 * @example
 * ```typescript
 * const projectile = { id: 2, type: 'arrow', damage: 15 };
 * if (canDealDamage(projectile) && hasHealth(target)) {
 *   target.hp -= projectile.damage;
 * }
 * ```
 */
export interface CanDealDamage {
  damage: number;
}

/**
 * HasAI - Entity has AI state for behavior systems.
 *
 * Used by:
 * - AI systems (autonomous behavior)
 * - Behavior trees
 * - State machines
 *
 * @example
 * ```typescript
 * const enemy = { id: 3, type: 'enemy', aiState: 'chase' };
 * if (hasAI(enemy)) {
 *   if (enemy.aiState === 'chase') {
 *     // Chase player logic
 *   }
 * }
 * ```
 */
export interface HasAI {
  aiState: 'idle' | 'chase' | 'attack';
}

/**
 * HasSceneLocation - Entity tracks which scene it belongs to.
 *
 * Used by:
 * - Scene management (track entity locations)
 * - Cross-scene operations
 * - Save/load systems
 * - Debugging and visualization
 *
 * @example
 * ```typescript
 * const entity = { id: 4, type: 'player', sceneId: 'dungeon_1' };
 * if (hasSceneLocation(entity)) {
 *   console.log(`Entity in scene: ${entity.sceneId}`);
 * }
 * ```
 */
export interface HasSceneLocation {
  sceneId: string;
}

/**
 * HasTeleportTarget - Entity is a teleporter with a connection key.
 *
 * Used by:
 * - Teleporter systems (cross-scene transitions)
 * - Portal systems
 * - Warp systems
 *
 * @example
 * ```typescript
 * const teleporter = { id: 5, type: 'teleporter', targetKey: 'red_portal' };
 * if (hasTeleportTarget(teleporter)) {
 *   const connections = gameState.getConnections(teleporter.targetKey);
 *   // Teleport to connection
 * }
 * ```
 */
export interface HasTeleportTarget {
  targetKey: string;
}

/**
 * HasInventory - Entity can hold collected items.
 *
 * Used by:
 * - Collection systems (pick up items)
 * - Inventory systems (manage items)
 * - Door systems (check for keys)
 *
 * @example
 * ```typescript
 * const player = { id: 1, type: 'player', inventory: ['red-key', 'blue-key'] };
 * if (hasInventory(player)) {
 *   player.inventory.push('green-key');
 * }
 * ```
 */
export interface HasInventory {
  inventory: string[];
}

/**
 * IsLockable - Entity can be locked/unlocked with a key.
 *
 * Used by:
 * - Door systems (lock/unlock doors)
 * - Container systems (locked chests)
 *
 * @example
 * ```typescript
 * const door = { id: 2, type: 'door', isLocked: true, requiredKey: 'red-key' };
 * if (isLockable(door) && !door.isLocked) {
 *   // Door is open
 * }
 * ```
 */
export interface IsLockable {
  isLocked: boolean;
  requiredKey: string;
}

/**
 * IsCollectible - Entity can be picked up.
 *
 * Used by:
 * - Collection systems (pick up items)
 * - Inventory systems (add to inventory)
 *
 * @example
 * ```typescript
 * const key = { id: 3, type: 'key', collectibleType: 'key', collectibleId: 'red-key' };
 * if (isCollectible(key)) {
 *   // Add to player inventory
 * }
 * ```
 */
export interface IsCollectible {
  collectibleType: string;
  collectibleId: string;
}

/**
 * HasColor - Entity has a display color.
 *
 * Used by:
 * - Rendering systems (visual display)
 * - UI systems (color-coding)
 * - Editor tools (visual identification)
 *
 * @example
 * ```typescript
 * const door = { id: 4, type: 'door', color: 'red' };
 * if (hasColor(door)) {
 *   renderer.setColor(door.color);
 * }
 * ```
 */
export interface HasColor {
  color: string;
}

/**
 * HasFloorEffect - Entity is a floor tile with gameplay effects.
 *
 * Used by:
 * - FloorEffectSystem (apply damage, healing, movement modifiers)
 * - Rendering systems (visual feedback)
 *
 * Trigger modes:
 * - 'on-entry': Effect triggers once per cell entry (ice slide, mud slow)
 * - 'continuous': Effect triggers repeatedly based on cadence (damage, healing)
 *
 * Effect types:
 * - 'damage': Deals damage over time (lava, acid, spikes)
 * - 'heal': Restores health over time (medbay, fountain)
 * - 'slide': Entity continues moving one cell in same direction (ice)
 * - 'slow': Cancels one move per cell entry (mud, quicksand)
 *
 * @example
 * ```typescript
 * // Explicit triggerMode (recommended for clarity)
 * const lava = { id: 5, type: 'lava', effectType: 'damage', triggerMode: 'continuous', damage: 10, cadence: 1000 };
 * const ice = { id: 7, type: 'ice', effectType: 'slide', triggerMode: 'on-entry' };
 * 
 * // triggerMode is optional - automatically inferred from effectType for backward compatibility
 * const medbay = { id: 6, type: 'medbay', effectType: 'heal', healRate: 5, cadence: 2000, cooldown: 3000 }; // Infers 'continuous'
 * const mud = { id: 8, type: 'mud', effectType: 'slow' }; // Infers 'on-entry'
 * ```
 */
export interface HasFloorEffect {
  effectType: 'damage' | 'heal' | 'slide' | 'slow';
  triggerMode?: 'on-entry' | 'continuous'; // Optional - inferred from effectType if omitted
  
  // Damage properties
  damage?: number;           // Damage per application
  
  // Healing properties
  healRate?: number;         // HP restored per application
  cooldown?: number;         // Milliseconds before healing can apply again (per entity)
  
  // Movement modifier properties (for on-entry effects)
  slideDistance?: number;    // Number of ticks to slide (ice)
  slowFactor?: number;       // Movement speed multiplier 0-1 (mud)
  
  // Timing (for continuous effects)
  cadence?: number;          // Milliseconds between applications (damage/heal)
}

/**
 * HasPropagation - Entity can spread to adjacent cells.
 *
 * Used by:
 * - PropagationSystem (spread effects across grid)
 * - Rendering systems (visual feedback for spreading)
 *
 * Propagation types:
 * - 'fire': Fire spreading through flammable materials (probabilistic)
 * - 'liquid': Water, oil, or other liquid flow (deterministic)
 * - 'gas': Poison gas, smoke, or other airborne effects (deterministic)
 * - 'chain': Chain reactions, explosions, or cascading effects (deterministic)
 *
 * @example
 * ```typescript
 * // Fire that spreads probabilistically and damages
 * const fire = {
 *   id: 9,
 *   type: 'fire',
 *   propagationType: 'fire',
 *   spreadRate: 2,                 // Spread every 2 ticks
 *   spreadProbability: 0.6,        // 60% chance to spread to each neighbor
 *   spreadLayer: GameLayers.FLOOR_EFFECTS,
 *   spreadType: 'fire',
 *   // No maxDistance - fire spread is limited by flammable materials
 *   lifetime: 20,                  // Burns for 20 ticks
 *   blockedByLayers: [GameLayers.WALLS],
 *   // Can also have floor effect properties
 *   effectType: 'damage',
 *   triggerMode: 'continuous',
 *   damage: 5,
 *   cadence: 2                     // Damage every 2 ticks
 * };
 *
 * // Poison gas that dissipates (always spreads)
 * const gas = {
 *   id: 10,
 *   type: 'poison-gas',
 *   propagationType: 'gas',
 *   spreadRate: 1,                     // Spread every tick (fast)
 *   spreadLayer: GameLayers.EPHEMERALS,
 *   spreadType: 'poison-gas',
 *   maxDistance: 8,
 *   lifetime: 15                       // Dissipates after 15 ticks
 * };
 * ```
 */
export interface HasPropagation {
  propagationType: 'fire' | 'liquid' | 'gas' | 'chain';
  spreadRate: number;         // Ticks between spread attempts
  spreadLayer: number;        // Target layer for spawned entities
  spreadType: string;         // Entity type to spawn when propagating
  spreadProbability?: number; // 0.0-1.0 chance to spread to each neighbor (default 1.0)
  maxDistance?: number;       // Optional max spread radius from origin (Manhattan distance)
  lifetime?: number;          // Optional duration in ticks before auto-despawn
  blockedByLayers?: number[]; // Optional layers that block spread (e.g., [GameLayers.WALLS])
}

/**
 * HasFlammability - Entity can catch fire and burn.
 *
 * Used by:
 * - PropagationSystem (determine if fire can spread to this entity)
 * - Rendering systems (visual feedback for flammable materials)
 *
 * Used by PropagationSystem to determine if fire can spread to this entity
 * and modify spread probability based on material properties.
 *
 * When fire attempts to spread, the effective spread chance is:
 * fire.spreadProbability × target.flammability
 *
 * Common flammability values:
 * - Grass: 0.8 (highly flammable)
 * - Gasoline: 0.95 (extremely flammable)
 * - Fuse: 0.99 (designed to burn)
 * - Wood: 0.6 (moderately flammable)
 *
 * @example
 * ```typescript
 * // Grass that catches fire easily
 * const grass = {
 *   id: 15,
 *   type: 'grass',
 *   flammability: 0.8,
 *   color: '#7cba00'
 * };
 *
 * // Gasoline spill - extremely flammable
 * const gasoline = {
 *   id: 16,
 *   type: 'gasoline',
 *   flammability: 0.95,
 *   color: '#d4af37'
 * };
 * ```
 */
export interface HasFlammability {
  flammability: number; // 0.0-1.0, chance modifier for fire spread
}

/**
 * HasExplosion - Entity can explode, dealing area damage.
 *
 * Used by:
 * - ExplosionSystem (trigger and process explosions)
 * - Damage systems (chain reactions)
 *
 * Explosions are instantaneous area-of-effect events that:
 * - Deal damage to entities within radius
 * - Respect line-of-sight (walls block and create shadows)
 * - Ignite flammable entities
 * - Can trigger chain reactions
 *
 * Trigger conditions:
 * - 'on-death': Explodes when entity dies (hp reaches 0)
 * - 'on-fire': Explodes when fire entity is at same position
 * - 'manual': Only explodes via explicit system trigger
 *
 * Common explosion values:
 * - Small barrel: damage 20, radius 3
 * - Large barrel: damage 40, radius 5
 * - Grenade: damage 30, radius 4
 * - Mine: damage 50, radius 3 (concentrated)
 *
 * @example
 * ```typescript
 * // Explosive barrel that detonates when destroyed
 * const barrel = {
 *   id: 17,
 *   type: 'barrel',
 *   hp: 20,
 *   maxHp: 20,
 *   explosionDamage: 30,
 *   explosionRadius: 4,
 *   triggerCondition: 'on-death',
 *   flammability: 0.7  // Can also catch fire
 * };
 *
 * // Fire-triggered bomb
 * const bomb = {
 *   id: 18,
 *   type: 'bomb',
 *   explosionDamage: 50,
 *   explosionRadius: 5,
 *   triggerCondition: 'on-fire'
 * };
 * ```
 */
export interface HasExplosion {
  explosionDamage: number;      // Base damage at epicenter
  explosionRadius: number;      // Radius of effect (used with fieldOfView)
  triggerCondition?: 'on-death' | 'on-fire' | 'manual'; // Default: 'on-death'
}

/**
 * HasDamageable - Entity has damage resistance threshold.
 *
 * Used by:
 * - ExplosionSystem (check minimum damage to apply)
 * - Damage systems (filter weak attacks)
 *
 * Hardness represents a minimum damage threshold that must be met
 * before any damage is applied to the entity. This allows for:
 * - Walls that only break from explosions, not punches
 * - Armored entities immune to weak attacks
 * - Destructible terrain requiring specific tools
 *
 * Damage application logic:
 * - If incoming damage >= hardness: apply full damage
 * - If incoming damage < hardness: apply NO damage
 *
 * Hardness is NOT damage reduction - it's a threshold check.
 *
 * Common hardness values:
 * - Wooden crate: 5 (breaks from most attacks)
 * - Stone wall: 20 (requires explosions or strong attacks)
 * - Reinforced wall: 40 (requires powerful explosions)
 * - Invulnerable (no HasDamageable trait): immune to all damage sources checking hardness
 *
 * @example
 * ```typescript
 * // Destructible wall - immune to weak attacks
 * const wall = {
 *   id: 19,
 *   type: 'destructible-wall',
 *   hp: 50,
 *   maxHp: 50,
 *   hardness: 20,  // Player punch (10 dmg) won't hurt, explosion (30 dmg) will
 *   color: '#8b7355'
 * };
 *
 * // Armored crate - some resistance
 * const crate = {
 *   id: 20,
 *   type: 'crate',
 *   hp: 30,
 *   maxHp: 30,
 *   hardness: 10  // Weak attacks blocked
 * };
 * ```
 */
export interface HasDamageable {
  hardness: number; // Minimum damage required to hurt this entity
}

/**
 * Extending the Trait System
 *
 * Game developers can define their own traits following this pattern:
 *
 * @example
 * ```typescript
 * // Define custom trait
 * export interface HasInventory {
 *   inventory: Map<string, number>;
 * }
 *
 * // Create type guard
 * export function hasInventory(e: EntityData): e is EntityData & HasInventory {
 *   return (e as any).inventory instanceof Map;
 * }
 *
 * // Use in system
 * class InventorySystem implements GameSystem {
 *   update(context: GameContext) {
 *     for (const pos of context.spatial.getAllPositions()) {
 *       const entity = context.spatial.getEntityData(pos.entityId);
 *       if (hasInventory(entity)) {
 *         // Work with inventory
 *       }
 *     }
 *   }
 * }
 * ```
 */
