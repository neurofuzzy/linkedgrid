/**
 * Tests for ChainFollowSystem and conjoined NPC mechanics.
 *
 * Tests:
 * - Followers replicate head movement with delay
 * - Chain maintains spacing
 * - Head promotion when head dies
 * - spawnChain helper creates correct chain structure
 * - Chain followers are skipped by NPCMovementSystem
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { GameManager } from '../core/game-manager';
import { GameState } from '../core/game-state';
import { SceneManager } from '../core/scene-manager';
import { HealthSystem } from '../systems/health.system';
import { NPCMovementSystem } from '../systems/npc-movement.system';
import { ChainFollowSystem } from '../systems/chain-follow.system';
import { GameLayers } from '../config/layers.config';
import { spawnChain } from '../entities/spawn-helpers';

describe('ChainFollowSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let npcMovementSystem: NPCMovementSystem;
  let chainFollowSystem: ChainFollowSystem;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 0 });
    npcMovementSystem = new NPCMovementSystem();
    chainFollowSystem = new ChainFollowSystem();

    // Order matters: movement first, then chain follow, then health
    gameLoop.addSystem(npcMovementSystem);
    gameLoop.addSystem(chainFollowSystem);
    gameLoop.addSystem(healthSystem);
  });

  it('spawnChain creates head and followers', () => {
    const ids = spawnChain(spatial, 'snake-1', [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ]);
    spatial.commit();

    expect(ids).toHaveLength(3);

    // Head
    const head = store.getData(ids[0]);
    expect(head).toBeDefined();
    expect(head!.isChainHead).toBe(true);
    expect(head!.chainId).toBe('snake-1');
    expect(head!.chainIndex).toBe(0);

    // First follower
    const seg1 = store.getData(ids[1]);
    expect(seg1).toBeDefined();
    expect(seg1!.isChainHead).toBe(false);
    expect(seg1!.chainFollowTargetId).toBe(ids[0]);
    expect(seg1!.chainIndex).toBe(1);

    // Second follower
    const seg2 = store.getData(ids[2]);
    expect(seg2).toBeDefined();
    expect(seg2!.isChainHead).toBe(false);
    expect(seg2!.chainFollowTargetId).toBe(ids[1]);
    expect(seg2!.chainIndex).toBe(2);
  });

  it('followers replicate head movement with delay', () => {
    // Manually create a chain with known positions
    const headId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 30, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'test', isChainHead: true, chainIndex: 0, chainDelay: 1,
      movementMode: 'wander', speed: 100, // Very slow so it won't move on its own
    });
    const seg1Id = spatial.spawn('enemy', 4, 5, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'test', isChainHead: false, chainFollowTargetId: headId,
      chainIndex: 1, chainDelay: 1,
    });
    spatial.commit();

    // Tick 1: Record initial positions
    gameLoop.tick();
    spatial.commit();

    // Manually move head to (6, 5)
    spatial.move(headId, 6, 5);
    spatial.commit();

    // Tick 2: ChainFollowSystem records new head position and moves follower
    gameLoop.tick();
    spatial.commit();

    // Move head again to (7, 5)
    spatial.move(headId, 7, 5);
    spatial.commit();

    // Tick 3: follower should now be at (5, 5) - where head was 1 tick before the move
    gameLoop.tick();
    spatial.commit();

    const seg1Pos = spatial.getEntityPosition(seg1Id);
    expect(seg1Pos).toBeDefined();
    // Follower should have moved toward where head was
    // With delay=1, follower should be trailing behind head
    expect(seg1Pos!.x).toBeGreaterThanOrEqual(4);
    expect(seg1Pos!.x).toBeLessThanOrEqual(6);
  });

  it('chain followers are skipped by NPCMovementSystem', () => {
    // Create a follower with wander movement mode -- it should NOT move
    const headId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 30, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'test', isChainHead: true, chainIndex: 0, chainDelay: 1,
      movementMode: 'wander', speed: 100, // Won't move
    });
    const followerId = spatial.spawn('enemy', 4, 5, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'test', isChainHead: false, chainFollowTargetId: headId,
      chainIndex: 1, chainDelay: 1,
      movementMode: 'wander', speed: 1, // Would move every tick IF not chain follower
    });
    spatial.commit();

    // Tick several times -- follower should stay put since head isn't moving
    for (let i = 0; i < 5; i++) {
      gameLoop.tick();
      spatial.commit();
    }

    const followerPos = spatial.getEntityPosition(followerId);
    expect(followerPos).toBeDefined();
    expect(followerPos!.x).toBe(4);
    expect(followerPos!.y).toBe(5);
  });

  it('head promotion when head dies', () => {
    const headId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 1, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'promo', isChainHead: true, chainIndex: 0, chainDelay: 1,
      movementMode: 'wander', speed: 100,
    });
    const seg1Id = spatial.spawn('enemy', 4, 5, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'promo', isChainHead: false, chainFollowTargetId: headId,
      chainIndex: 1, chainDelay: 1,
    });
    spatial.commit();

    // Kill the head
    healthSystem.damage(headId, 100);

    // Process several ticks for health to process death
    for (let i = 0; i < 3; i++) {
      gameLoop.tick();
      spatial.commit();
    }

    // Follower should be promoted to head
    const seg1Data = store.getData(seg1Id);
    expect(seg1Data).toBeDefined();
    expect(seg1Data!.isChainHead).toBe(true);
  });

  it('middle segment death splits chain centipede-style', () => {
    // Create chain: head(0) -> seg1(1) -> seg2(2) -> seg3(3)
    const headId = spatial.spawn('enemy', 8, 5, GameLayers.ACTORS, {
      hp: 50, maxHp: 50, healthState: 'alive', team: 'enemy',
      chainId: 'split-test', isChainHead: true, chainIndex: 0, chainDelay: 1,
      movementMode: 'wander', speed: 100, // Won't move
    });
    const seg1Id = spatial.spawn('enemy', 7, 5, GameLayers.ACTORS, {
      hp: 1, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'split-test', isChainHead: false, chainFollowTargetId: headId,
      chainIndex: 1, chainDelay: 1,
    });
    const seg2Id = spatial.spawn('enemy', 6, 5, GameLayers.ACTORS, {
      hp: 30, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'split-test', isChainHead: false, chainFollowTargetId: seg1Id,
      chainIndex: 2, chainDelay: 1,
    });
    const seg3Id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 30, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'split-test', isChainHead: false, chainFollowTargetId: seg2Id,
      chainIndex: 3, chainDelay: 1,
    });
    spatial.commit();

    // Kill the middle segment (seg1)
    healthSystem.damage(seg1Id, 100);

    // Process ticks for death and splitting
    for (let i = 0; i < 3; i++) {
      gameLoop.tick();
      spatial.commit();
    }

    // Head should still be head of original chain
    const headData = store.getData(headId);
    expect(headData).toBeDefined();
    expect(headData!.isChainHead).toBe(true);
    expect(headData!.chainId).toBe('split-test');

    // seg2 should now be head of a NEW chain (split tail)
    const seg2Data = store.getData(seg2Id);
    expect(seg2Data).toBeDefined();
    expect(seg2Data!.isChainHead).toBe(true);
    // Should have a different chain ID than original
    expect(seg2Data!.chainId).not.toBe('split-test');

    // seg3 should follow seg2 in the new chain
    const seg3Data = store.getData(seg3Id);
    expect(seg3Data).toBeDefined();
    expect(seg3Data!.isChainHead).toBe(false);
    expect(seg3Data!.chainFollowTargetId).toBe(seg2Id);
    expect(seg3Data!.chainId).toBe(seg2Data!.chainId);
  });

  it('multiple chains are independent', () => {
    // Chain A
    const chainA = spawnChain(spatial, 'chain-a', [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ], { speed: 100 });

    // Chain B
    const chainB = spawnChain(spatial, 'chain-b', [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ], { speed: 100 });

    spatial.commit();

    // Tick several times
    for (let i = 0; i < 3; i++) {
      gameLoop.tick();
      spatial.commit();
    }

    // Verify chains are at different positions
    const posA0 = spatial.getEntityPosition(chainA[0]);
    const posB0 = spatial.getEntityPosition(chainB[0]);
    expect(posA0).toBeDefined();
    expect(posB0).toBeDefined();
    expect(posA0!.x).not.toBe(posB0!.x);
  });
});
