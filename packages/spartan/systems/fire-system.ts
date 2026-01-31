import type { GameSystem, GameContext } from '../types';
import { hasTemperature, hasHealth, hasExplosion } from '../entities/trait-guards';
import { GameLayers } from '../layers/types';
import { Direction } from '../../grid/direction';

/**
 * Fire state for burning entities.
 * System-owned state (not serialized in entity data).
 */
interface BurningEntity {
  lastDamageTick: number;  // Last tick fire damage was applied
  visualEffectId?: number; // ID of fire visual on EPHEMERALS layer
}

/**
 * FireSystem - Manages fire spread and burning entities.
 *
 * Fire mechanics:
 * - Fire is a state, not an entity
 * - Entities with temperature >= flamePoint are "on fire"
 * - Fire spreads by raising temperature of adjacent entities
 * - Fire reduces HP over time (damage every N ticks)
 * - Non-explosive entities spawn ash when burned out
 * - Visual effects rendered on EPHEMERALS layer
 *
 * Processing phases:
 * 1. Detect ignitions (temperature >= flamePoint)
 * 2. Spread fire (raise adjacent entity temperatures)
 * 3. Apply fire damage (reduce HP)
 * 4. Clean up burned entities (spawn ash, remove visuals)
 *
 * Constants:
 * - FIRE_SPREAD_RATE: 1 (spread every tick)
 * - FIRE_DAMAGE_RATE: 5 HP per tick
 * - FIRE_DAMAGE_CADENCE: 2 ticks between damage
 * - TEMPERATURE_INCREASE: 50 per adjacent burning entity
 * - TEMPERATURE_DECAY: 10 per tick (cools down when not near fire)
 */
export class FireSystem implements GameSystem {
  // Entities currently on fire
  private burningEntities = new Map<number, BurningEntity>();
  
  // Track current tick
  private currentTick = 0;
  
  // Constants
  private readonly FIRE_DAMAGE_RATE = 5;
  private readonly FIRE_DAMAGE_CADENCE = 2;
  private readonly TEMPERATURE_INCREASE = 50;
  private readonly TEMPERATURE_DECAY = 10;

  update(context: GameContext): void {
    this.currentTick++;
    
    // Phase 1: Detect new ignitions
    this.detectIgnitions(context);
    
    // Phase 2: Spread fire via temperature
    this.spreadFire(context);
    
    // Phase 3: Apply fire damage
    this.applyFireDamage(context);
    
    // Phase 4: Clean up burned entities
    this.cleanupBurnedEntities(context);
    
    // Phase 5: Cool down entities not near fire
    this.applyTemperatureDecay(context);
  }
  
  /**
   * Detect entities that have reached their flame point.
   */
  private detectIgnitions(context: GameContext): void {
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasTemperature(entityData)) continue;
      if (this.burningEntities.has(entityId)) continue; // Already burning
      
      // Check if ignited (or just hot enough to radiate)
      // We treat anything > flamePoint as "active heat source"
      if (entityData.temperature >= entityData.flamePoint) {
        // Entity is now on fire (or radiating heat)
        this.burningEntities.set(entityId, {
          lastDamageTick: this.currentTick,
          visualEffectId: undefined,
        });
        
        // Only spawn visual effect if flammable (otherwise it's just hot, or has its own visual like torch)
        if (entityData.flammable) {
          const visualId = context.spatial.spawn('fire-visual', pos.x, pos.y, GameLayers.EPHEMERALS, {
            color: '#ff4500',
          });
          const burnState = this.burningEntities.get(entityId);
          if (burnState) {
            burnState.visualEffectId = visualId;
          }
        }
      }
    }
  }
  
  /**
   * Spread fire by raising temperature of adjacent entities.
   */
  private spreadFire(context: GameContext): void {
    // Build position map for burning entities
    const posMap = new Map<number, { x: number; y: number; layer: number }>();
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      if (this.burningEntities.has(entityId)) {
        posMap.set(entityId, pos);
      }
    }
    
    // For each burning entity, raise temperature of 4-neighbors
    for (const entityId of this.burningEntities.keys()) {
      if (!context.spatial.isAlive(entityId)) continue;
      
      const pos = posMap.get(entityId);
      if (!pos) continue;
      
      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;
      
      // Check 4 neighbors
      for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
        const neighbor = cell.neighbor(dir);
        if (!neighbor) continue;
        
        // Check for entities with temperature trait on multiple layers
        const layers = [GameLayers.FLOOR, GameLayers.COLLECTIBLES, GameLayers.WALLS, GameLayers.ACTORS];
        for (const layer of layers) {
          const neighborId = context.spatial.getEntityIdAt(neighbor.x, neighbor.y, layer);
          if (neighborId === undefined) continue;
          
          const neighborData = context.spatial.getEntityData(neighborId);
          if (!neighborData || !hasTemperature(neighborData)) continue;
          
          // Raise temperature
          neighborData.temperature = Math.min(
            neighborData.temperature + this.TEMPERATURE_INCREASE,
            neighborData.flamePoint + 100 // Cap max temperature
          );
        }
      }
    }
  }
  
  /**
   * Apply damage to burning entities.
   */
  private applyFireDamage(context: GameContext): void {
    for (const [entityId, burnState] of this.burningEntities.entries()) {
      if (!context.spatial.isAlive(entityId)) continue;
      
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasHealth(entityData)) continue;
      
      if (!entityData.flammable) continue; // Don't damage non-flammable sources

      // Check cadence
      const ticksSinceLastDamage = this.currentTick - burnState.lastDamageTick;
      if (ticksSinceLastDamage < this.FIRE_DAMAGE_CADENCE) continue;
      
      // Apply damage
      entityData.hp = Math.max(0, entityData.hp - this.FIRE_DAMAGE_RATE);
      burnState.lastDamageTick = this.currentTick;
    }
  }
  
  /**
   * Clean up entities that have burned out (HP = 0).
   */
  private cleanupBurnedEntities(context: GameContext): void {
    const entitiesToRemove: number[] = [];
    
    // Build position map for burning entities
    const posMap = new Map<number, { x: number; y: number; layer: number }>();
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      if (this.burningEntities.has(entityId)) {
        posMap.set(entityId, pos);
      }
    }
    
    for (const entityId of this.burningEntities.keys()) {
      if (!context.spatial.isAlive(entityId)) {
        entitiesToRemove.push(entityId);
        continue;
      }
      
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData) {
        entitiesToRemove.push(entityId);
        continue;
      }
      
      // Check if HP = 0
      if (hasHealth(entityData) && entityData.hp <= 0) {
        const pos = posMap.get(entityId);
        
        // If explosive, leave at HP=0 for ExplosionSystem to handle
        if (hasExplosion(entityData)) {
          // Keep in burning list (visual will be cleaned up after explosion)
          continue;
        }
        
        // Non-explosive: spawn ash and remove entity
        if (pos) {
          context.spatial.spawn('ash', pos.x, pos.y, GameLayers.FLOOR_EFFECTS, {
            color: '#3d3d3d',
          });
        }
        
         
        
         context.spatial.remove(entityId);
        
         entitiesToRemove.push(entityId);
        
         continue;
        
       }
        
     }    
    // Clean up tracking state and visuals
    for (const entityId of entitiesToRemove) {
      const burnState = this.burningEntities.get(entityId);
      if (burnState?.visualEffectId !== undefined) {
        context.spatial.remove(burnState.visualEffectId);
      }
      this.burningEntities.delete(entityId);
    }
  }
  
  /**
   * Apply temperature decay to entities not near fire.
   */
  private applyTemperatureDecay(context: GameContext): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasTemperature(entityData)) continue;
      if (this.burningEntities.has(entityId)) continue; // Don't cool burning entities
      
      // Cool down
      entityData.temperature = Math.max(0, entityData.temperature - this.TEMPERATURE_DECAY);
    }
  }
  
  /**
   * Public API: Ignite an entity by raising its temperature.
   * Used by ExplosionSystem to ignite entities.
   */
  public ignite(context: GameContext, entityId: number): void {
    const entityData = context.spatial.getEntityData(entityId);
    if (!entityData || !hasTemperature(entityData)) return;
    
    // Raise temperature to flame point + buffer
    entityData.temperature = entityData.flamePoint + 50;
  }
  
  /**
   * Reset system state (for testing/scene transitions).
   */
  public resetState(): void {
    this.burningEntities.clear();
    this.currentTick = 0;
  }
}
