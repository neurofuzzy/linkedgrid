/**
 * ScoreSystem Tests
 *
 * Tests for score tracking via kills and coin collection.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedGrid, SpatialSystem } from '../core';
import { SparseEntityStore } from '../core/entity-store';
import { GameManager } from '../core/game-manager';
import { GameLoop } from '../core/game-loop';
import { HealthSystem } from '../systems/health.system';
import { ScoreSystem } from '../systems/score.system';
import { GameLayers } from '../config/layers.config';

describe('ScoreSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let scoreSystem: ScoreSystem;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameManager = new GameManager();
    healthSystem = new HealthSystem({ dyingDuration: 1 });
    scoreSystem = new ScoreSystem(gameManager, healthSystem);
    gameLoop = new GameLoop(spatial, gameManager);
    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(scoreSystem);
  });

  function createPlayer(x: number, y: number): number {
    const id = spatial.spawn('player', x, y, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      healthState: 'alive',
      inventory: [],
    });
    spatial.commit();
    gameManager.gameState.playerEntityId = id;
    return id;
  }

  function createEnemy(x: number, y: number, scoreValue: number): number {
    const id = spatial.spawn('enemy', x, y, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 10,
      damage: 5,
      healthState: 'alive',
      aiState: 'idle',
      scoreValue,
    });
    spatial.commit();
    return id;
  }

  function createCoin(x: number, y: number, scoreValue: number): number {
    const id = spatial.spawn('coin', x, y, GameLayers.COLLECTIBLES, {
      scoreValue,
      collectibleId: 'coin',
      color: '#ffd700',
    });
    spatial.commit();
    return id;
  }

  // === Kill Score Tests ===

  it('should award score when player kills enemy with scoreValue', () => {
    // Arrange
    const playerId = createPlayer(1, 1);
    const enemyId = createEnemy(3, 3, 50);

    // Act - damage enemy to death (with player as source)
    healthSystem.damage(enemyId, 100, undefined, playerId);
    gameLoop.tick(); // dying state
    gameLoop.tick(); // dead state, death event emitted, score awarded

    // Assert
    expect(gameManager.gameState.score).toBe(50);
  });

  it('should not award score for non-player kills', () => {
    // Arrange
    createPlayer(1, 1);
    const enemyId = createEnemy(3, 3, 50);
    const otherEnemyId = createEnemy(5, 5, 0);

    // Act - enemy killed by another enemy (not player)
    healthSystem.damage(enemyId, 100, undefined, otherEnemyId);
    gameLoop.tick(); // dying
    gameLoop.tick(); // dead

    // Assert
    expect(gameManager.gameState.score).toBe(0);
  });

  it('should not award score when enemy has no scoreValue', () => {
    // Arrange
    const playerId = createPlayer(1, 1);
    const enemyId = spatial.spawn('enemy', 3, 3, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 10,
      damage: 5,
      healthState: 'alive',
      aiState: 'idle',
      // no scoreValue
    });
    spatial.commit();

    // Act
    healthSystem.damage(enemyId, 100, undefined, playerId);
    gameLoop.tick(); // dying
    gameLoop.tick(); // dead

    // Assert
    expect(gameManager.gameState.score).toBe(0);
  });

  it('should accumulate score from multiple kills', () => {
    // Arrange
    const playerId = createPlayer(1, 1);
    const enemy1 = createEnemy(3, 3, 10);
    const enemy2 = createEnemy(5, 5, 25);

    // Act - kill both enemies
    healthSystem.damage(enemy1, 100, undefined, playerId);
    healthSystem.damage(enemy2, 100, undefined, playerId);
    gameLoop.tick(); // dying
    gameLoop.tick(); // dead

    // Assert
    expect(gameManager.gameState.score).toBe(35);
  });

  // === Coin Collection Tests ===

  it('should award score when player collects a coin', () => {
    // Arrange - player and coin on same cell
    const playerId = createPlayer(5, 5);
    createCoin(5, 5, 10);

    // Act
    gameLoop.tick();

    // Assert
    expect(gameManager.gameState.score).toBe(10);
  });

  it('should remove coin after collection', () => {
    // Arrange
    createPlayer(5, 5);
    const coinId = createCoin(5, 5, 10);

    // Act
    gameLoop.tick();

    // Assert - coin should be removed
    expect(spatial.isAlive(coinId)).toBe(false);
  });

  it('should accumulate score from multiple coins', () => {
    // Arrange - player at (5,5) with coins at same position
    const playerId = createPlayer(5, 5);
    createCoin(5, 5, 10);

    // Act - collect first coin
    gameLoop.tick();

    // Move player to second coin
    spatial.move(playerId, 6, 5);
    spatial.commit();
    createCoin(6, 5, 25);
    gameLoop.tick();

    // Assert
    expect(gameManager.gameState.score).toBe(35);
  });

  // === Combined Tests ===

  it('should combine kill and coin score', () => {
    // Arrange
    const playerId = createPlayer(5, 5);
    createCoin(5, 5, 10);
    const enemyId = createEnemy(3, 3, 50);

    // Act - collect coin
    gameLoop.tick();

    // Kill enemy
    healthSystem.damage(enemyId, 100, undefined, playerId);
    gameLoop.tick(); // dying
    gameLoop.tick(); // dead

    // Assert
    expect(gameManager.gameState.score).toBe(60);
  });

  // === Death Event Tests ===

  it('should track killer in death events', () => {
    // Arrange
    const playerId = createPlayer(1, 1);
    const enemyId = createEnemy(3, 3, 50);

    // Act
    healthSystem.damage(enemyId, 100, undefined, playerId);
    gameLoop.tick(); // dying
    gameLoop.tick(); // dead - death events should have killerEntityId

    // Assert - score awarded confirms death event tracking works
    expect(gameManager.gameState.score).toBe(50);
  });

  it('should clear death events between ticks', () => {
    // Arrange
    const playerId = createPlayer(1, 1);
    const enemy1 = createEnemy(3, 3, 10);

    // Act - kill enemy
    healthSystem.damage(enemy1, 100, undefined, playerId);
    gameLoop.tick(); // dying
    gameLoop.tick(); // dead

    // Score should be 10 after first kill
    expect(gameManager.gameState.score).toBe(10);

    // Next tick - no new deaths, events should be cleared
    gameLoop.tick();

    // Score should not change
    expect(gameManager.gameState.score).toBe(10);
  });
});
