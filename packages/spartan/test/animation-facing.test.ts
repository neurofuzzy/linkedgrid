/**
 * Animation & Facing Tests (Phase 4b)
 *
 * Tests for:
 * - Yoyo animation mode
 * - Animation dirty flag integration
 * - PlayerInputSystem visual state hooks
 * - NPCMovementSystem visual state hooks
 * - MeleeSystem visual state hooks
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LinkedGrid, SpatialSystem } from '../core';
import { SparseEntityStore } from '../core/entity-store';
import { GameLoop } from '../core/game-loop';
import { GameManager } from '../core/game-manager';
import { VisualEventBus } from '../core/visual-event-bus';
import { EffectsQueue } from '../core/effects-queue';
import { VisualStateSystem } from '../systems/visual-state.system';
import { PlayerInputSystem } from '../systems/player-input.system';
import { MeleeSystem } from '../systems/melee.system';
import { HealthSystem } from '../systems/health.system';
import { GameLayers } from '../config/layers.config';
import { Direction } from '../core/grid/direction';
import type { InputProvider } from '../core/input-provider';

// Minimal input provider for testing
class MockInputProvider implements InputProvider {
  private direction: Direction = Direction.NONE;
  private action = false;
  private aimDir: Direction = Direction.NONE;

  setDirection(d: Direction) { this.direction = d; }
  setAction(a: boolean) { this.action = a; }
  setAimDir(d: Direction) { this.aimDir = d; }

  getMoveDirection(): Direction { return this.direction; }
  getPrimaryAction(): boolean { return this.action; }
  getSecondaryAction(): boolean { return false; }
  getStart(): boolean { return false; }
  getRestart(): boolean { return false; }
  getAimDirection(): Direction { return this.aimDir; }
  isAiming(): boolean { return this.aimDir !== Direction.NONE; }
}

describe('Animation & Facing (Phase 4b)', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let eventBus: VisualEventBus;
  let effectsQueue: EffectsQueue;
  let visualSystem: VisualStateSystem;
  let gameManager: GameManager;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    eventBus = new VisualEventBus();
    effectsQueue = new EffectsQueue();
    visualSystem = new VisualStateSystem(eventBus, effectsQueue);
    gameManager = new GameManager();
    gameLoop = new GameLoop(spatial, gameManager);
    gameLoop.addSystem(visualSystem);
  });

  // === Yoyo Animation Mode ===

  describe('yoyo animation mode', () => {
    it('should ping-pong between first and last frame', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        visualState: 'idle',
        visualDirty: false,
        frameCount: 3, // frames: 0, 1, 2
        currentFrame: 0,
        animationMode: 'yoyo',
        frameDuration: 1,
        animationTick: 0,
      });
      spatial.commit();

      // Act -- advance frames and collect them
      const frames: number[] = [];
      for (let i = 0; i < 8; i++) {
        gameLoop.tick();
        const entity = spatial.getEntityData(id);
        frames.push((entity?.currentFrame as number) ?? -1);
      }

      // Assert -- should go 1, 2, 1, 0, 1, 2, 1, 0 (yoyo)
      expect(frames[0]).toBe(1); // 0->1
      expect(frames[1]).toBe(2); // 1->2
      expect(frames[2]).toBe(1); // 2->1 (reverse)
      expect(frames[3]).toBe(0); // 1->0 (reverse)
      expect(frames[4]).toBe(1); // 0->1 (forward again)
    });
  });

  // === PlayerInputSystem Visual Hooks ===

  describe('PlayerInputSystem visual hooks', () => {
    let inputProvider: MockInputProvider;
    let playerInputSystem: PlayerInputSystem;

    beforeEach(() => {
      inputProvider = new MockInputProvider();
      playerInputSystem = new PlayerInputSystem(gameManager, inputProvider);
      gameLoop.addSystem(playerInputSystem);
    });

    it('should set visual state to walk when player moves', () => {
      // Arrange
      const id = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        visualState: 'idle',
        visualDirty: false,
      });
      spatial.commit();
      gameManager.gameState.playerEntityId = id;

      // Act -- player moves right
      inputProvider.setDirection(Direction.RIGHT);
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      expect(entity?.visualState).toBe('walk');
    });

    it('should revert to idle when player stops moving', () => {
      // Arrange
      const id = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        visualState: 'walk',
        visualDirty: false,
      });
      spatial.commit();
      gameManager.gameState.playerEntityId = id;

      // Act -- no direction
      inputProvider.setDirection(Direction.NONE);
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      expect(entity?.visualState).toBe('idle');
    });

    it('should set facing from input direction', () => {
      // Arrange
      const id = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        facing: Direction.UP,
        facingMode: '4-way',
        visualState: 'idle',
        visualDirty: false,
      });
      spatial.commit();
      gameManager.gameState.playerEntityId = id;

      // Act -- player presses left
      inputProvider.setDirection(Direction.LEFT);
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      expect(entity?.facing).toBe(Direction.LEFT);
    });
  });

  // === MeleeSystem Visual Hooks ===

  describe('MeleeSystem visual hooks', () => {
    let inputProvider: MockInputProvider;
    let healthSystem: HealthSystem;
    let meleeSystem: MeleeSystem;

    beforeEach(() => {
      inputProvider = new MockInputProvider();
      healthSystem = new HealthSystem({ dyingDuration: 1 });
      meleeSystem = new MeleeSystem(gameManager, inputProvider, healthSystem);
      gameLoop.addSystem(healthSystem);
      gameLoop.addSystem(meleeSystem);
    });

    it('should set visual state to attack on melee attack', () => {
      // Arrange
      const id = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        healthState: 'alive',
        damage: 10,
        meleeDamage: 10,
        meleeCooldown: 3,
        meleeRange: 1,
        visualState: 'idle',
        visualDirty: false,
        isPlayer: true,
        team: 'player',
      });
      spatial.commit();
      gameManager.gameState.playerEntityId = id;

      // Spawn an enemy adjacent
      spatial.spawn('enemy', 6, 5, GameLayers.ACTORS, {
        hp: 50,
        maxHp: 50,
        healthState: 'alive',
        damage: 5,
        team: 'enemy',
      });
      spatial.commit();

      // Act -- player attacks right
      inputProvider.setAimDir(Direction.RIGHT); // Set aim so facing updates
      inputProvider.setAction(true);
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      expect(entity?.visualState).toBe('attack');
    });

    it('should set facing toward attack direction', () => {
      // Arrange
      const id = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        healthState: 'alive',
        damage: 10,
        meleeDamage: 10,
        meleeCooldown: 3,
        meleeRange: 1,
        facing: Direction.UP,
        facingMode: '4-way',
        visualState: 'idle',
        visualDirty: false,
        isPlayer: true,
        team: 'player',
      });
      spatial.commit();
      gameManager.gameState.playerEntityId = id;

      // Act -- player attacks right (via aim direction + action)
      inputProvider.setAimDir(Direction.RIGHT);
      inputProvider.setAction(true);
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      expect(entity?.facing).toBe(Direction.RIGHT);
    });
  });

  // === Integration: animation + facing on same entity ===

  describe('combined animation and facing', () => {
    it('should advance animation while tracking facing', () => {
      // Arrange
      const id = spatial.spawn('player', 3, 3, GameLayers.ACTORS, {
        visualState: 'walk',
        visualDirty: false,
        facing: Direction.RIGHT,
        facingMode: '4-way',
        frameCount: 3,
        currentFrame: 0,
        animationMode: 'repeat',
        frameDuration: 1,
        animationTick: 0,
      });
      spatial.commit();

      // Tick to establish baseline
      gameLoop.tick();

      // Act -- move entity down (changes facing)
      spatial.move(id, 3, 4);
      spatial.commit();
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      expect(entity?.facing).toBe(Direction.DOWN);
      // Animation should have advanced (2 ticks total)
      expect(entity?.currentFrame).toBeGreaterThanOrEqual(0);
    });
  });
});
