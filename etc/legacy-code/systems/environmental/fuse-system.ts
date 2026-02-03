import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { FuseComponent } from '@basegrid/gameplay';
import { ExplosiveComponent } from '@basegrid/gameplay';
import { ExplosionComponent } from '@basegrid/gameplay';
import { HealthComponent, VisualComponent, GRID_LAYERS } from '@basegrid/ecs';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Fuse System - Manages fuses, explosives, and chain reactions
 * 
 * Handles explosive mechanics:
 * 1. **Fuse burning**: Lit fuses burn and spread to adjacent fuses
 * 2. **Bomb detonation**: Fuses trigger explosives
 * 3. **Explosions**: Deal damage and trigger chain reactions
 * 4. **Visual effects**: Explosion entities with lifetime
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const fuseSystem = new FuseSystem();
 * world.addSystem(fuseSystem);
 * 
 * // Create fuse path
 * for (let x = 3; x <= 8; x++) {
 *   const fuse = world.createEntity();
 *   world.addComponent(fuse, FuseComponent, {
 *     burnDuration: 30,
 *     state: 'unlit'
 *   });
 *   world.addComponent(fuse, GridPositionComponent, { x, y: 7, grid });
 * }
 * 
 * // Create bomb at end
 * const bomb = world.createEntity();
 * world.addComponent(bomb, ExplosiveComponent, {
 *   explosionRadius: 3,
 *   damage: 50
 * });
 * world.addComponent(bomb, GridPositionComponent, { x: 9, y: 7, grid });
 * 
 * // Light first fuse
 * fuseSystem.lightFuse(firstFuseEntity);
 * 
 * // System handles spreading and detonation
 * world.update(16.67);
 * ```
 */
export class FuseSystem extends System {
  /**
   * Calculate Manhattan distance
   */
  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
  
  /**
   * Light a fuse (external API)
   */
  lightFuse(fuseEntity: Entity): void {
    const fuse = this.world.getComponent(fuseEntity, FuseComponent);
    if (!fuse) return;
    if (fuse.state !== 'unlit') return; // Already lit or burned
    
    fuse.state = 'lit';
    fuse.ticksLit = 0;
  }
  
  /**
   * Update fuse system
   */
  update(_dt: number): void {
    // 1. Process lit fuses (burn and spread)
    this.processLitFuses();
    
    // 2. Check for bomb detonation
    this.checkBombDetonation();
    
    // 3. Update explosion lifetimes
    this.updateExplosions();
  }
  
  /**
   * Process lit fuses
   */
  private processLitFuses(): void {
    const toSpread: Entity[] = [];
    const toBurn: Entity[] = [];
    
    for (const [fuseEntity, fuse] of this.world.query(FuseComponent)) {
      if (fuse.state !== 'lit') continue;
      
      // Initialize counter
      if (fuse.ticksLit === undefined) {
        fuse.ticksLit = 0;
      }
      
      fuse.ticksLit++;
      
      // Check if should burn out
      if (fuse.ticksLit >= fuse.burnDuration) {
        toBurn.push(fuseEntity);
      } else {
        // Still burning, can spread
        toSpread.push(fuseEntity);
      }
    }
    
    // Spread fire to adjacent fuses
    for (const fuseEntity of toSpread) {
      this.spreadFuseToNeighbors(fuseEntity);
    }
    
    // Burn out fuses
    for (const fuseEntity of toBurn) {
      const fuse = this.world.getComponent(fuseEntity, FuseComponent);
      if (fuse) {
        fuse.state = 'burned';
      }
    }
  }
  
  /**
   * Spread fuse to adjacent unlit fuses
   */
  private spreadFuseToNeighbors(fuseEntity: Entity): void {
    const fusePos = this.world.getComponent(fuseEntity, GridPositionComponent);
    if (!fusePos) return;
    
    const cell = fusePos.grid.cell(fusePos.x, fusePos.y);
    if (!cell) return;
    
    const neighbors = cell.neighbors().filter(n => n !== null);
    
    for (const neighbor of neighbors) {
      if (!neighbor) continue;
      
      // Find fuse at neighbor position
      for (const [neighborEntity, neighborFuse] of this.world.query(FuseComponent)) {
        if (neighborFuse.state !== 'unlit') continue;
        
        const neighborPos = this.world.getComponent(neighborEntity, GridPositionComponent);
        if (!neighborPos) continue;
        
        // Check if at neighbor position and same grid
        if (neighborPos.grid !== fusePos.grid) continue;
        if (neighborPos.x !== neighbor.x || neighborPos.y !== neighbor.y) continue;
        
        // Light the fuse
        neighborFuse.state = 'lit';
        neighborFuse.ticksLit = 0;
      }
    }
  }
  
  /**
   * Check if fuses have reached bombs
   */
  private checkBombDetonation(): void {
    const toDetonate: Array<{ bomb: Entity; pos: any }> = [];
    
    for (const [bombEntity, explosive] of this.world.query(ExplosiveComponent)) {
      if (explosive.detonated) continue;
      
      const bombPos = this.world.getComponent(bombEntity, GridPositionComponent);
      if (!bombPos) continue;
      
      // Check if any adjacent cell has a lit fuse
      const cell = bombPos.grid.cell(bombPos.x, bombPos.y);
      if (!cell) continue;
      
      const neighbors = cell.neighbors().filter(n => n !== null);
      let hasLitFuse = false;
      
      for (const neighbor of neighbors) {
        if (!neighbor) continue;
        
        // Check for lit fuse at neighbor
        for (const [_, fuse] of this.world.query(FuseComponent)) {
          if (fuse.state !== 'lit') continue;
          
          const fusePos = this.world.getComponent(_, GridPositionComponent);
          if (!fusePos) continue;
          
          if (fusePos.grid === bombPos.grid && 
              fusePos.x === neighbor.x && 
              fusePos.y === neighbor.y) {
            hasLitFuse = true;
            break;
          }
        }
        
        if (hasLitFuse) break;
      }
      
      // Also check if bomb itself is on fire (direct ignition)
      for (const [fuseEntity, fuse] of this.world.query(FuseComponent)) {
        if (fuse.state !== 'lit') continue;
        
        const fusePos = this.world.getComponent(fuseEntity, GridPositionComponent);
        if (!fusePos) continue;
        
        if (fusePos.grid === bombPos.grid &&
            fusePos.x === bombPos.x &&
            fusePos.y === bombPos.y) {
          hasLitFuse = true;
          break;
        }
      }
      
      if (hasLitFuse) {
        toDetonate.push({ bomb: bombEntity, pos: bombPos });
      }
    }
    
    // Detonate bombs
    for (const { bomb, pos } of toDetonate) {
      this.detonateBomb(bomb, pos);
    }
  }
  
  /**
   * Detonate a bomb
   */
  private detonateBomb(bombEntity: Entity, bombPos: any): void {
    const explosive = this.world.getComponent(bombEntity, ExplosiveComponent);
    if (!explosive || explosive.detonated) return;
    
    explosive.detonated = true;
    
    // Callback
    if (explosive.onDetonate) {
      explosive.onDetonate(bombEntity);
    }
    
    // Create explosion effect - create explosion entities in a circle pattern
    const cell = bombPos.grid.cell(bombPos.x, bombPos.y);
    if (cell) {
      const affected = cell.getCircle(explosive.explosionRadius);
      for (const c of affected) {
        const explosion = this.world.createEntity();
        this.world.addComponent(explosion, ExplosionComponent, {
          lifetime: 10,
          radius: explosive.explosionRadius
        });
        this.world.addComponent(explosion, GridPositionComponent, {
          x: c.x,
          y: c.y,
          grid: bombPos.grid
        });
        // Add VisualComponent - use cellValue 6 which games typically map to 'explosion'
        // Games can override this in their visual systems if needed
        this.world.addComponent(explosion, VisualComponent, {
          cellValue: 6,  // Standard explosion cellValue
          layer: GRID_LAYERS.EPHEMERALS
        });
      }
    }
    
    // Deal damage to entities in radius
    if (explosive.damage) {
      for (const [targetEntity, targetPos] of this.world.query(GridPositionComponent)) {
        if (targetPos.grid !== bombPos.grid) continue;
        
        const distance = this.manhattanDistance(
          targetPos.x,
          targetPos.y,
          bombPos.x,
          bombPos.y
        );
        
        if (distance <= explosive.explosionRadius) {
          const health = this.world.getComponent(targetEntity, HealthComponent);
          if (health) {
            health.current = Math.max(0, health.current - explosive.damage);
          }
        }
      }
    }
    
    // Chain reaction: trigger adjacent bombs by creating lit fuses at their position
    if (explosive.chainReaction !== false) {
      for (const [otherBomb, otherExplosive] of this.world.query(ExplosiveComponent)) {
        if (otherBomb === bombEntity) continue;
        if (otherExplosive.detonated) continue;
        
        const otherPos = this.world.getComponent(otherBomb, GridPositionComponent);
        if (!otherPos || otherPos.grid !== bombPos.grid) continue;
        
        const distance = this.manhattanDistance(
          otherPos.x,
          otherPos.y,
          bombPos.x,
          bombPos.y
        );
        
        if (distance <= explosive.explosionRadius) {
          // Create a virtual lit fuse at the bomb's position to trigger it
          const triggerFuse = this.world.createEntity();
          this.world.addComponent(triggerFuse, FuseComponent, {
            burnDuration: 2,  // Faster chain reactions - just long enough to trigger
            state: 'lit',
            ticksLit: 0
          });
          this.world.addComponent(triggerFuse, GridPositionComponent, {
            x: otherPos.x,
            y: otherPos.y,
            grid: otherPos.grid
          });
        }
      }
    }
    
    // Remove bomb entity
    this.world.destroyEntity(bombEntity);
  }
  
  /**
   * Update explosion lifetimes
   */
  private updateExplosions(): void {
    const toRemove: Entity[] = [];
    
    for (const [entity, explosion] of this.world.query(ExplosionComponent)) {
      explosion.lifetime--;
      
      if (explosion.lifetime <= 0) {
        toRemove.push(entity);
      }
    }
    
    // Remove expired explosions
    for (const entity of toRemove) {
      this.world.destroyEntity(entity);
    }
  }
}
