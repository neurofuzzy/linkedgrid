import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { WaveSpawnerComponent, type WaveConfig } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Wave Spawner System
 * 
 * Manages wave-based entity spawning.
 * 
 * Features:
 * - Multiple wave configurations
 * - Spawn delays within waves
 * - Wave start delays
 * - Auto-start and looping
 * - Wait for wave clear
 * - Position providers
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const waveSystem = new WaveSpawnerSystem();
 * world.addSystem(waveSystem);
 * 
 * // Create tower defense waves
 * const spawner = world.createEntity();
 * world.addComponent(spawner, WaveSpawnerComponent, {
 *   waves: [
 *     { count: 5, entityFactory: () => createEnemy('grunt'), spawnDelay: 1.0 },
 *     { count: 1, entityFactory: () => createEnemy('boss'), startDelay: 3.0 }
 *   ],
 *   autoStart: true
 * });
 * ```
 */
export class WaveSpawnerSystem extends System {
  /**
   * Update wave spawner system
   */
  update(dt: number): void {
    for (const [spawnerEntity, spawner] of this.world.query(WaveSpawnerComponent)) {
      // Initialize
      if (spawner.currentWave === undefined) {
        spawner.currentWave = spawner.autoStart ? 0 : -1;
        spawner.currentWaveSpawned = 0;
        spawner.spawnedEntities = new Set();
      }
      
      // Check if active
      if (spawner.active === false || spawner.currentWave < 0) continue;
      
      // Check if all waves complete
      if (spawner.currentWave >= spawner.waves.length) {
        if (spawner.loop) {
          spawner.currentWave = 0;
          spawner.currentWaveSpawned = 0;
        } else {
          continue;
        }
      }
      
      const wave = spawner.waves[spawner.currentWave];
      
      // Clean up dead entities
      if (spawner.spawnedEntities) {
        const alive = new Set<Entity>();
        for (const entity of spawner.spawnedEntities) {
          if (this.world.hasEntity(entity)) {
            alive.add(entity);
          }
        }
        spawner.spawnedEntities = alive;
      }
      
      // Wait for wave clear
      if (spawner.waitForClear && spawner.spawnedEntities && spawner.spawnedEntities.size > 0) {
        continue;
      }
      
      // Handle wave start delay
      if (spawner.waveStartTimer !== undefined) {
        spawner.waveStartTimer -= dt;
        if (spawner.waveStartTimer <= 0) {
          spawner.waveStartTimer = undefined;
          
          if (spawner.onWaveStart) {
            spawner.onWaveStart(spawnerEntity, spawner.currentWave, wave);
          }
        } else {
          continue;
        }
      } else if (wave.startDelay && spawner.currentWaveSpawned === 0) {
        spawner.waveStartTimer = wave.startDelay * 1000;
        continue;
      }
      
      // Initialize spawn timer for immediate first spawn
      if (spawner.spawnTimer === undefined) {
        spawner.spawnTimer = 0; // Spawn immediately
        
        if (spawner.currentWaveSpawned === 0 && spawner.waveStartTimer === undefined && spawner.onWaveStart) {
          spawner.onWaveStart(spawnerEntity, spawner.currentWave, wave);
        }
      }
      
      // Check if wave complete
      if (spawner.currentWaveSpawned! >= wave.count) {
        this.completeWave(spawnerEntity, spawner);
        continue;
      }
      
      // Update spawn timer
      spawner.spawnTimer -= dt;
      if (spawner.spawnTimer <= 0) {
        // Spawn entity
        this.spawnEntity(spawnerEntity, spawner, wave);
        
        // Set next spawn delay
        const delay = wave.spawnDelay ?? 0;
        spawner.spawnTimer = delay * 1000;
      }
    }
  }
  
  /**
   * Spawn entity for current wave
   */
  private spawnEntity(spawnerEntity: Entity, spawner: WaveSpawnerComponent, wave: WaveConfig): void {
    // Create entity
    const entity = wave.entityFactory();
    
    // Add position if provider exists
    if (spawner.positionProvider) {
      const pos = spawner.positionProvider();
      // Assume grid is available in context or entity already has position
      const existingPos = this.world.getComponent(entity, GridPositionComponent);
      if (existingPos) {
        existingPos.x = pos.x;
        existingPos.y = pos.y;
      }
    }
    
    // Track entity
    if (!spawner.spawnedEntities) {
      spawner.spawnedEntities = new Set();
    }
    spawner.spawnedEntities.add(entity);
    
    // Increment count
    spawner.currentWaveSpawned = (spawner.currentWaveSpawned ?? 0) + 1;
    
    // Callback
    if (spawner.onSpawn) {
      spawner.onSpawn(spawnerEntity, entity, spawner.currentWave!);
    }
  }
  
  /**
   * Complete current wave
   */
  private completeWave(spawnerEntity: Entity, spawner: WaveSpawnerComponent): void {
    const wave = spawner.waves[spawner.currentWave!];
    
    // Callback
    if (spawner.onWaveComplete) {
      spawner.onWaveComplete(spawnerEntity, spawner.currentWave!, wave);
    }
    
    // Move to next wave
    spawner.currentWave! += 1;
    spawner.currentWaveSpawned = 0;
    spawner.spawnTimer = undefined;
    spawner.waveStartTimer = undefined;
    
    // Check if all waves complete
    if (spawner.currentWave! >= spawner.waves.length) {
      if (spawner.onAllWavesComplete) {
        spawner.onAllWavesComplete(spawnerEntity);
      }
      
      if (!spawner.loop) {
        spawner.active = false;
      }
    }
  }
  
  /**
   * Start spawning waves
   */
  startWaves(spawnerEntity: Entity): boolean {
    const spawner = this.world.getComponent(spawnerEntity, WaveSpawnerComponent);
    if (!spawner) return false;
    
    spawner.currentWave = 0;
    spawner.currentWaveSpawned = 0;
    spawner.active = true;
    spawner.spawnTimer = undefined;
    spawner.waveStartTimer = undefined;
    
    return true;
  }
  
  /**
   * Stop spawning waves
   */
  stopWaves(spawnerEntity: Entity): void {
    const spawner = this.world.getComponent(spawnerEntity, WaveSpawnerComponent);
    if (spawner) {
      spawner.active = false;
    }
  }
  
  /**
   * Skip to next wave
   */
  nextWave(spawnerEntity: Entity): boolean {
    const spawner = this.world.getComponent(spawnerEntity, WaveSpawnerComponent);
    if (!spawner) return false;
    
    if (spawner.currentWave === undefined || spawner.currentWave >= spawner.waves.length - 1) {
      return false;
    }
    
    this.completeWave(spawnerEntity, spawner);
    return true;
  }
  
  /**
   * Get current wave index
   */
  getCurrentWave(spawnerEntity: Entity): number {
    const spawner = this.world.getComponent(spawnerEntity, WaveSpawnerComponent);
    return spawner?.currentWave ?? -1;
  }
  
  /**
   * Get total number of waves
   */
  getTotalWaves(spawnerEntity: Entity): number {
    const spawner = this.world.getComponent(spawnerEntity, WaveSpawnerComponent);
    return spawner?.waves.length ?? 0;
  }
  
  /**
   * Check if all waves complete
   */
  isComplete(spawnerEntity: Entity): boolean {
    const spawner = this.world.getComponent(spawnerEntity, WaveSpawnerComponent);
    if (!spawner) return false;
    
    return (spawner.currentWave ?? 0) >= spawner.waves.length && !spawner.loop;
  }
  
  /**
   * Get spawned entity count for current wave
   */
  getSpawnedCount(spawnerEntity: Entity): number {
    const spawner = this.world.getComponent(spawnerEntity, WaveSpawnerComponent);
    if (!spawner || !spawner.spawnedEntities) return 0;
    
    // Clean up dead entities
    const alive: Entity[] = [];
    for (const entity of spawner.spawnedEntities) {
      if (this.world.hasEntity(entity)) {
        alive.push(entity);
      }
    }
    
    return alive.length;
  }
}
