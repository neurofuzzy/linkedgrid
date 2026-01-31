import type { GameSystem, GameContext, Position, EntityData } from '../types';
import { Direction } from '../../grid/direction';
import type { LinkedCell } from '../../grid/linked-cell';
import { hasPropagation } from '../entities/trait-guards';

interface ChainState {
  lastSpreadTick: number;
  spawnTick: number;
}

interface PropagatedEntity {
  sourceId: number;
  distance: number;
  spawnTick: number;
}

interface ChainConfig extends EntityData {
  propagationType: 'chain';
  spreadRate: number;
  spreadLayer: number;
  spreadType: string;
  maxDistance?: number;
  lifetime?: number;
  blockedByLayers?: number[];
}

/**
 * ChainReactionSystem - Handles deterministic cascading effects.
 * 
 * Manages entities with propagationType='chain'.
 * Used for dominos, wire signals, and other deterministic spread logic.
 */
export class ChainReactionSystem implements GameSystem {
  private spreadState = new Map<number, ChainState>();
  private propagatedEntities = new Map<number, PropagatedEntity>();
  private currentTick = 0;

  update(context: GameContext): void {
    this.currentTick++;
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
      const sourceData = context.spatial.getEntityData(sourceId) as unknown as ChainConfig;
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

          const newId = context.spatial.spawn(
            sourceData.spreadType,
            neighbor.x,
            neighbor.y,
            sourceData.spreadLayer,
            {
              ...sourceData, // Copy config
              // Ensure we copy 'chain' specific props if we add them later
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

      if (entityData.lifetime) {
        const state = this.spreadState.get(entityId);
        const spawnTick = state?.spawnTick || this.propagatedEntities.get(entityId)?.spawnTick || 0;
        
        if (this.currentTick - spawnTick >= entityData.lifetime) {
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
}
