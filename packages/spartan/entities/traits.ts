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
