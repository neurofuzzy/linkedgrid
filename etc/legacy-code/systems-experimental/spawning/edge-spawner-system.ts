import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { EdgeSpawnerComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Edge Spawner System
 * 
 * Manages entity spawning at grid edges.
 * 
 * Features:
 * - Configurable spawn rate
 * - Multiple edge selection
 * - Weighted edge probabilities
 * - Maximum entity limit
 * - Entity factory pattern
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const edgeSpawner = new EdgeSpawnerSystem();
 * world.addSystem(edgeSpawner);
 * 
 * // Create spawner
 * const spawner = world.createEntity();
 * world.addComponent(spawner, EdgeSpawnerComponent, {
 *   grid,
 *   spawnRate: 2.0,
 *   edges: ['top', 'bottom'],
 *   entityFactory: () => {
 *     const enemy = world.createEntity();
 *     world.addComponent(enemy, TypeComponent, { type: 'enemy' });
 *     return enemy;
 *   }
 * });
 * ```
 */
export class EdgeSpawnerSystem extends System {
  /**
   * Update edge spawner system
   */
  update(dt: number): void {
    for (const [spawnerEntity, spawner] of this.world.query(EdgeSpawnerComponent)) {
      // Check if active
      if (spawner.active === false) continue;
      
      // Initialize tracking
      if (!spawner.spawnedEntities) {
        spawner.spawnedEntities = new Set();
      }
      if (spawner.spawnTimer === undefined) {
        spawner.spawnTimer = spawner.spawnRate * 1000; // Convert to ms
      }
      
      // Clean up destroyed entities
      const toRemove: Entity[] = [];
      for (const entity of spawner.spawnedEntities) {
        if (!this.world.hasEntity(entity)) {
          toRemove.push(entity);
        }
      }
      for (const entity of toRemove) {
        spawner.spawnedEntities.delete(entity);
      }
      
      // Check max entities
      if (spawner.maxEntities !== undefined && spawner.spawnedEntities.size >= spawner.maxEntities) {
        continue;
      }
      
      // Update spawn timer
      spawner.spawnTimer -= dt;
      if (spawner.spawnTimer <= 0) {
        this.spawnEntity(spawnerEntity, spawner);
        spawner.spawnTimer = spawner.spawnRate * 1000;
      }
    }
  }
  
  /**
   * Spawn entity at random edge
   */
  private spawnEntity(spawnerEntity: Entity, spawner: EdgeSpawnerComponent): void {
    // Select random edge (weighted if configured)
    const edge = this.selectEdge(spawner);
    if (!edge) return;
    
    // Get spawn position
    const position = this.getEdgePosition(spawner, edge);
    if (!position) return;
    
    // Create entity
    const entity = spawner.entityFactory();
    
    // Add position component
    this.world.addComponent(entity, GridPositionComponent, {
      x: position.x,
      y: position.y,
      grid: spawner.grid
    });
    
    // Track spawned entity
    spawner.spawnedEntities!.add(entity);
    
    // Callback
    if (spawner.onSpawn) {
      spawner.onSpawn(spawnerEntity, entity, edge, position.x, position.y);
    }
  }
  
  /**
   * Select edge to spawn from (with optional weighting)
   */
  private selectEdge(spawner: EdgeSpawnerComponent): string | null {
    if (spawner.edges.length === 0) return null;
    
    // No weighting - uniform random
    if (!spawner.edgeWeights) {
      const index = Math.floor(Math.random() * spawner.edges.length);
      return spawner.edges[index];
    }
    
    // Weighted selection
    const weights: number[] = [];
    let totalWeight = 0;
    
    for (const edge of spawner.edges) {
      const weight = spawner.edgeWeights[edge] ?? 1;
      weights.push(weight);
      totalWeight += weight;
    }
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < spawner.edges.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return spawner.edges[i];
      }
    }
    
    return spawner.edges[0];
  }
  
  /**
   * Get random position along edge
   */
  private getEdgePosition(spawner: EdgeSpawnerComponent, edge: string): { x: number; y: number } | null {
    const offset = spawner.edgeOffset ?? 0;
    const width = spawner.grid.width;
    const height = spawner.grid.height;
    
    switch (edge) {
      case 'top':
        return {
          x: Math.floor(Math.random() * width),
          y: offset
        };
      
      case 'bottom':
        return {
          x: Math.floor(Math.random() * width),
          y: height - 1 - offset
        };
      
      case 'left':
        return {
          x: offset,
          y: Math.floor(Math.random() * height)
        };
      
      case 'right':
        return {
          x: width - 1 - offset,
          y: Math.floor(Math.random() * height)
        };
      
      default:
        return null;
    }
  }
  
  /**
   * Force spawn entity immediately
   */
  forceSpawn(spawnerEntity: Entity): boolean {
    const spawner = this.world.getComponent(spawnerEntity, EdgeSpawnerComponent);
    if (!spawner) return false;
    
    // Initialize tracking
    if (!spawner.spawnedEntities) {
      spawner.spawnedEntities = new Set();
    }
    
    // Check max entities
    if (spawner.maxEntities !== undefined && spawner.spawnedEntities.size >= spawner.maxEntities) {
      return false;
    }
    
    this.spawnEntity(spawnerEntity, spawner);
    return true;
  }
  
  /**
   * Get count of active spawned entities
   */
  getSpawnedCount(spawnerEntity: Entity): number {
    const spawner = this.world.getComponent(spawnerEntity, EdgeSpawnerComponent);
    if (!spawner || !spawner.spawnedEntities) return 0;
    
    // Clean up dead entities
    const alive: Entity[] = [];
    for (const entity of spawner.spawnedEntities) {
      if (this.world.hasEntity(entity)) {
        alive.push(entity);
      }
    }
    
    spawner.spawnedEntities = new Set(alive);
    return alive.length;
  }
  
  /**
   * Clear all spawned entities
   */
  clearSpawned(spawnerEntity: Entity): void {
    const spawner = this.world.getComponent(spawnerEntity, EdgeSpawnerComponent);
    if (!spawner || !spawner.spawnedEntities) return;
    
    for (const entity of spawner.spawnedEntities) {
      if (this.world.hasEntity(entity)) {
        this.world.destroyEntity(entity);
      }
    }
    
    spawner.spawnedEntities.clear();
  }
}
