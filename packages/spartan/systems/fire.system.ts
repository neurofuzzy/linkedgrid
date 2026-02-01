import { BaseTickedSystem } from '../core/base-system';
import { SYSTEM_CONFIG } from '../config/systems.config';
import type { GameContext } from '../core/types';
import { hasTemperature, hasHealth, hasExplosion } from '../traits/trait-guards';
import { GameLayers } from "../config/layers.config";
import { Direction } from '../core/grid/direction';

interface BurningEntity {
  lastDamageTick: number;
  visualEffectId?: number;
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
 * @system
 * @reactsTo Entities with HasTemperature trait reaching flamePoint
 * @modifies Entity temperature, HP; spawns fire-visual, ash entities
 *
 * Behavior:
 * - Detects ignitions when temperature >= flamePoint
 * - Spreads heat to 4-directional neighbors
 * - Applies damage on cadence to flammable burning entities
 * - Spawns ash on FLOOR_EFFECTS when entity burns out
 * - Decays temperature on non-burning entities
 *
 * @example
 * ```typescript
 * const fireSystem = new FireSystem();
 * gameLoop.addSystem(fireSystem);
 * ```
 */
export class FireSystem extends BaseTickedSystem {
  private burningEntities = new Map<number, BurningEntity>();

  protected tickRate = SYSTEM_CONFIG.Fire.tickRate;

  private readonly FIRE_DAMAGE_RATE = 5;
  private readonly FIRE_DAMAGE_CADENCE = 2;
  private readonly TEMPERATURE_INCREASE = 50;
  private readonly TEMPERATURE_DECAY = 10;

  protected onTick(context: GameContext): void {
    this.detectIgnitions(context);
    this.spreadFire(context);
    this.applyFireDamage(context);
    this.cleanupBurnedEntities(context);
    this.applyTemperatureDecay(context);
  }

  private detectIgnitions(context: GameContext): void {
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasTemperature(entityData)) continue;
      if (this.burningEntities.has(entityId)) continue;

      if (entityData.temperature >= entityData.flamePoint) {
        this.burningEntities.set(entityId, {
          lastDamageTick: this.currentTick,
          visualEffectId: undefined,
        });

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

  private spreadFire(context: GameContext): void {
    // Two-phase update: calculate all temperature deltas first, then apply
    const temperatureDeltas = new Map<number, number>();

    for (const entityId of this.burningEntities.keys()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const pos = context.spatial.getEntityPosition(entityId);
      if (!pos) continue;

      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
        const neighbor = cell.neighbor(dir);
        if (!neighbor) continue;

        const layers = [GameLayers.FLOOR, GameLayers.COLLECTIBLES, GameLayers.WALLS, GameLayers.ACTORS];
        for (const layer of layers) {
          const neighborId = context.spatial.getEntityIdAt(neighbor.x, neighbor.y, layer);
          if (neighborId === undefined) continue;

          const neighborData = context.spatial.getEntityData(neighborId);
          if (!neighborData || !hasTemperature(neighborData)) continue;

          // Store the intended temperature increase in a temporary map
          const currentDelta = temperatureDeltas.get(neighborId) || 0;
          temperatureDeltas.set(neighborId, currentDelta + this.TEMPERATURE_INCREASE);
        }
      }
    }

    // Apply all calculated temperature changes at once
    for (const [entityId, delta] of temperatureDeltas.entries()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (entityData && hasTemperature(entityData)) {
        entityData.temperature = Math.min(
          entityData.temperature + delta,
          entityData.flamePoint + 100
        );
      }
    }
  }

  private applyFireDamage(context: GameContext): void {
    for (const [entityId, burnState] of this.burningEntities.entries()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasHealth(entityData)) continue;

      if (!entityData.flammable) continue;

      const ticksSinceLastDamage = this.currentTick - burnState.lastDamageTick;
      if (ticksSinceLastDamage < this.FIRE_DAMAGE_CADENCE) continue;

      entityData.hp = Math.max(0, entityData.hp - this.FIRE_DAMAGE_RATE);
      burnState.lastDamageTick = this.currentTick;
    }
  }

  private cleanupBurnedEntities(context: GameContext): void {
    const entitiesToRemove: number[] = [];

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

      if (hasHealth(entityData) && entityData.hp <= 0) {
        const pos = posMap.get(entityId);

        if (hasExplosion(entityData)) {
          continue;
        }

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

    for (const entityId of entitiesToRemove) {
      const burnState = this.burningEntities.get(entityId);
      if (burnState?.visualEffectId !== undefined) {
        context.spatial.remove(burnState.visualEffectId);
      }
      this.burningEntities.delete(entityId);
    }
  }

  private applyTemperatureDecay(context: GameContext): void {
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasTemperature(entityData)) continue;
      if (this.burningEntities.has(entityId)) continue;

      entityData.temperature = Math.max(0, entityData.temperature - this.TEMPERATURE_DECAY);
    }
  }

  public ignite(context: GameContext, entityId: number): void {
    const entityData = context.spatial.getEntityData(entityId);
    if (!entityData || !hasTemperature(entityData)) return;

    entityData.temperature = entityData.flamePoint + 50;
  }

  public override resetState(): void {
    super.resetState();
    this.burningEntities.clear();
  }
}