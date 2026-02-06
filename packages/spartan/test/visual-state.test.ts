/**
 * VisualStateSystem Tests
 *
 * Tests for dirty tracking, position change detection,
 * event emission, and animation frame advancement.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LinkedGrid, SpatialSystem } from '../core';
import { SparseEntityStore } from '../core/entity-store';
import { GameLoop } from '../core/game-loop';
import { VisualEventBus } from '../core/visual-event-bus';
import { EffectsQueue } from '../core/effects-queue';
import { VisualStateSystem } from '../systems/visual-state.system';
import { GameLayers } from '../config/layers.config';
import { Direction } from '../core/grid/direction';

describe('VisualStateSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let eventBus: VisualEventBus;
  let effectsQueue: EffectsQueue;
  let visualSystem: VisualStateSystem;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    eventBus = new VisualEventBus();
    effectsQueue = new EffectsQueue();
    visualSystem = new VisualStateSystem(eventBus, effectsQueue);
    gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(visualSystem);
  });

  // === Dirty State Tracking ===

  describe('dirty state tracking', () => {
    it('should detect dirty entities and emit state-changed events', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        visualState: 'idle',
        visualDirty: true,
      });
      spatial.commit();

      const callback = vi.fn();
      eventBus.on('entity:state-changed', callback);

      // Act
      gameLoop.tick();

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'entity:state-changed',
          entityId: id,
          data: expect.objectContaining({ visualState: 'idle' }),
        })
      );
    });

    it('should clear dirty flag after emission', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        visualState: 'idle',
        visualDirty: true,
      });
      spatial.commit();

      // Act
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      expect(entity?.visualDirty).toBe(false);
    });

    it('should not emit for non-dirty entities', () => {
      // Arrange
      spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        visualState: 'idle',
        visualDirty: false,
      });
      spatial.commit();

      const callback = vi.fn();
      eventBus.on('entity:state-changed', callback);

      // Act
      gameLoop.tick();

      // Assert
      expect(callback).not.toHaveBeenCalled();
    });

    it('should expose dirty entities via getDirtyEntities()', () => {
      // Arrange
      const id1 = spatial.spawn('player', 1, 1, GameLayers.ACTORS, {
        visualState: 'idle',
        visualDirty: true,
      });
      spatial.spawn('enemy', 2, 2, GameLayers.ACTORS, {
        visualState: 'walk',
        visualDirty: false,
      });
      const id3 = spatial.spawn('enemy', 3, 3, GameLayers.ACTORS, {
        visualState: 'attack',
        visualDirty: true,
      });
      spatial.commit();

      // Act
      gameLoop.tick();

      // Assert
      const dirty = visualSystem.getDirtyEntities();
      expect(dirty).toContain(id1);
      expect(dirty).toContain(id3);
      expect(dirty).toHaveLength(2);
    });
  });

  // === Position Change Detection ===

  describe('position change detection', () => {
    it('should emit entity:moved when entity changes position', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS);
      spatial.commit();

      // First tick to establish baseline positions
      gameLoop.tick();

      const callback = vi.fn();
      eventBus.on('entity:moved', callback);

      // Act -- move the entity
      spatial.move(id, 4, 3);
      spatial.commit();
      gameLoop.tick();

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'entity:moved',
          entityId: id,
          x: 4,
          y: 3,
          data: expect.objectContaining({
            fromX: 3,
            fromY: 3,
            toX: 4,
            toY: 3,
          }),
        })
      );
    });

    it('should not emit entity:moved when entity stays put', () => {
      // Arrange
      spatial.spawn('player', 3, 3, GameLayers.ACTORS);
      spatial.commit();

      // First tick to establish baseline
      gameLoop.tick();

      const callback = vi.fn();
      eventBus.on('entity:moved', callback);

      // Act -- no movement
      gameLoop.tick();

      // Assert
      expect(callback).not.toHaveBeenCalled();
    });

    it('should expose moved entities via getMovedEntities()', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS);
      spatial.commit();
      gameLoop.tick(); // Baseline

      // Act
      spatial.move(id, 4, 3);
      spatial.commit();
      gameLoop.tick();

      // Assert
      const moved = visualSystem.getMovedEntities();
      expect(moved).toHaveLength(1);
      expect(moved[0].entityId).toBe(id);
      expect(moved[0].fromX).toBe(3);
      expect(moved[0].toX).toBe(4);
    });
  });

  // === Facing Auto-Update ===

  describe('facing auto-update', () => {
    it('should update facing direction when entity moves right (4-way)', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        facing: Direction.UP,
        facingMode: '4-way',
        visualState: 'idle',
        visualDirty: false,
      });
      spatial.commit();
      gameLoop.tick(); // Baseline

      // Act -- move right
      spatial.move(id, 4, 3);
      spatial.commit();
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      expect(entity?.facing).toBe(Direction.RIGHT);
    });

    it('should update facing direction when entity moves down (4-way)', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        facing: Direction.UP,
        facingMode: '4-way',
        visualState: 'idle',
        visualDirty: false,
      });
      spatial.commit();
      gameLoop.tick();

      // Act -- move down
      spatial.move(id, 3, 4);
      spatial.commit();
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      expect(entity?.facing).toBe(Direction.DOWN);
    });

    it('should only update horizontal facing in 2-way mode', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        facing: Direction.RIGHT,
        facingMode: '2-way',
        visualState: 'idle',
        visualDirty: false,
      });
      spatial.commit();
      gameLoop.tick();

      // Act -- move down (vertical)
      spatial.move(id, 3, 4);
      spatial.commit();
      gameLoop.tick();

      // Assert -- facing should NOT change for vertical movement in 2-way mode
      const entity = spatial.getEntityData(id);
      expect(entity?.facing).toBe(Direction.RIGHT);
    });

    it('should mark visualDirty when facing changes', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        facing: Direction.UP,
        facingMode: '4-way',
        visualState: 'idle',
        visualDirty: false,
      });
      spatial.commit();
      gameLoop.tick();

      // Act -- move right (changes facing from UP to RIGHT)
      spatial.move(id, 4, 3);
      spatial.commit();

      const stateChangedCb = vi.fn();
      eventBus.on('entity:state-changed', stateChangedCb);

      gameLoop.tick();

      // Assert -- dirty was set (and then cleared), so state-changed was emitted
      expect(stateChangedCb).toHaveBeenCalled();
      // After the tick, dirty should be cleared
      const entity = spatial.getEntityData(id);
      expect(entity?.visualDirty).toBe(false);
    });
  });

  // === Lifecycle Events ===

  describe('lifecycle events', () => {
    it('should emit entity:spawned when entity is created', () => {
      // Arrange
      const callback = vi.fn();
      eventBus.on('entity:spawned', callback);

      // Need a tick first so the system registers lifecycle handlers
      gameLoop.tick();

      // Act
      const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, { hp: 10, maxHp: 10 });
      spatial.commit();

      // Assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'entity:spawned',
          entityId: id,
          x: 5,
          y: 5,
          data: expect.objectContaining({ entityType: 'enemy' }),
        })
      );
    });

    it('should emit entity:removed when entity is destroyed', () => {
      // Arrange
      const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
      spatial.commit();

      // First tick to register handlers
      gameLoop.tick();

      const callback = vi.fn();
      eventBus.on('entity:removed', callback);

      // Act
      spatial.remove(id);
      spatial.commit();

      // Assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'entity:removed',
          entityId: id,
          x: 5,
          y: 5,
        })
      );
    });
  });

  // === Animation Frame Advancement ===

  describe('animation frame advancement', () => {
    it('should advance frames in repeat mode', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        visualState: 'walk',
        visualDirty: false,
        frameCount: 3,
        currentFrame: 0,
        animationMode: 'repeat',
        frameDuration: 2, // Advance every 2 ticks
        animationTick: 0,
      });
      spatial.commit();

      // Act -- tick 1 (animationTick: 1, not yet at frameDuration)
      gameLoop.tick();
      expect(spatial.getEntityData(id)?.currentFrame).toBe(0);

      // tick 2 (animationTick: 2 >= frameDuration 2, advance frame)
      gameLoop.tick();
      expect(spatial.getEntityData(id)?.currentFrame).toBe(1);

      // tick 3
      gameLoop.tick();
      expect(spatial.getEntityData(id)?.currentFrame).toBe(1);

      // tick 4 -- advance again
      gameLoop.tick();
      expect(spatial.getEntityData(id)?.currentFrame).toBe(2);

      // tick 5
      gameLoop.tick();

      // tick 6 -- wraps to 0 in repeat mode
      gameLoop.tick();
      expect(spatial.getEntityData(id)?.currentFrame).toBe(0);
    });

    it('should stop at last frame in once mode', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        visualState: 'die',
        visualDirty: false,
        frameCount: 3,
        currentFrame: 0,
        animationMode: 'once',
        frameDuration: 1,
        animationTick: 0,
      });
      spatial.commit();

      // Act
      gameLoop.tick(); // frame 1
      gameLoop.tick(); // frame 2
      gameLoop.tick(); // stays at 2 (last frame)
      gameLoop.tick(); // still 2

      // Assert
      expect(spatial.getEntityData(id)?.currentFrame).toBe(2);
    });

    it('should not animate single-frame entities', () => {
      // Arrange
      const id = spatial.spawn('wall', 3, 3, GameLayers.WALLS, {
        visualState: 'idle',
        visualDirty: false,
        frameCount: 1,
        currentFrame: 0,
        animationMode: 'repeat',
        frameDuration: 1,
        animationTick: 0,
      });
      spatial.commit();

      // Act
      gameLoop.tick();
      gameLoop.tick();
      gameLoop.tick();

      // Assert
      expect(spatial.getEntityData(id)?.currentFrame).toBe(0);
    });
  });

  // === EffectsQueue Access ===

  describe('effects queue access', () => {
    it('should provide access to effects queue', () => {
      // Assert
      expect(visualSystem.getEffectsQueue()).toBe(effectsQueue);
    });

    it('should provide access to event bus', () => {
      // Assert
      expect(visualSystem.getEventBus()).toBe(eventBus);
    });
  });

  // === Reset State ===

  describe('reset state', () => {
    it('should clear all internal state on reset', () => {
      // Arrange
      spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        visualState: 'idle',
        visualDirty: true,
      });
      spatial.commit();
      gameLoop.tick();

      // Act
      visualSystem.resetState();

      // Assert -- no crashes, clean state
      const debug = visualSystem.getDebugState();
      expect(debug.trackedPositions).toBe(0);
      expect(debug.dirtyThisTick).toBe(0);
      expect(debug.movedThisTick).toBe(0);
    });
  });
});
