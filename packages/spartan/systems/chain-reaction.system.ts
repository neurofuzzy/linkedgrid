/**
 * @brief Handles explosive chain reactions.
 */
import { BaseTickedSystem } from '../core/base-system';
import { SYSTEM_CONFIG } from '../config/systems.config';
import type { GameContext, Position } from '../core/types';
import type { BaseEntityData } from '../entities/entity.types';
import { Direction } from '../core/grid/direction';
import type { LinkedCell } from '../core/grid/linked-cell';
import type { EntityData } from '../entities/entity.types';
import { hasPropagation } from '../traits/trait-guards';

/**
 * Properties required for chain reaction propagation.
 */
interface ChainConfigProps {
  spreadRate: number;
  spreadLayer: number;
  spreadType: string;
  maxDistance?: number;
  lifetime?: number;
  blockedByLayers?: number[];
}

/**
 * Type guard for ChainConfig.
 * Checks propagationType === 'chain' and required config properties.
 */
function isChainConfig(data: EntityData): data is EntityData & ChainConfigProps & { propagationType: 'chain' } {
  return (
    'propagationType' in data && data.propagationType === 'chain' &&
    'spreadRate' in data && typeof data.spreadRate === 'number' &&
    'spreadLayer' in data && typeof data.spreadLayer === 'number' &&
    'spreadType' in data && typeof data.spreadType === 'string'
  );
}

interface ChainState {
  lastSpreadTick: number;
  spawnTick: number;
}

interface PropagatedEntity {
  sourceId: number;
  distance: number;
  spawnTick: number;
}

/**
 * Chain reaction propagation configuration.
 * Uses intersection with BaseEntityData for proper typing.
 */
type ChainConfig = BaseEntityData & ChainConfigProps & {
  propagationType: 'chain';
};

/**
 * ChainReactionSystem - Handles deterministic cascading effects.
 * 
 * Manages entities with propagationType='chain'.
 * Used for dominos, wire signals, and other deterministic spread logic.
 */
export class ChainReactionSystem extends BaseTickedSystem {
  readonly executionPhase = 'main' as const;

  private spreadState = new Map<number, ChainState>();
  private propagatedEntities = new Map<number, PropagatedEntity>();

  protected tickRate = SYSTEM_CONFIG.ChainReaction.tickRate;

  protected onTick(context: GameContext): void {
    this.processSpreading(context);
    this.processCleanup(context);
  }

  private processSpreading(context: GameContext): void {
    const sources = new Map<number, Position>();

    // Identify sources
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasPropagation(entityData)) continue;
      if (entityData.propagationType !== 'chain') continue;
      if (context.spatial.isAlive(entityId) === false) continue;

      if (!this.spreadState.has(entityId)) {
        this.spreadState.set(entityId, {
          lastSpreadTick: this.currentTick,
          spawnTick: this.currentTick // Treat discovery as spawn if not tracked
        });
      }
      sources.set(entityId, pos);
    }

    // Spread
    for (const [sourceId, pos] of sources) {
      const sourceData = context.spatial.getEntityData(sourceId);
      if (!sourceData || !isChainConfig(sourceData)) continue;
      
      const state = this.spreadState.get(sourceId)!;

      if (this.currentTick - state.lastSpreadTick < sourceData.spreadRate) continue;

      // Check max distance
      const currentDist = this.propagatedEntities.get(sourceId)?.distance || 0;
      if (sourceData.maxDistance !== undefined && currentDist >= sourceData.maxDistance) {
        continue;
      }

      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      const directions = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];

      for (const dir of directions) {
        const neighbor = cell.neighbor(dir);
        if (!neighbor) continue;

        if (this.canSpreadTo(neighbor, sourceData, context)) {
          // Check if already occupied on spread layer (don't overlap chain elements)
          if (context.spatial.getEntityIdAt(neighbor.x, neighbor.y, sourceData.spreadLayer) !== undefined) {
            continue;
          }

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, type, sceneId, ...propagationProps } = sourceData;
          const newId = context.spatial.spawn(
            sourceData.spreadType,
            neighbor.x,
            neighbor.y,
            sourceData.spreadLayer,
            {
              ...propagationProps, // Copy only config props, not instance-specific ones
            }
          );

          this.spreadState.set(newId, {
            lastSpreadTick: this.currentTick,
            spawnTick: this.currentTick
          });

          this.propagatedEntities.set(newId, {
            sourceId: sourceId,
            distance: (this.propagatedEntities.get(sourceId)?.distance || 0) + 1,
            spawnTick: this.currentTick
          });
        }
      }

      state.lastSpreadTick = this.currentTick;
    }
  }

  private processCleanup(context: GameContext): void {
    const toRemove: number[] = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasPropagation(entityData)) continue;
      if (entityData.propagationType !== 'chain') continue;

      const lifetime = entityData.lifetime;
      if (typeof lifetime === 'number') {
        const state = this.spreadState.get(entityId);
        const spawnTick = state?.spawnTick || this.propagatedEntities.get(entityId)?.spawnTick || 0;

        if (this.currentTick - spawnTick >= lifetime) {
          toRemove.push(entityId);
        }
      }
    }

    for (const id of toRemove) {
      context.spatial.remove(id);
      this.spreadState.delete(id);
      this.propagatedEntities.delete(id);
    }
  }

  private canSpreadTo(cell: LinkedCell, config: ChainConfig, context: GameContext): boolean {
    if (context.spatial.isBlocked(cell)) return false;

    if (config.blockedByLayers) {
      for (const layer of config.blockedByLayers) {
        if (cell.getValue(layer) !== undefined) return false;
      }
    }
    return true;
  }

  public override resetState(): void {
    super.resetState();
    this.spreadState.clear();
    this.propagatedEntities.clear();
  }

  public override getDebugState() {
    return {
      ...super.getDebugState(),
      spreadStateSize: this.spreadState.size,
      propagatedCount: this.propagatedEntities.size,
    };
  }
}