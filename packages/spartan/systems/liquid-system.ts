import type { GameSystem, GameContext, Position, EntityData } from '../types';
import { Direction } from '../../grid/direction';
import type { LinkedCell } from '../../grid/linked-cell';
import { hasPropagation, hasLiquid } from '../entities/trait-guards';
import { GameLayers } from '../layers/types';

/**
 * Spread state tracked per source entity.
 */
interface SpreadState {
  lastSpreadTick: number;
  originX: number;
  originY: number;
}

/**
 * Metadata tracked for propagated entities.
 * System-owned state (not serialized in entity data).
 */
interface PropagatedEntity {
  sourceId: number;
  distance: number;
  originX: number;
  originY: number;
}

/**
 * Liquid propagation configuration.
 */
interface LiquidConfig extends EntityData {
  propagationType?: string;
  spreadLayer: number;
  blockedByLayers?: number[];
  depth: number;
}

/**
 * LiquidSystem - Handles volumetric liquid flow.
 *
 * Simulates fluid dynamics using local equalization (cellular automata):
 * - Liquids have `depth` (integer volume).
 * - Liquid flows from high depth to low depth (neighbors).
 * - Conservation of volume is maintained.
 *
 * Algorithm:
 * 1. Iterate all liquid entities.
 * 2. Identify lower-depth neighbors (including empty cells).
 * 3. Calculate flow amount to equalize depth.
 * 4. Apply changes (reduce source depth, increase/spawn neighbor depth).
 *
 * Equilibrium is reached when all connected cells have depth 1 (or equal).
 */
export class LiquidSystem implements GameSystem {
  private spreadState = new Map<number, SpreadState>();
  private propagatedEntities = new Map<number, PropagatedEntity>();
  private currentTick = 0;

  update(context: GameContext): void {
    this.currentTick++;

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
          !hasLiquid(entityData)) {
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
        if (this.isBlocked(neighbor, entityData as unknown as LiquidConfig, context)) continue;

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

      // Calculate Flow using Average Distribution (Pressure Equalization)
      // 1. Calculate average depth of self + all eligible recipients
      let totalPoolDepth = entityData.depth;
      for (const r of recipients) totalPoolDepth += r.currentDepth;
      
      const count = recipients.length + 1;
      const targetDepth = Math.floor(totalPoolDepth / count);
      const remainder = totalPoolDepth % count;
      
      // 2. Determine target for source
      // Source keeps its share + 1 unit of remainder if available
      const sourceTarget = targetDepth + (remainder > 0 ? 1 : 0);
      let surplus = entityData.depth - sourceTarget;
      
      if (surplus <= 0) continue;

      // 3. Distribute surplus to recipients
      // Sort by depth (lowest first) to fill from bottom
      // Sort stability ensures bias is consistent (UP/left bias if equal)
      recipients.sort((a, b) => a.currentDepth - b.currentDepth);

      let distributedRemainder = (remainder > 0 ? 1 : 0); // Source already took its 1

      for (const recipient of recipients) {
        if (surplus <= 0) break;
        
        // Calculate target for this neighbor
        const neighborTarget = targetDepth + (distributedRemainder < remainder ? 1 : 0);
        if (distributedRemainder < remainder) distributedRemainder++;

        const needed = neighborTarget - recipient.currentDepth;
        if (needed <= 0) continue;

        const transfer = Math.min(surplus, needed);
        
        if (transfer > 0) {
          // Me
          const myDelta = depthDeltas.get(entityId) || 0;
          depthDeltas.set(entityId, myDelta - transfer);
          surplus -= transfer;

          // Them
          if (recipient.entityId !== undefined) {
            const theirDelta = depthDeltas.get(recipient.entityId) || 0;
            depthDeltas.set(recipient.entityId, theirDelta + transfer);
          } else {
            // Spawn new
            const key = `${recipient.cell.x},${recipient.cell.y}`;
            const pending = pendingSpawns.get(key) || { 
              amount: 0, 
              template: entityData as unknown as LiquidConfig,
              originX: state.originX,
              originY: state.originY
            };
            pending.amount += transfer;
            // Update template logic: keep ref to original data
            pending.template = entityData as unknown as LiquidConfig;
            pendingSpawns.set(key, pending);
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
        if (entityData.depth <= 0) {
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
          depth: spawn.amount,
          lastSpreadTick: this.currentTick,
        }
      );
      
      // Init tracking
      this.spreadState.set(id, { 
        lastSpreadTick: this.currentTick,
        originX: spawn.originX,
        originY: spawn.originY
      });
      
      // Init propagation metadata (for inheritance if spreadState cleared)
      this.propagatedEntities.set(id, {
        sourceId: 0, // Not tracking exact parent ID, just origin
        distance: this.manhattanDistance(spawn.originX, spawn.originY, x, y),
        originX: spawn.originX,
        originY: spawn.originY
      });
    }
  }

  private isBlocked(cell: LinkedCell, config: LiquidConfig, context: GameContext): boolean {
    if (context.spatial.isBlocked(cell)) return true;
    
    if (config.blockedByLayers) {
      for (const layer of config.blockedByLayers) {
        if (cell.getValue(layer) !== undefined) return true;
      }
    }
    return false;
  }

  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }
}
