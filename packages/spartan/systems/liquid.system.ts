/**
 * @brief Simulates liquid flow physics.
 */
import { BaseTickedSystem } from '../core/base-system';
import { SYSTEM_CONFIG } from '../config/systems.config';
import type { GameContext } from '../core/types';
import type { BaseEntityData } from '../entities/entity.types';
import { Direction } from '../core/grid/direction';
import type { LinkedCell } from '../core/grid/linked-cell';
import type { EntityData } from '../entities/entity.types';
import { hasPropagation, hasLiquid } from '../traits/trait-guards';

/**
 * Properties required for liquid propagation.
 */
interface LiquidConfigProps {
  spreadLayer: number;
  blockedByLayers?: number[];
  depth: number;
  flammable?: boolean;
  flamePoint?: number;
  temperature?: number;
  maxDistance?: number;
  spreadRate: number;
  spreadType: string;
}

/**
 * Type guard for LiquidConfig properties.
 */
function isLiquidConfig(data: EntityData): data is EntityData & LiquidConfigProps {
  return (
    'spreadLayer' in data && typeof data.spreadLayer === 'number' &&
    'depth' in data && typeof data.depth === 'number' &&
    'spreadRate' in data && typeof data.spreadRate === 'number' &&
    'spreadType' in data && typeof data.spreadType === 'string'
  );
}

interface SpreadState {
  lastSpreadTick: number;
  originX: number;
  originY: number;
}

interface PropagatedEntity {
  sourceId: number;
  distance: number;
  originX: number;
  originY: number;
}

type LiquidConfig = BaseEntityData & LiquidConfigProps & {
  propagationType?: string;
};

/**
 * LiquidSystem - Handles volumetric liquid flow.
 *
 * Simulates fluid dynamics using local equalization (cellular automata).
 */
export class LiquidSystem extends BaseTickedSystem {
  readonly executionPhase = 'main' as const;

  private spreadState = new Map<number, SpreadState>();
  private propagatedEntities = new Map<number, PropagatedEntity>();

  protected tickRate = SYSTEM_CONFIG.Liquid.tickRate;

  protected onTick(context: GameContext): void {
    // Track deltas to apply at end of tick (prevent order bias)
    // Map<EntityId, number>
    const depthDeltas = new Map<number, number>();

    // Track new spawns: Map<"x,y", { amount: number, template: LiquidConfig, originX: number, originY: number }>
    const pendingSpawns = new Map<string, {
      amount: number;
      template: LiquidConfig;
      originX: number;
      originY: number;
    }>();

    // 1. Calculate Flows
    for (const [entityId, pos] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);

      // Check if valid liquid source
      if (!entityData ||
        !hasPropagation(entityData) ||
        entityData.propagationType !== 'liquid' ||
        !hasLiquid(entityData) ||
        !isLiquidConfig(entityData)) {
        continue;
      }

      // Check/Init state
      let state = this.spreadState.get(entityId);
      if (!state) {
        // Recover origin from propagated metadata if available, else use current pos
        const meta = this.propagatedEntities.get(entityId);
        state = {
          lastSpreadTick: -1,
          originX: meta ? meta.originX : pos.x,
          originY: meta ? meta.originY : pos.y
        };
        this.spreadState.set(entityId, state);
      }

      // If just spawned this tick, don't spread yet
      if (state.lastSpreadTick === this.currentTick) continue;

      // Check spread rate relative to last spread
      // Note: BaseTickedSystem already limits onTick calls, but entities might have custom rates
      if (this.currentTick - state.lastSpreadTick < entityData.spreadRate) {
        continue;
      }

      const cell = context.spatial.grid.cell(pos.x, pos.y);
      if (!cell) continue;

      // Find valid recipients
      const recipients: Array<{ cell: LinkedCell; currentDepth: number; entityId?: number }> = [];

      for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
        const neighbor = cell.neighbor(dir);
        if (!neighbor) continue;

        // Check blocking
        if (this.isBlocked(neighbor, entityData, context)) continue;

        // Check distance limit
        if (entityData.maxDistance !== undefined) {
          const dist = this.manhattanDistance(state.originX, state.originY, neighbor.x, neighbor.y);
          if (dist > entityData.maxDistance) continue;
        }

        // Check if liquid exists
        const existingLiquidId = neighbor.getValue(entityData.spreadLayer);
        let currentDepth = 0;

        if (existingLiquidId !== undefined) {
          const neighborData = context.spatial.getEntityData(existingLiquidId);
          if (neighborData && hasLiquid(neighborData) && neighborData.type === entityData.type) {
            currentDepth = neighborData.depth;
          } else {
            // Occupied by something else or different liquid
            continue;
          }
        }

        // Only flow if I am higher than neighbor
        if (entityData.depth > currentDepth) {
          recipients.push({ cell: neighbor, currentDepth, entityId: existingLiquidId });
        }
      }

      if (recipients.length === 0) continue;

      // Calculate Flow: Damped Pairwise Diffusion (Float)
      const divisor = recipients.length + 1;

      for (const recipient of recipients) {
        // Only flow to lower neighbors
        if (entityData.depth <= recipient.currentDepth) continue;

        // User requested: Cells with depth < 2 should not spread (surface tension)
        if (entityData.depth < 2) continue;

        // Calculate transfer amount (Float)
        const diff = entityData.depth - recipient.currentDepth;
        const transfer = diff / divisor;

        // Min flow threshold to prevent Zeno's paradox
        if (transfer < 0.05) continue;

        if (transfer > 0) {
          // Me
          const myDelta = depthDeltas.get(entityId) || 0;
          depthDeltas.set(entityId, myDelta - transfer);

          // Them
          if (recipient.entityId !== undefined) {
            const theirDelta = depthDeltas.get(recipient.entityId) || 0;
            depthDeltas.set(recipient.entityId, theirDelta + transfer);
          } else {
            // Spawn new
            const key = `${recipient.cell.x},${recipient.cell.y}`;
            const pending = pendingSpawns.get(key);
            if (pending) {
              // If a spawn is already pending, just add to its amount
              // Don't overwrite the template - keep the first liquid's properties
              pending.amount += transfer;
            } else {
              // Otherwise, create a new pending spawn
              pendingSpawns.set(key, {
                amount: transfer,
                template: entityData,
                originX: state.originX,
                originY: state.originY
              });
            }
          }
        }
      }

      state.lastSpreadTick = this.currentTick;
    }

    // 2. Apply Changes

    // Apply deltas to existing entities
    for (const [id, delta] of depthDeltas.entries()) {
      const entityData = context.spatial.getEntityData(id);
      if (entityData && hasLiquid(entityData)) {
        entityData.depth += delta;
        // Cleanup if depth drops below threshold
        if (entityData.depth < 0.05) {
          context.spatial.remove(id);
          this.spreadState.delete(id);
          this.propagatedEntities.delete(id);
        }
      }
    }

    // Spawn new entities
    for (const [key, spawn] of pendingSpawns.entries()) {
      const [x, y] = key.split(',').map(Number);

      // Verify cell is still empty on that layer (check for race with existing entity handling)
      if (context.spatial.getEntityIdAt(x, y, spawn.template.spreadLayer) !== undefined) {
        continue;
      }

      const id = context.spatial.spawn(
        spawn.template.spreadType,
        x, y,
        spawn.template.spreadLayer,
        {
          ...spawn.template,
          // Copy flammability if present (important for oil/gasoline)
          ...(spawn.template.flammable !== undefined && {
            flammable: spawn.template.flammable,
            flamePoint: spawn.template.flamePoint,
            temperature: spawn.template.temperature
          }),
          depth: spawn.amount,
          // Note: lastSpreadTick is system-internal state, not part of entity data
        }
      );

      // Init tracking
      this.spreadState.set(id, {
        lastSpreadTick: this.currentTick,
        originX: spawn.originX,
        originY: spawn.originY
      });

      // Init propagation metadata
      this.propagatedEntities.set(id, {
        sourceId: 0, // Not tracking exact parent ID, just origin
        distance: this.manhattanDistance(spawn.originX, spawn.originY, x, y),
        originX: spawn.originX,
        originY: spawn.originY
      });
    }
  }

  private isBlocked(cell: LinkedCell, config: LiquidConfig, context: GameContext): boolean {
    // Check spatial blocking mask (e.g. static walls)
    if (context.spatial.isBlocked(cell)) return true;

    // Check specific layer blocking (e.g. objects)
    if (config.blockedByLayers) {
      for (const layer of config.blockedByLayers) {
        const id = cell.getValue(layer);
        if (id !== undefined && id > 0) return true;
      }
    }
    return false;
  }

  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  public override resetState(): void {
    super.resetState();
    this.spreadState.clear();
    this.propagatedEntities.clear();
  }
}