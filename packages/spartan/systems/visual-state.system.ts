/**
 * VisualStateSystem - Tracks visual state changes and emits events for view layers.
 *
 * Post-commit system that runs every tick:
 * 1. Detects entity position changes (emits entity:moved)
 * 2. Scans entities with HasVisualState for dirty flags (emits entity:state-changed)
 * 3. Advances animation frames for entities with HasAnimation
 * 4. Auto-updates facing direction from movement
 * 5. Listens for spawn/remove lifecycle events (emits entity:spawned, entity:removed)
 * 6. Exposes getDirtyEntities() for pull-based consumers
 *
 * This system is platform-agnostic. It produces data and events that
 * any view layer can consume without coupling to rendering APIs.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext, EntityData, EntityLifecycleEvent } from '../core/types';
import type { ExecutionPhase } from '../config/systems.config';
import { VisualEventBus } from '../core/visual-event-bus';
import { EffectsQueue } from '../core/effects-queue';
import { hasVisualState, hasFacing, hasAnimation } from '../traits/trait-guards';
import { Direction } from '../core/grid/direction';

/**
 * Position snapshot for change detection.
 */
interface PositionSnapshot {
  x: number;
  y: number;
  layer: number;
}

export class VisualStateSystem extends BaseReactiveSystem {
  readonly executionPhase: ExecutionPhase = 'post-commit';

  private eventBus: VisualEventBus;
  private effectsQueue: EffectsQueue;

  /** Last-tick position cache for movement detection */
  private lastPositions: Map<number, PositionSnapshot> = new Map();

  /** Entity IDs that changed this tick (for pull-based consumers) */
  private dirtyThisTick: number[] = [];

  /** Entity IDs that moved this tick (for pull-based consumers) */
  private movedThisTick: Array<{
    entityId: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }> = [];

  /** Lifecycle callback unsubscribers */
  private unsubscribers: Array<() => void> = [];
  private currentSpatial: GameContext['spatial'] | null = null;

  constructor(eventBus: VisualEventBus, effectsQueue: EffectsQueue) {
    super();
    this.eventBus = eventBus;
    this.effectsQueue = effectsQueue;
  }

  /**
   * Main update -- runs post-commit every tick.
   */
  update(context: GameContext): void {
    // Re-register lifecycle handlers on scene change
    this.registerLifecycleHandlers(context);

    // Clear per-tick state
    this.dirtyThisTick = [];
    this.movedThisTick = [];

    // 1. Detect position changes
    this.detectMoves(context);

    // 2. Scan visual state dirty flags + advance animation
    this.processVisualEntities(context);
  }

  /**
   * Detect entities that moved since last tick.
   */
  private detectMoves(context: GameContext): void {
    const { spatial } = context;
    const currentPositions = new Map<number, PositionSnapshot>();

    // Build current position map
    for (const [entityId, pos] of spatial.getAllPositions()) {
      currentPositions.set(entityId, { x: pos.x, y: pos.y, layer: pos.layer });

      const lastPos = this.lastPositions.get(entityId);
      if (lastPos && (lastPos.x !== pos.x || lastPos.y !== pos.y)) {
        // Entity moved
        const moveData = {
          entityId,
          fromX: lastPos.x,
          fromY: lastPos.y,
          toX: pos.x,
          toY: pos.y,
        };
        this.movedThisTick.push(moveData);

        this.eventBus.emit({
          type: 'entity:moved',
          entityId,
          x: pos.x,
          y: pos.y,
          data: {
            fromX: lastPos.x,
            fromY: lastPos.y,
            toX: pos.x,
            toY: pos.y,
          },
        });

        // Auto-update facing from movement direction
        const entity = spatial.getEntityData(entityId);
        if (entity && hasFacing(entity)) {
          const dx = pos.x - lastPos.x;
          const dy = pos.y - lastPos.y;
          const newFacing = this.deltaToDirection(dx, dy, entity.facingMode);
          if (newFacing !== undefined && newFacing !== entity.facing) {
            entity.facing = newFacing;
            // Mark dirty if has visual state
            if (hasVisualState(entity)) {
              entity.visualDirty = true;
            }
          }
        }
      }
    }

    // Update position cache
    this.lastPositions = currentPositions;
  }

  /**
   * Process entities with visual traits.
   */
  private processVisualEntities(context: GameContext): void {
    const { spatial } = context;

    for (const [entityId] of spatial.getAllPositions()) {
      const entity = spatial.getEntityData(entityId);
      if (!entity) continue;

      // Advance animation frames
      if (hasAnimation(entity)) {
        this.advanceAnimation(entity, entityId);
      }

      // Check dirty flag
      if (hasVisualState(entity) && entity.visualDirty) {
        this.dirtyThisTick.push(entityId);

        this.eventBus.emit({
          type: 'entity:state-changed',
          entityId,
          data: {
            visualState: entity.visualState,
          },
        });

        // Clear dirty flag
        entity.visualDirty = false;
      }
    }
  }

  /**
   * Advance animation frame for an entity.
   */
  private advanceAnimation(
    entity: EntityData & { frameCount: number; currentFrame: number; animationMode: string; frameDuration: number; animationTick: number },
    entityId: number
  ): void {
    // Only animate if there are multiple frames
    if (entity.frameCount <= 1) return;

    entity.animationTick = (entity.animationTick ?? 0) + 1;

    if (entity.animationTick >= entity.frameDuration) {
      entity.animationTick = 0;

      const oldFrame = entity.currentFrame;

      switch (entity.animationMode) {
        case 'repeat':
          entity.currentFrame = (entity.currentFrame + 1) % entity.frameCount;
          break;
        case 'once':
          if (entity.currentFrame < entity.frameCount - 1) {
            entity.currentFrame++;
          }
          break;
        case 'yoyo': {
          // Ping-pong: 0,1,2,1,0,1,2,1,0,...
          // Track direction via _animDir (1=forward, -1=backward)
          const dir = ((entity as Record<string, unknown>)._animDir as number) ?? 1;
          const newFrame = entity.currentFrame + dir;

          if (newFrame >= entity.frameCount - 1) {
            // Hit the end, reverse
            entity.currentFrame = entity.frameCount - 1;
            (entity as Record<string, unknown>)._animDir = -1;
          } else if (newFrame <= 0) {
            // Hit the start, go forward
            entity.currentFrame = 0;
            (entity as Record<string, unknown>)._animDir = 1;
          } else {
            entity.currentFrame = newFrame;
          }
          break;
        }
      }

      // Mark dirty if frame changed
      if (entity.currentFrame !== oldFrame && hasVisualState(entity)) {
        entity.visualDirty = true;
      }
    }
  }

  /**
   * Convert movement delta to Direction.
   */
  private deltaToDirection(
    dx: number,
    dy: number,
    mode: '2-way' | '4-way'
  ): Direction | undefined {
    if (dx === 0 && dy === 0) return undefined;

    if (mode === '2-way') {
      // Only horizontal
      if (dx > 0) return Direction.RIGHT;
      if (dx < 0) return Direction.LEFT;
      return undefined; // Vertical movement doesn't change 2-way facing
    }

    // 4-way: pick dominant axis
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      return dy > 0 ? Direction.DOWN : Direction.UP;
    }
  }

  /**
   * Register lifecycle handlers for spawn/remove events.
   * Re-registers when spatial system changes (scene transition).
   */
  private registerLifecycleHandlers(context: GameContext): void {
    if (this.currentSpatial === context.spatial) return;

    // Unsubscribe old
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.currentSpatial = context.spatial;

    // Clear position cache on scene change
    this.lastPositions.clear();

    // Subscribe to new spatial
    this.unsubscribers.push(
      context.spatial.onSpawn((event: EntityLifecycleEvent) => {
        this.eventBus.emit({
          type: 'entity:spawned',
          entityId: event.entityId,
          x: event.x,
          y: event.y,
          data: { entityType: event.type },
        });
      }),
      context.spatial.onRemove((event: EntityLifecycleEvent) => {
        this.eventBus.emit({
          type: 'entity:removed',
          entityId: event.entityId,
          x: event.x,
          y: event.y,
          data: { entityType: event.type },
        });
        // Clean up position cache
        this.lastPositions.delete(event.entityId);
      })
    );
  }

  // === Pull-based API for view layers ===

  /**
   * Get entity IDs that had visual state changes this tick.
   * Intended for pull-based view layers that poll each frame.
   */
  getDirtyEntities(): ReadonlyArray<number> {
    return this.dirtyThisTick;
  }

  /**
   * Get entities that moved this tick with position data.
   * Intended for pull-based view layers (e.g. tween triggers).
   */
  getMovedEntities(): ReadonlyArray<{
    entityId: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }> {
    return this.movedThisTick;
  }

  /**
   * Get the event bus for push-based subscriptions.
   */
  getEventBus(): VisualEventBus {
    return this.eventBus;
  }

  /**
   * Get the effects queue for draining visual effects.
   */
  getEffectsQueue(): EffectsQueue {
    return this.effectsQueue;
  }

  /**
   * Reset system state (for testing/scene transitions).
   */
  public override resetState(): void {
    this.lastPositions.clear();
    this.dirtyThisTick = [];
    this.movedThisTick = [];
    this.currentSpatial = null;
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  /**
   * Debug state.
   */
  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      trackedPositions: this.lastPositions.size,
      dirtyThisTick: this.dirtyThisTick.length,
      movedThisTick: this.movedThisTick.length,
      pendingEffects: this.effectsQueue.length,
    };
  }
}
