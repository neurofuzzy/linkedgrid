import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { VirusSpreadingComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent, HealthComponent } from '@basegrid/ecs';
import { getDamageable } from '@basegrid/ecs';

/**
 * Virus Spreading System
 * 
 * Manages infection cascades where entities infect nearby entities.
 * 
 * Features:
 * - Radius-based spreading (not just adjacent)
 * - Infection timer/delay before spreading
 * - Type filtering (only infect matching types)
 * - Optional damage over time
 * - Cure mechanics
 * - Immunity support
 * 
 * Safety mechanisms:
 * - Infected flag prevents re-infection
 * - Timer-based delay prevents instant cascades
 * - Type filtering limits spread
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const virusSystem = new VirusSpreadingSystem();
 * world.addSystem(virusSystem);
 * 
 * // Create susceptible entities
 * for (let x = 0; x < 10; x++) {
 *   const entity = world.createEntity();
 *   world.addComponent(entity, VirusSpreadingComponent, {
 *     infected: false,
 *     infectionDelay: 100,
 *     spreadRadius: 1,
 *     contagious: true,
 *     curable: true
 *   });
 *   world.addComponent(entity, GridPositionComponent, { x, y: 5, grid });
 * }
 * 
 * // Infect patient zero
 * const firstEntity = world.query(VirusSpreadingComponent)[0][0];
 * virusSystem.infectEntity(firstEntity);
 * ```
 */
export class VirusSpreadingSystem extends System {
  /**
   * Update virus spreading
   */
  update(dt: number): void {
    // Update infection timers and spread
    for (const [entity, virus] of this.world.query(VirusSpreadingComponent)) {
      if (!virus.infected) continue;
      
      // Update time infected
      virus.timeInfected = (virus.timeInfected ?? 0) + dt;
      
      // Apply damage over time if specified (happens regardless of contagious)
      if (virus.damagePerTick && virus.damagePerTick > 0) {
        this.applyInfectionDamage(entity, virus.damagePerTick * (dt / 1000));
      }
      
      // Only process spreading if contagious
      if (!virus.contagious) continue;
      
      // Update infection timer
      virus.infectionTimer -= dt;
      
      // When timer expires, spread to neighbors
      if (virus.infectionTimer <= 0) {
        this.spreadInfection(entity, virus);
        
        // Reset timer for continuous spreading
        virus.infectionTimer = virus.infectionDelay;
      }
    }
  }
  
  /**
   * Spread infection from source to nearby entities
   */
  private spreadInfection(sourceEntity: Entity, virus: VirusSpreadingComponent): void {
    const sourcePos = this.world.getComponent(sourceEntity, GridPositionComponent);
    if (!sourcePos) return;
    
    // Find potential targets within radius
    for (const [targetEntity, targetVirus] of this.world.query(VirusSpreadingComponent)) {
      // Skip self
      if (targetEntity === sourceEntity) continue;
      
      // Skip already infected
      if (targetVirus.infected) continue;
      
      // Skip immune
      if (targetVirus.immune) continue;
      
      // Check type filtering
      if (virus.infectType && targetVirus.infectType) {
        if (virus.infectType !== targetVirus.infectType) {
          continue;
        }
      }
      
      // Check position and distance
      const targetPos = this.world.getComponent(targetEntity, GridPositionComponent);
      if (!targetPos || targetPos.grid !== sourcePos.grid) continue;
      
      const distance = Math.abs(targetPos.x - sourcePos.x) + Math.abs(targetPos.y - sourcePos.y);
      
      if (distance <= virus.spreadRadius) {
        // Infect!
        this.infectEntity(targetEntity);
        
        // Fire spread callback
        if (virus.onSpread) {
          virus.onSpread(sourceEntity, targetEntity);
        }
      }
    }
  }
  
  /**
   * Infect an entity
   */
  infectEntity(entity: Entity): void {
    const virus = this.world.getComponent(entity, VirusSpreadingComponent);
    if (!virus) return;
    
    // Skip if already infected or immune
    if (virus.infected || virus.immune) return;
    
    virus.infected = true;
    virus.infectionTimer = virus.infectionDelay;
    virus.timeInfected = 0;
    
    // Fire callback
    if (virus.onInfect) {
      virus.onInfect(entity);
    }
  }
  
  /**
   * Cure an infected entity
   */
  cureEntity(entity: Entity): void {
    const virus = this.world.getComponent(entity, VirusSpreadingComponent);
    if (!virus) return;
    
    // Skip if not infected or not curable
    if (!virus.infected || !virus.curable) return;
    
    virus.infected = false;
    virus.infectionTimer = 0;
    virus.timeInfected = 0;
    
    // Fire callback
    if (virus.onCure) {
      virus.onCure(entity);
    }
  }
  
  /**
   * Apply damage to infected entity
   */
  private applyInfectionDamage(entity: Entity, damage: number): void {
    // Try HealthComponent first
    const health = this.world.getComponent(entity, HealthComponent);
    if (health) {
      health.current = Math.max(0, health.current - damage);
      return;
    }
    
    // Fallback to damageable interface for StructureHealth
    const damageable = getDamageable(this.world, entity);
    if (damageable) {
      damageable.current = Math.max(0, damageable.current - damage);
    }
  }
  
  /**
   * Get count of infected entities
   */
  getInfectedCount(): number {
    let count = 0;
    for (const [_, virus] of this.world.query(VirusSpreadingComponent)) {
      if (virus.infected) count++;
    }
    return count;
  }
  
  /**
   * Get count of entities that can be infected
   */
  getSusceptibleCount(): number {
    let count = 0;
    for (const [_, virus] of this.world.query(VirusSpreadingComponent)) {
      if (!virus.infected && !virus.immune) count++;
    }
    return count;
  }
  
  /**
   * Cure all infected entities
   */
  cureAll(): void {
    for (const [entity, virus] of this.world.query(VirusSpreadingComponent)) {
      if (virus.infected && virus.curable) {
        this.cureEntity(entity);
      }
    }
  }
  
  /**
   * Infect entity at grid position (convenience method for UI/triggers)
   * @returns true if entity was infected, false if no susceptible entity found
   */
  infectAt(x: number, y: number, grid: any): boolean {
    for (const [entity, virus, pos] of this.world.queryMultiple(
      VirusSpreadingComponent,
      GridPositionComponent
    )) {
      if (pos.x === x && pos.y === y && pos.grid === grid) {
        if (!virus.infected && !virus.immune) {
          this.infectEntity(entity);
          return true;
        }
      }
    }
    return false;
  }
}
