/**
 * Conditional Spawner System
 * 
 * Manages conditional spawning based on game state.
 * Extends basic spawning with condition checking.
 */

import { System } from '@basegrid/ecs';
import { ConditionalSpawnerComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import type { SpawnCondition } from '@basegrid/gameplay';

export class ConditionalSpawnerSystem extends System {
  /**
   * Check if a condition is met
   */
  private checkCondition(spawnerEntity: Entity, condition: SpawnCondition): boolean {
    switch (condition.type) {
      case 'entity_count': {
        if (!condition.tags || !condition.operator || condition.threshold === undefined) {
          return false;
        }

        // Count entities with matching tags
        let count = 0;
        for (const [_] of this.world.query(TypeComponent)) {
          const type = this.world.getComponent(_, TypeComponent);
          if (!type) continue;

          const hasMatchingTag = type.tags.some(tag => condition.tags!.includes(tag));
          if (hasMatchingTag) {
            count++;
          }
        }

        // Compare with threshold
        switch (condition.operator) {
          case '<': return count < condition.threshold;
          case '>': return count > condition.threshold;
          case '==': return count === condition.threshold;
          case '<=': return count <= condition.threshold;
          case '>=': return count >= condition.threshold;
          default: return false;
        }
      }

      case 'timer': {
        if (condition.elapsed === undefined || condition.threshold === undefined) {
          return false;
        }
        return condition.elapsed >= condition.threshold;
      }

      case 'custom': {
        if (!condition.check) {
          return false;
        }
        return condition.check(spawnerEntity);
      }

      default:
        return false;
    }
  }

  /**
   * Check if all conditions are met for spawning
   */
  private shouldSpawn(spawnerEntity: Entity, spawner: ConditionalSpawnerComponent): boolean {
    if (spawner.conditions.length === 0) {
      return true; // No conditions = always spawn
    }

    const results = spawner.conditions.map(condition => 
      this.checkCondition(spawnerEntity, condition)
    );

    if (spawner.requireAll) {
      // AND logic - all must be true
      return results.every(r => r);
    } else {
      // OR logic - at least one must be true
      return results.some(r => r);
    }
  }

  /**
   * Spawn an entity from this conditional spawner
   */
  private spawn(spawnerEntity: Entity, spawner: ConditionalSpawnerComponent): void {
    const spawnerPos = this.world.getComponent(spawnerEntity, GridPositionComponent);
    if (!spawnerPos) return;

    // Create new entity at spawner position
    const entity = this.world.createEntity();
    
    // Add position (same as spawner for now, could add offset logic)
    this.world.addComponent(entity, GridPositionComponent, {
      grid: spawnerPos.grid,
      x: spawnerPos.x,
      y: spawnerPos.y
    });

    // Add type tag if specified
    if (spawner.spawnEntityType) {
      this.world.addComponent(entity, TypeComponent, {
        tags: [spawner.spawnEntityType]
      });
    }

    // Increment spawn count
    spawner.spawnCount = (spawner.spawnCount ?? 0) + 1;

    // Callback
    if (spawner.onSpawn) {
      spawner.onSpawn(entity, spawnerEntity);
    }
  }

  update(_dt: number): void {
    for (const [spawnerEntity, spawner] of this.world.query(ConditionalSpawnerComponent)) {
      // Handle check cooldown
      if (spawner.checkCooldown !== undefined) {
        if (spawner.checkTimer === undefined) {
          spawner.checkTimer = 0;
        }

        if (spawner.checkTimer > 0) {
          spawner.checkTimer--;
          continue;
        }
      }

      // Update timer conditions
      for (const condition of spawner.conditions) {
        if (condition.type === 'timer') {
          if (condition.elapsed === undefined) {
            condition.elapsed = 0;
          }
          condition.elapsed++;
        }
      }

      // Check conditions
      if (this.shouldSpawn(spawnerEntity, spawner)) {
        // Check max spawns
        if (spawner.maxSpawns !== undefined) {
          const currentSpawns = spawner.spawnCount ?? 0;
          if (currentSpawns >= spawner.maxSpawns) {
            continue;
          }
        }

        // Spawn!
        this.spawn(spawnerEntity, spawner);

        // Reset check cooldown
        if (spawner.checkCooldown !== undefined) {
          spawner.checkTimer = spawner.checkCooldown;
        }

        // Reset timer conditions if not repeatable
        if (!spawner.repeatable) {
          for (const condition of spawner.conditions) {
            if (condition.type === 'timer') {
              condition.elapsed = 0;
            }
          }
        }
      }
    }
  }
}
