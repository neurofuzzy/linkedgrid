import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { SpawnerComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Coordinated Spawning System - Manages synchronized spawner groups
 * 
 * Spawners can work individually or in coordinated groups:
 * - **Solo spawners**: Each spawns on its own timer
 * - **Group spawners**: All spawners in a group spawn simultaneously
 * 
 * Groups are identified by groupId. When a group's timer triggers,
 * ALL spawners in that group spawn at once, creating waves.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const spawningSystem = new CoordinatedSpawningSystem();
 * world.addSystem(spawningSystem);
 * 
 * // Create a group of coordinated spawners
 * const groupId = 'boss-phase-1';
 * for (const pos of [[5, 3], [7, 3], [9, 3]]) {
 *   const spawner = world.createEntity();
 *   world.addComponent(spawner, SpawnerComponent, {
 *     groupId,
 *     spawnInterval: 60,
 *     timer: 60,
 *     entityType: 'minion',
 *     onSpawn: (spawnerEntity, spawnPos) => {
 *       // Create minion at adjacent position
 *       const minion = world.createEntity();
 *       world.addComponent(minion, GridPositionComponent, spawnPos);
 *       return minion;
 *     }
 *   });
 *   world.addComponent(spawner, GridPositionComponent, { x: pos[0], y: pos[1], grid });
 * }
 * 
 * // All 3 spawners spawn minions simultaneously every 60 ticks
 * ```
 */
export class CoordinatedSpawningSystem extends System {
  private groupTimers: Map<string, number> = new Map();
  private groupModes: Map<string, { mode: string, currentIndex: number, direction: number }> = new Map();
  
  /**
   * Clean up group timers on init
   */
  onInit() {
    this.groupTimers.clear();
    this.groupModes.clear();
  }
  
  /**
   * Update spawning system
   */
  update(_dt: number): void {
    // Group spawners by groupId
    const groups = new Map<string, Entity[]>();
    const soloSpawners: Entity[] = [];
    
    for (const [entity, spawner] of this.world.query(SpawnerComponent)) {
      if (spawner.active === false) continue;
      
      if (spawner.groupId) {
        if (!groups.has(spawner.groupId)) {
          groups.set(spawner.groupId, []);
        }
        groups.get(spawner.groupId)!.push(entity);
      } else {
        soloSpawners.push(entity);
      }
    }
    
    // Update group spawners
    for (const [groupId, spawners] of groups) {
      this.updateGroup(groupId, spawners);
    }
    
    // Update solo spawners
    for (const entity of soloSpawners) {
      this.updateSoloSpawner(entity);
    }
  }
  
  /**
   * Update a group of coordinated spawners
   */
  private updateGroup(groupId: string, spawners: Entity[]): void {
    if (spawners.length === 0) return;
    
    // Get or initialize group timer
    if (!this.groupTimers.has(groupId)) {
      const firstSpawner = this.world.getComponent(spawners[0], SpawnerComponent);
      // Use the spawner's timer value for initial delay, not spawnInterval
      this.groupTimers.set(groupId, firstSpawner?.timer ?? firstSpawner?.spawnInterval ?? 60);
    }
    
    let groupTimer = this.groupTimers.get(groupId)!;
    groupTimer--;
    
    // Check if group should spawn (only on exact tick when timer reaches 0)
    if (groupTimer === 0) {
      const firstSpawner = this.world.getComponent(spawners[0], SpawnerComponent);
      const mode = firstSpawner?.coordinationMode || 'synchronized';
      
      if (mode === 'synchronized') {
        // Spawn from all spawners simultaneously
        for (const entity of spawners) {
          this.spawnFrom(entity);
        }
      } else if (mode === 'sequential') {
        // Get or initialize mode state
        if (!this.groupModes.has(groupId)) {
          this.groupModes.set(groupId, { mode: 'sequential', currentIndex: 0, direction: 1 });
        }
        const modeState = this.groupModes.get(groupId)!;
        
        // Find spawner at current index
        const spawnerAtIndex = spawners.find(entity => {
          const spawner = this.world.getComponent(entity, SpawnerComponent);
          return spawner?.spawnIndex === modeState.currentIndex;
        });
        
        if (spawnerAtIndex) {
          this.spawnFrom(spawnerAtIndex);
        }
        
        // Advance to next index (cycle)
        modeState.currentIndex = (modeState.currentIndex + 1) % spawners.length;
      } else if (mode === 'yoyo') {
        // Get or initialize mode state
        if (!this.groupModes.has(groupId)) {
          this.groupModes.set(groupId, { mode: 'yoyo', currentIndex: 0, direction: 1 });
        }
        const modeState = this.groupModes.get(groupId)!;
        
        // Find spawner at current index
        const spawnerAtIndex = spawners.find(entity => {
          const spawner = this.world.getComponent(entity, SpawnerComponent);
          return spawner?.spawnIndex === modeState.currentIndex;
        });
        
        if (spawnerAtIndex) {
          this.spawnFrom(spawnerAtIndex);
        }
        
        // Advance with direction (yoyo)
        modeState.currentIndex += modeState.direction;
        
        // Reverse direction at endpoints
        if (modeState.currentIndex >= spawners.length - 1) {
          modeState.direction = -1;
        } else if (modeState.currentIndex <= 0) {
          modeState.direction = 1;
        }
      }
      
      // Reset group timer
      groupTimer = firstSpawner?.spawnInterval ?? 60;
    }
    
    this.groupTimers.set(groupId, groupTimer);
    
    // Update cooldowns for all spawners in group
    for (const entity of spawners) {
      this.updateCooldown(entity);
    }
  }
  
  /**
   * Update a solo spawner
   */
  private updateSoloSpawner(entity: Entity): void {
    const spawner = this.world.getComponent(entity, SpawnerComponent);
    if (!spawner) return;
    
    // Update cooldown
    this.updateCooldown(entity);
    
    // Don't spawn during cooldown
    if ((spawner.cooldownTimer ?? 0) > 0) return;
    
    // Decrement timer
    spawner.timer--;
    
    // Check if should spawn
    if (spawner.timer <= 0) {
      this.spawnFrom(entity);
      spawner.timer = spawner.spawnInterval;
    }
  }
  
  /**
   * Update cooldown for a spawner
   */
  private updateCooldown(entity: Entity): void {
    const spawner = this.world.getComponent(entity, SpawnerComponent);
    if (!spawner) return;
    
    if ((spawner.cooldownTimer ?? 0) > 0) {
      spawner.cooldownTimer = (spawner.cooldownTimer ?? 0) - 1;
    }
  }
  
  /**
   * Spawn from a spawner
   */
  private spawnFrom(entity: Entity): void {
    const spawner = this.world.getComponent(entity, SpawnerComponent);
    const pos = this.world.getComponent(entity, GridPositionComponent);
    
    if (!spawner || !pos) return;
    
    // Check canSpawn condition
    if (spawner.canSpawn && !spawner.canSpawn(entity)) {
      return; // Condition not met, don't spawn
    }
    
    // Initialize spawn count
    if (spawner.spawnCount === undefined) {
      spawner.spawnCount = 0;
    }
    
    // Check max spawns
    if (spawner.maxSpawns !== undefined && spawner.spawnCount >= spawner.maxSpawns) {
      return; // Reached max spawns
    }
    
    // Find empty adjacent cell to spawn in
    const cell = pos.grid.cell(pos.x, pos.y);
    if (!cell) return;
    
    const neighbors = cell.neighbors().filter(n => n !== null);
    
    // Try to find empty neighbor
    for (const neighbor of neighbors) {
      if (!neighbor) continue;
      
      // Check if position is empty (no other entity there)
      let occupied = false;
      for (const [_, otherPos] of this.world.query(GridPositionComponent)) {
        if (otherPos.grid === pos.grid &&
            otherPos.x === neighbor.x &&
            otherPos.y === neighbor.y) {
          occupied = true;
          break;
        }
      }
      
      if (!occupied) {
        // Spawn here
        const spawnedEntity = this.world.createEntity();
        const spawnPos = {
          x: neighbor.x,
          y: neighbor.y,
          grid: pos.grid
        };
        this.world.addComponent(spawnedEntity, GridPositionComponent, spawnPos);
        
        // Call onSpawn callback to configure entity
        if (spawner.onSpawn) {
          spawner.onSpawn(spawnedEntity, spawnPos);
        }
        
        // Increment spawn count
        spawner.spawnCount = (spawner.spawnCount ?? 0) + 1;
        
        // Set cooldown
        if (spawner.cooldownDuration) {
          spawner.cooldownTimer = spawner.cooldownDuration;
        }
        
        break; // Only spawn one entity per spawner per trigger
      }
    }
  }
  
  /**
   * Clean up group timers
   */
  onCleanup() {
    this.groupTimers.clear();
    this.groupModes.clear();
  }
}
