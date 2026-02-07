/**
 * Tests for ChainFollowSystem and conjoined NPC mechanics.
 *
 * Tests:
 * - Followers replicate head movement without overlap
 * - spawnChain helper creates correct chain structure
 * - Chain followers are skipped by NPCMovementSystem
 * - Head promotion when head dies
 * - Centipede-style chain splitting when middle segment dies
 * - No two chain segments ever share the same cell
 * - Zero-lag following (same-tick as head)
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
    const gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 0 });
    npcMovementSystem = new NPCMovementSystem();
    chainFollowSystem = new ChainFollowSystem();

    // Order matters: movement first, then chain follow, then health
    gameLoop.addSystem(npcMovementSystem);
    gameLoop.addSystem(chainFollowSystem);
    gameLoop.addSystem(healthSystem);
  });

  /** Helper: get all positions for a list of entity IDs */
  function getPositions(ids: number[]): Array<{ x: number; y: number } | undefined> {
    return ids.map(id => {
      const pos = spatial.getEntityPosition(id);
      return pos ? { x: pos.x, y: pos.y } : undefined;
    });
  }

  /** Helper: verify no two entities share the same cell */
  function assertNoOverlaps(ids: number[], label: string): void {
    const positions = new Set<string>();
    for (const id of ids) {
      const pos = spatial.getEntityPosition(id);
      if (!pos) continue;
      const key = `${pos.x},${pos.y}`;
      expect(positions.has(key), `${label}: overlap at (${pos.x},${pos.y})`).toBe(false);
      positions.add(key);
    }
  }

  it('spawnChain creates head and followers with correct structure', () => {
    const ids = spawnChain(spatial, 'snake-1', [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ]);
    spatial.commit();

    expect(ids).toHaveLength(3);

    const head = store.getData(ids[0]);
    expect(head!.isChainHead).toBe(true);
    expect(head!.chainId).toBe('snake-1');
    expect(head!.chainIndex).toBe(0);

    const seg1 = store.getData(ids[1]);
    expect(seg1!.isChainHead).toBe(false);
    expect(seg1!.chainFollowTargetId).toBe(ids[0]);
    expect(seg1!.chainIndex).toBe(1);

    const seg2 = store.getData(ids[2]);
    expect(seg2!.isChainHead).toBe(false);
    expect(seg2!.chainFollowTargetId).toBe(ids[1]);
    expect(seg2!.chainIndex).toBe(2);
  });

  it('followers move into the cell their leader vacates (same tick)', () => {
    // Head: (5,5), F1: (4,5), F2: (3,5)
    // Head will auto-wander; we just need to see the chain stay connected.
    const headId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 30, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'test', isChainHead: true, chainIndex: 0, chainDelay: 1,
      movementMode: 'wander', speed: 1,
    });
    const f1Id = spatial.spawn('enemy', 4, 5, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'test', isChainHead: false, chainFollowTargetId: headId,
      chainIndex: 1, chainDelay: 1,
    });
    const f2Id = spatial.spawn('enemy', 3, 5, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'test', isChainHead: false, chainFollowTargetId: f1Id,
      chainIndex: 2, chainDelay: 1,
    });
    spatial.commit();

    // Run a tick so the head moves and followers follow in the same commit
    gameLoop.tick();

    const [headPos, f1Pos, f2Pos] = getPositions([headId, f1Id, f2Id]);

    // Head should have moved from (5,5)
    expect(headPos).toBeDefined();

    // F1 should be at the head's original position (5,5) since the
    // chain follow system staged the move in the same tick.
    expect(f1Pos).toEqual({ x: 5, y: 5 });

    // F2 should be at F1's original position (4,5)
    expect(f2Pos).toEqual({ x: 4, y: 5 });

    assertNoOverlaps([headId, f1Id, f2Id], 'after first tick');
  });

  it('chain segments never overlap even over many ticks', () => {
    // Head moves every tick (speed: 1)
    const headId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 30, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'overlap-test', isChainHead: true, chainIndex: 0, chainDelay: 1,
      movementMode: 'wander', speed: 1,
    });
    const f1Id = spatial.spawn('enemy', 9, 10, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'overlap-test', isChainHead: false, chainFollowTargetId: headId,
      chainIndex: 1, chainDelay: 1,
    });
    const f2Id = spatial.spawn('enemy', 8, 10, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'overlap-test', isChainHead: false, chainFollowTargetId: f1Id,
      chainIndex: 2, chainDelay: 1,
    });
    spatial.commit();

    const ids = [headId, f1Id, f2Id];

    // Run 20 ticks and verify no overlaps after each
    for (let t = 0; t < 20; t++) {
      gameLoop.tick();
      assertNoOverlaps(ids, `tick ${t + 1}`);
    }
  });

  it('followers stay put when head does not move', () => {
    const headId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 30, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'static', isChainHead: true, chainIndex: 0, chainDelay: 1,
      movementMode: 'wander', speed: 100, // Won't move (too slow)
    });
    const f1Id = spatial.spawn('enemy', 4, 5, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'static', isChainHead: false, chainFollowTargetId: headId,
      chainIndex: 1, chainDelay: 1,
    });
    spatial.commit();

    for (let i = 0; i < 5; i++) {
      gameLoop.tick();
    }

    const f1Pos = spatial.getEntityPosition(f1Id);
    expect(f1Pos!.x).toBe(4);
    expect(f1Pos!.y).toBe(5);
  });

  it('chain followers are skipped by NPCMovementSystem', () => {
    const headId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 30, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'skip-test', isChainHead: true, chainIndex: 0, chainDelay: 1,
      movementMode: 'wander', speed: 100,
    });
    const followerId = spatial.spawn('enemy', 4, 5, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'skip-test', isChainHead: false, chainFollowTargetId: headId,
      chainIndex: 1, chainDelay: 1,
      movementMode: 'wander', speed: 1, // Would move every tick IF not chain follower
    });
    spatial.commit();

    for (let i = 0; i < 5; i++) {
      gameLoop.tick();
    }

    // Follower should NOT have moved on its own (head didn't move)
    const followerPos = spatial.getEntityPosition(followerId);
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

    // Process several ticks for health to process death and chain to detect
    for (let i = 0; i < 3; i++) {
      gameLoop.tick();
    }

    const seg1Data = store.getData(seg1Id);
    expect(seg1Data).toBeDefined();
    expect(seg1Data!.isChainHead).toBe(true);
  });

  it('middle segment death splits chain centipede-style', () => {
    // Chain: head(0) -> seg1(1) -> seg2(2) -> seg3(3)
    const headId = spatial.spawn('enemy', 8, 5, GameLayers.ACTORS, {
      hp: 50, maxHp: 50, healthState: 'alive', team: 'enemy',
      chainId: 'split-test', isChainHead: true, chainIndex: 0, chainDelay: 1,
      movementMode: 'wander', speed: 100,
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

    for (let i = 0; i < 3; i++) {
      gameLoop.tick();
    }

    // Head should still be head of original chain
    const headData = store.getData(headId);
    expect(headData).toBeDefined();
    expect(headData!.isChainHead).toBe(true);
    expect(headData!.chainId).toBe('split-test');

    // seg2 should now be head of a NEW chain
    const seg2Data = store.getData(seg2Id);
    expect(seg2Data).toBeDefined();
    expect(seg2Data!.isChainHead).toBe(true);
    expect(seg2Data!.chainId).not.toBe('split-test');

    // seg3 should follow seg2 in the new chain
    const seg3Data = store.getData(seg3Id);
    expect(seg3Data).toBeDefined();
    expect(seg3Data!.isChainHead).toBe(false);
    expect(seg3Data!.chainFollowTargetId).toBe(seg2Id);
    expect(seg3Data!.chainId).toBe(seg2Data!.chainId);
  });

  it('multiple chains are independent', () => {
    const chainA = spawnChain(spatial, 'chain-a', [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ], { speed: 100 });

    const chainB = spawnChain(spatial, 'chain-b', [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ], { speed: 100 });

    spatial.commit();

    for (let i = 0; i < 3; i++) {
      gameLoop.tick();
    }

    const posA0 = spatial.getEntityPosition(chainA[0]);
    const posB0 = spatial.getEntityPosition(chainB[0]);
    expect(posA0).toBeDefined();
    expect(posB0).toBeDefined();
    expect(posA0!.x).not.toBe(posB0!.x);
  });

  it('chain is contiguous after every tick (no gaps)', () => {
    const headId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 30, maxHp: 30, healthState: 'alive', team: 'enemy',
      chainId: 'contiguous', isChainHead: true, chainIndex: 0, chainDelay: 1,
      movementMode: 'wander', speed: 1,
    });
    const f1Id = spatial.spawn('enemy', 9, 10, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'contiguous', isChainHead: false, chainFollowTargetId: headId,
      chainIndex: 1, chainDelay: 1,
    });
    const f2Id = spatial.spawn('enemy', 8, 10, GameLayers.ACTORS, {
      hp: 20, maxHp: 20, healthState: 'alive', team: 'enemy',
      chainId: 'contiguous', isChainHead: false, chainFollowTargetId: f1Id,
      chainIndex: 2, chainDelay: 1,
    });
    spatial.commit();

    const ids = [headId, f1Id, f2Id];

    for (let t = 0; t < 15; t++) {
      gameLoop.tick();

      // Each consecutive pair should be exactly 1 cell apart (Manhattan distance)
      const positions = getPositions(ids);
      for (let i = 0; i < positions.length - 1; i++) {
        const a = positions[i];
        const b = positions[i + 1];
        if (!a || !b) continue;
        const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        expect(dist, `tick ${t + 1}: gap between segment ${i} and ${i + 1}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
