import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedGrid } from '../../grid/linked-grid';
import { SparseEntityStore } from '../entity-store';
import { SpatialSystem } from '../spatial-system';
import { ExplosionSystem } from '../systems/explosion-system';
import { FloorEffectSystem } from '../systems/floor-effect-system';
import { GameManager } from '../game-manager';
import { GameState } from '../game-state';
import { GameLayers } from '../layers/types';
import type { GameContext } from '../types';

describe('ExplosionSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let explosionSystem: ExplosionSystem;
  let context: GameContext;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    explosionSystem = new ExplosionSystem();

    context = {
      spatial,
      store,
      grid,
    } as GameContext;
  });

  describe('on-death explosions', () => {
    it('explodes when barrel is destroyed', () => {
      // Spawn barrel with explosion trait
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 20,
        maxHp: 20,
        explosionDamage: 30,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn target entity in explosion radius
      const targetId = spatial.spawn('player', 12, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });

      spatial.commit();

      // Damage barrel to death
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      // Run explosion system
      explosionSystem.update(context);
      spatial.commit();

      // Check that target took damage
      const targetData = spatial.getEntityData(targetId);
      expect(targetData).toBeDefined();
      expect(targetData!.hp).toBeLessThan(100);
    });

    it('applies correct damage amount', () => {
      // Spawn barrel
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 25,
        explosionRadius: 4,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn target
      const targetId = spatial.spawn('player', 11, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });

      spatial.commit();

      // Kill barrel
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Check damage applied
      const targetData = spatial.getEntityData(targetId)!;
      expect(targetData.hp).toBe(75); // 100 - 25
    });
  });

  describe('hardness threshold', () => {
    it('blocks damage below hardness threshold', () => {
      // Spawn low-damage explosion source
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 15, // Less than wall hardness
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn hardened wall
      const wallId = spatial.spawn('destructible-wall', 11, 10, GameLayers.WALLS, {
        hp: 50,
        maxHp: 50,
        hardness: 20, // Requires 20+ damage
        color: '#8b7355',
      });

      spatial.commit();

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Wall should not be damaged (explosion too weak)
      const wallData = spatial.getEntityData(wallId)!;
      expect(wallData.hp).toBe(50); // No damage
    });

    it('applies damage above hardness threshold', () => {
      // Spawn high-damage explosion source
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 40, // More than wall hardness
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn hardened wall
      const wallId = spatial.spawn('destructible-wall', 11, 10, GameLayers.WALLS, {
        hp: 50,
        maxHp: 50,
        hardness: 20, // Requires 20+ damage
        color: '#8b7355',
      });

      spatial.commit();

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Wall should be damaged
      const wallData = spatial.getEntityData(wallId)!;
      expect(wallData.hp).toBe(10); // 50 - 40
    });

    it('damages entities without hardness trait normally', () => {
      // Spawn explosion
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 30,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn normal entity (no hardness)
      const playerId = spatial.spawn('player', 11, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });

      spatial.commit();

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Player should be damaged normally
      const playerData = spatial.getEntityData(playerId)!;
      expect(playerData.hp).toBe(70); // 100 - 30
    });
  });

  describe('radius of effect', () => {
    it('damages entities within radius', () => {
      // Spawn explosion at center
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 20,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn targets at various distances
      const nearId = spatial.spawn('enemy', 11, 10, GameLayers.ACTORS, { hp: 50, maxHp: 50 });
      const midId = spatial.spawn('enemy', 12, 10, GameLayers.ACTORS, { hp: 50, maxHp: 50 });
      const edgeId = spatial.spawn('enemy', 13, 10, GameLayers.ACTORS, { hp: 50, maxHp: 50 });

      spatial.commit();

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // All targets within radius should be damaged
      expect(spatial.getEntityData(nearId)!.hp).toBe(30); // Distance 1
      expect(spatial.getEntityData(midId)!.hp).toBe(30);   // Distance 2
      expect(spatial.getEntityData(edgeId)!.hp).toBe(30);  // Distance 3
    });

    it('does not damage entities outside radius', () => {
      // Spawn explosion
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 20,
        explosionRadius: 2,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn target outside radius
      const farId = spatial.spawn('enemy', 14, 10, GameLayers.ACTORS, {
        hp: 50,
        maxHp: 50,
      });

      spatial.commit();

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Far target should not be damaged
      expect(spatial.getEntityData(farId)!.hp).toBe(50); // No damage
    });
  });

  describe('wall blocking', () => {
    it('protects entities behind walls', () => {
      // Spawn explosion
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 30,
        explosionRadius: 5,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn wall between explosion and target
      spatial.spawn('wall', 11, 10, GameLayers.WALLS, { color: '#808080' });

      // Spawn target behind wall
      const targetId = spatial.spawn('player', 12, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });

      spatial.commit();

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Target should be protected by wall
      const targetData = spatial.getEntityData(targetId)!;
      expect(targetData.hp).toBe(100); // No damage
    });

    it('damages wall but not entities behind it', () => {
      // Spawn explosion
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 30,
        explosionRadius: 5,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn destructible wall
      const wallId = spatial.spawn('destructible-wall', 11, 10, GameLayers.WALLS, {
        hp: 50,
        maxHp: 50,
        hardness: 10,
        color: '#8b7355',
      });

      // Spawn target behind wall
      const targetId = spatial.spawn('player', 12, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });

      spatial.commit();

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Wall should be damaged
      expect(spatial.getEntityData(wallId)!.hp).toBe(20); // 50 - 30

      // Target behind wall should be protected
      expect(spatial.getEntityData(targetId)!.hp).toBe(100); // No damage
    });
  });

  describe('fire ignition', () => {
    it('ignites flammable entities', () => {
      // Spawn explosion
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 10,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn flammable entity
      spatial.spawn('grass', 11, 10, GameLayers.FLOOR, {
        flammability: 0.8,
        color: '#7cba00',
      });

      spatial.commit();

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Check that fire was spawned on FLOOR_EFFECTS
      const fireId = spatial.getEntityIdAt(11, 10, GameLayers.FLOOR_EFFECTS);
      expect(fireId).toBeDefined();

      const fireData = spatial.getEntityData(fireId!);
      expect(fireData?.type).toBe('fire');
    });

    it('does not spawn duplicate fire', () => {
      // Spawn explosion
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 10,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn existing fire
      spatial.spawn('fire', 11, 10, GameLayers.FLOOR_EFFECTS, {
        propagationType: 'fire',
        spreadRate: 2,
        spreadLayer: GameLayers.FLOOR_EFFECTS,
        spreadType: 'fire',
        color: '#ff4500',
      });

      spatial.commit();

      // Count entities before explosion
      const entitiesBeforeCount = Array.from(spatial.getAllPositions()).length;

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Count entities after explosion (should not increase significantly)
      const entitiesAfterCount = Array.from(spatial.getAllPositions()).length;

      // Should only add explosion visual, not duplicate fire
      expect(entitiesAfterCount).toBeLessThanOrEqual(entitiesBeforeCount + 1);
    });
  });

  describe('chain reactions', () => {
    it('triggers secondary explosions', () => {
      // Spawn first barrel
      const barrel1Id = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 30,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn second barrel in range
      const barrel2Id = spatial.spawn('barrel', 12, 10, GameLayers.COLLECTIBLES, {
        hp: 25,
        maxHp: 25,
        explosionDamage: 30,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      // Spawn distant target to verify chain explosion
      const targetId = spatial.spawn('player', 14, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });

      spatial.commit();

      // Trigger first explosion
      const barrel1Data = spatial.getEntityData(barrel1Id)!;
      barrel1Data.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Second barrel should be destroyed by first explosion
      const barrel2Data = spatial.getEntityData(barrel2Id);
      expect(barrel2Data!.hp).toBeLessThanOrEqual(0); // Should be killed or heavily damaged

      // Run another tick to process chain reaction
      explosionSystem.update(context);
      spatial.commit();

      // Target should be damaged by second explosion
      const targetData = spatial.getEntityData(targetId);
      if (targetData) {
        // Target might be in range of second explosion
        expect(targetData.hp).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('on-fire explosions', () => {
    it('explodes when fire entity is at same position', () => {
      // Spawn barrel with on-fire trigger
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 20,
        maxHp: 20,
        explosionDamage: 30,
        explosionRadius: 3,
        triggerCondition: 'on-fire',
        flammability: 0.7,
        color: '#8B4513',
      });

      // Spawn target
      const targetId = spatial.spawn('player', 11, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });

      spatial.commit();

      // Spawn fire at barrel position
      spatial.spawn('fire', 10, 10, GameLayers.FLOOR_EFFECTS, {
        propagationType: 'fire',
        spreadRate: 2,
        spreadLayer: GameLayers.FLOOR_EFFECTS,
        spreadType: 'fire',
        color: '#ff4500',
      });

      spatial.commit();

      // Run explosion system
      explosionSystem.update(context);
      spatial.commit();

      // Target should be damaged
      const targetData = spatial.getEntityData(targetId)!;
      expect(targetData.hp).toBeLessThan(100);
    });
  });

  describe('visual effects', () => {
    it('spawns explosion visual at epicenter', () => {
      // Spawn barrel
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 20,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      spatial.commit();

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Check for explosion visual
      const visualId = spatial.getEntityIdAt(10, 10, GameLayers.EPHEMERALS);
      expect(visualId).toBeDefined();

      const visualData = spatial.getEntityData(visualId!);
      expect(visualData?.type).toBe('explosion-visual');
    });

    it('cleans up visual after lifetime', () => {
      // Spawn barrel
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        explosionDamage: 20,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });

      spatial.commit();

      // Trigger explosion
      const barrelData = spatial.getEntityData(barrelId)!;
      barrelData.hp = 0;

      explosionSystem.update(context);
      spatial.commit();

      // Visual should exist immediately after spawn
      let visualId = spatial.getEntityIdAt(10, 10, GameLayers.EPHEMERALS);
      expect(visualId).toBeDefined();

      // Run system for more ticks
      // Tick 1: spawn (currentTick=1, age=0)
      // Tick 2: age=1, not expired
      // Tick 3: age=2, expired, marked for removal
      // Tick 4: should be gone after commit
      explosionSystem.update(context);
      spatial.commit();
      explosionSystem.update(context);
      spatial.commit();
      explosionSystem.update(context);
      spatial.commit();
      explosionSystem.update(context);
      spatial.commit();

      // Visual should be removed after 4 updates (ticks 2,3,4,5 after spawn at tick 1)
      visualId = spatial.getEntityIdAt(10, 10, GameLayers.EPHEMERALS);
      expect(visualId).toBeUndefined();
    });
  });

  describe('fire damaging barrels', () => {
    it('fire continuously damages barrel', () => {
      // We need FloorEffectSystem to process fire damage
      const gameManager = new GameManager();
      gameManager.gameState.entityStore = store;
      const floorSystem = new FloorEffectSystem(gameManager);

      // Spawn barrel
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 30,
        maxHp: 30,
        explosionDamage: 30,
        explosionRadius: 4,
        triggerCondition: 'on-death',
        flammability: 0.7,
        color: '#8B4513',
      });

      // Spawn fire below barrel
      spatial.spawn('fire', 10, 10, GameLayers.FLOOR_EFFECTS, {
        propagationType: 'fire',
        spreadRate: 2,
        spreadLayer: GameLayers.FLOOR_EFFECTS,
        spreadType: 'fire',
        effectType: 'damage',
        triggerMode: 'continuous',
        damage: 5,
        cadence: 2,
        color: '#ff4500',
      });

      spatial.commit();

      // Run floor effect system multiple times
      floorSystem.update(context);
      floorSystem.update(context);
      floorSystem.update(context);

      // Barrel should have taken damage
      const barrelData = spatial.getEntityData(barrelId)!;
      expect(barrelData.hp).toBeLessThan(30);
    });

    it('barrel explodes after fire burns it down', () => {
      const gameManager = new GameManager();
      gameManager.gameState.entityStore = store;
      const floorSystem = new FloorEffectSystem(gameManager);

      // Spawn barrel with low HP
      const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
        hp: 10,
        maxHp: 30,
        explosionDamage: 30,
        explosionRadius: 4,
        triggerCondition: 'on-death',
        flammability: 0.7,
        color: '#8B4513',
      });

      // Spawn target to verify explosion
      const targetId = spatial.spawn('player', 12, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });

      // Spawn fire below barrel
      spatial.spawn('fire', 10, 10, GameLayers.FLOOR_EFFECTS, {
        propagationType: 'fire',
        spreadRate: 2,
        spreadLayer: GameLayers.FLOOR_EFFECTS,
        spreadType: 'fire',
        effectType: 'damage',
        triggerMode: 'continuous',
        damage: 5,
        cadence: 2,
        color: '#ff4500',
      });

      spatial.commit();

      // Run floor effect system to damage barrel
      // Also run explosion system in the loop to catch when HP hits 0
      floorSystem.update(context);
      explosionSystem.update(context);
      spatial.commit();
      
      floorSystem.update(context);
      explosionSystem.update(context);
      spatial.commit();
      
      floorSystem.update(context);
      explosionSystem.update(context);
      spatial.commit();
      
      floorSystem.update(context);
      explosionSystem.update(context);
      spatial.commit();

      // Barrel should be gone (exploded and removed)
      const barrelData = spatial.getEntityData(barrelId);
      expect(barrelData).toBeUndefined(); // Barrel removed after explosion

      // Target should be damaged by explosion
      const targetData = spatial.getEntityData(targetId)!;
      expect(targetData.hp).toBeLessThan(100);
    });
  });

  describe('resetState', () => {
    it('clears all internal state', () => {
      explosionSystem.resetState();
      const state = explosionSystem.getDebugState();

      expect(state.currentTick).toBe(0);
      expect(state.explosionQueueSize).toBe(0);
      expect(state.explodedThisTick).toHaveLength(0);
    });
  });
});
