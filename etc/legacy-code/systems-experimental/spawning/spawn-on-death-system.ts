import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { SpawnOnDeathComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { VelocityComponent } from '@basegrid/ecs';
import { TypeComponent } from '@basegrid/ecs';
import { HealthComponent } from '@basegrid/ecs';

/**
 * Pending spawn for delayed spawning
 */
interface PendingSpawn {
  parent: Entity;
  config: SpawnOnDeathComponent;
  position?: { x: number; y: number; grid: any };
  velocity?: { dx: number; dy: number };
  team?: number;
  remainingCount: number;
  spawnTimer: number;
}

/**
 * Spawn On Death System
 * 
 * Spawns entities when entities die.
 * 
 * Features:
 * - Position inheritance
 * - Velocity inheritance
 * - Random offsets
 * - Spawn delays
 * - Spawn intervals
 * - Spawn probability
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const spawnSystem = new SpawnOnDeathSystem();
 * world.addSystem(spawnSystem);
 * 
 * // Register with GameRulesSystem for auto-triggering
 * const gameRules = world.getSystem(GameRulesSystem);
 * if (gameRules) {
 *   gameRules.onDeath = (entity, killer) => {
 *     spawnSystem.triggerSpawn(entity);
 *     return true; // Allow destruction
 *   };
 * }
 * ```
 */
export class SpawnOnDeathSystem extends System {
  private pendingSpawns: PendingSpawn[] = [];
  
  /**
   * Update spawn on death system
   */
  update(dt: number): void {
    // Process pending spawns
    const toRemove: number[] = [];
    
    for (let i = 0; i < this.pendingSpawns.length; i++) {
      const pending = this.pendingSpawns[i];
      
      pending.spawnTimer -= dt;
      if (pending.spawnTimer <= 0) {
        // Check if spawning all at once or with interval
        const interval = pending.config.spawnInterval ?? 0;
        
        if (interval === 0) {
          // Spawn all remaining entities at once
          const spawnedEntities: Entity[] = [];
          for (let j = 0; j < pending.remainingCount; j++) {
            const spawned = this.spawnEntity(pending);
            if (spawned) {
              spawnedEntities.push(spawned);
            }
          }
          
          // Trigger callback for all spawns
          if (pending.config.onSpawn && spawnedEntities.length > 0) {
            pending.config.onSpawn(pending.parent, spawnedEntities);
          }
          
          toRemove.push(i);
        } else {
          // Spawn one entity
          this.spawnEntity(pending);
          pending.remainingCount--;
          
          // Check if more to spawn
          if (pending.remainingCount <= 0) {
            toRemove.push(i);
          } else {
            // Reset timer for next spawn
            pending.spawnTimer = interval * 1000;
          }
        }
      }
    }
    
    // Remove completed spawns (reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.pendingSpawns.splice(toRemove[i], 1);
    }
  }
  
  /**
   * Trigger spawn on death for entity
   */
  triggerSpawn(entity: Entity): boolean {
    const spawnConfig = this.world.getComponent(entity, SpawnOnDeathComponent);
    if (!spawnConfig) return false;
    
    // Check spawn chance
    if (spawnConfig.spawnChance !== undefined) {
      if (Math.random() > spawnConfig.spawnChance) {
        return false;
      }
    }
    
    // Get entity data for inheritance
    const position = this.world.getComponent(entity, GridPositionComponent);
    const velocity = this.world.getComponent(entity, VelocityComponent);
    const type = this.world.getComponent(entity, TypeComponent);
    
    // Schedule spawn
    const delay = spawnConfig.spawnDelay ?? 0;
    const interval = spawnConfig.spawnInterval ?? 0;
    
    this.pendingSpawns.push({
      parent: entity,
      config: spawnConfig,
      position: position ? { x: position.x, y: position.y, grid: position.grid } : undefined,
      velocity: velocity ? { dx: velocity.dx, dy: velocity.dy } : undefined,
      team: type?.team,
      remainingCount: spawnConfig.count,
      spawnTimer: delay * 1000
    });
    
    return true;
  }
  
  /**
   * Spawn a single entity from pending spawn
   */
  private spawnEntity(pending: PendingSpawn): void {
    const config = pending.config;
    
    // Create entity
    const entity = config.entityFactory();
    
    // Inherit or set position
    if (config.inheritPosition && pending.position) {
      let x = pending.position.x;
      let y = pending.position.y;
      
      // Apply offset
      if (config.offsetRadius) {
        const angle = Math.random() * Math.PI * 2;
        const minRadius = config.minOffsetRadius ?? 0;
        const radius = minRadius + Math.random() * (config.offsetRadius - minRadius);
        x += Math.cos(angle) * radius;
        y += Math.sin(angle) * radius;
      }
      
      const existingPos = this.world.getComponent(entity, GridPositionComponent);
      if (existingPos) {
        existingPos.x = Math.round(x);
        existingPos.y = Math.round(y);
        existingPos.grid = pending.position.grid;
      } else {
        this.world.addComponent(entity, GridPositionComponent, {
          x: Math.round(x),
          y: Math.round(y),
          grid: pending.position.grid
        });
      }
    }
    
    // Inherit or set velocity
    if (config.inheritVelocity && pending.velocity) {
      const multiplier = config.velocityMultiplier ?? 1.0;
      let dx = pending.velocity.dx * multiplier;
      let dy = pending.velocity.dy * multiplier;
      
      // Add random velocity
      if (config.randomVelocity) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * config.randomVelocity;
        dx += Math.cos(angle) * speed;
        dy += Math.sin(angle) * speed;
      }
      
      const existingVel = this.world.getComponent(entity, VelocityComponent);
      if (existingVel) {
        existingVel.dx = dx;
        existingVel.dy = dy;
      } else {
        this.world.addComponent(entity, VelocityComponent, { dx, dy });
      }
    } else if (config.randomVelocity) {
      // Just random velocity
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * config.randomVelocity;
      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed;
      
      this.world.addComponent(entity, VelocityComponent, { dx, dy });
    }
    
    // Inherit team
    if (config.inheritTeam && pending.team !== undefined) {
      const type = this.world.getComponent(entity, TypeComponent);
      if (type) {
        type.team = pending.team;
      }
    }
    
    return entity;
  }
  
  /**
   * Get count of pending spawns
   */
  getPendingSpawnCount(): number {
    return this.pendingSpawns.reduce((sum, p) => sum + p.remainingCount, 0);
  }
  
  /**
   * Clear all pending spawns
   */
  clearPendingSpawns(): void {
    this.pendingSpawns = [];
  }
}
