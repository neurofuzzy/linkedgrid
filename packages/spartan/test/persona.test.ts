/**
 * Character Persona Tests
 *
 * Tests for persona-based NPC spawning and configuration.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedGrid, SpatialSystem } from '../core';
import { SparseEntityStore } from '../core/entity-store';
import { GameLayers } from '../config/layers.config';
import { CHARACTER_PERSONAS, getPersona } from '../config/personas.config';
import { spawnNPC, spawnNPCFromPersona, spawnCoin, spawnFlag, spawnExit } from '../entities/spawn-helpers';
import { hasHealth, hasScoreValue, isEnemy, isCoin, isFlag, isExit } from '../traits/trait-guards';

describe('Character Personas', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
  });

  describe('persona config', () => {
    it('should have player-default persona', () => {
      const persona = getPersona('player-default');
      expect(persona).toBeDefined();
      expect(persona!.hp).toBe(100);
      expect(persona!.name).toBe('Player');
    });

    it('should have all four NPC tiers', () => {
      expect(getPersona('grunt')).toBeDefined();
      expect(getPersona('soldier')).toBeDefined();
      expect(getPersona('elite')).toBeDefined();
      expect(getPersona('boss')).toBeDefined();
    });

    it('should have increasing stats across tiers', () => {
      const grunt = CHARACTER_PERSONAS['grunt'];
      const soldier = CHARACTER_PERSONAS['soldier'];
      const elite = CHARACTER_PERSONAS['elite'];
      const boss = CHARACTER_PERSONAS['boss'];

      // HP increases with tier
      expect(grunt.hp).toBeLessThan(soldier.hp);
      expect(soldier.hp).toBeLessThan(elite.hp);
      expect(elite.hp).toBeLessThan(boss.hp);

      // Score value increases with tier
      expect(grunt.scoreValue!).toBeLessThan(soldier.scoreValue!);
      expect(soldier.scoreValue!).toBeLessThan(elite.scoreValue!);
      expect(elite.scoreValue!).toBeLessThan(boss.scoreValue!);
    });
  });

  describe('spawnNPC', () => {
    it('should spawn a grunt with correct default stats', () => {
      const id = spawnNPC(spatial, 5, 5, 'grunt', { sceneId: 'test' });
      spatial.commit();

      const data = spatial.getEntityData(id)!;
      expect(data.type).toBe('enemy');
      expect(hasHealth(data)).toBe(true);
      if (hasHealth(data)) {
        expect(data.hp).toBe(30);
        expect(data.maxHp).toBe(30);
      }
      expect(data.damage).toBe(5);
    });

    it('should spawn a soldier with armor', () => {
      const id = spawnNPC(spatial, 5, 5, 'soldier', { sceneId: 'test' });
      spatial.commit();

      const data = spatial.getEntityData(id)!;
      expect(data.armor).toBe(2);
    });

    it('should spawn an elite with hardness and armor', () => {
      const id = spawnNPC(spatial, 5, 5, 'elite', { sceneId: 'test' });
      spatial.commit();

      const data = spatial.getEntityData(id)!;
      expect(data.armor).toBe(5);
      expect(data.hardness).toBe(3);
    });

    it('should spawn a boss with shields', () => {
      const id = spawnNPC(spatial, 5, 5, 'boss', { sceneId: 'test' });
      spatial.commit();

      const data = spatial.getEntityData(id)!;
      expect(data.shield).toBe(50);
      expect(data.maxShield).toBe(50);
    });

    it('should apply per-instance overrides', () => {
      const id = spawnNPC(spatial, 5, 5, 'grunt', {
        sceneId: 'test',
        hp: 999,
        maxHp: 999,
        color: '#00ff00',
      });
      spatial.commit();

      const data = spatial.getEntityData(id)!;
      if (hasHealth(data)) {
        expect(data.hp).toBe(999);
        expect(data.maxHp).toBe(999);
      }
      expect(data.color).toBe('#00ff00');
    });

    it('should include scoreValue from persona', () => {
      const id = spawnNPC(spatial, 5, 5, 'soldier', { sceneId: 'test' });
      spatial.commit();

      const data = spatial.getEntityData(id)!;
      expect(hasScoreValue(data)).toBe(true);
      if (hasScoreValue(data)) {
        expect(data.scoreValue).toBe(25);
      }
    });

    it('should throw for unknown persona', () => {
      expect(() => spawnNPC(spatial, 5, 5, 'nonexistent')).toThrow();
    });

    it('should include movement mode from persona', () => {
      const id = spawnNPC(spatial, 5, 5, 'grunt', { sceneId: 'test' });
      spatial.commit();

      const data = spatial.getEntityData(id)!;
      expect(data.movementMode).toBe('pursue');
      expect(data.speed).toBe(3);
    });
  });

  describe('spawnNPCFromPersona', () => {
    it('should spawn from custom persona object', () => {
      const customPersona = {
        name: 'Custom',
        hp: 42,
        damage: 7,
        scoreValue: 15,
      };

      const id = spawnNPCFromPersona(spatial, 5, 5, customPersona, { sceneId: 'test' });
      spatial.commit();

      const data = spatial.getEntityData(id)!;
      if (hasHealth(data)) {
        expect(data.hp).toBe(42);
      }
      expect(data.damage).toBe(7);
    });
  });
});

describe('Objective Entity Spawn Helpers', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
  });

  it('should spawn a coin with scoreValue', () => {
    const id = spawnCoin(spatial, 5, 5, 10);
    spatial.commit();

    const data = spatial.getEntityData(id)!;
    expect(isCoin(data)).toBe(true);
    expect(data.scoreValue).toBe(10);
    expect(data.color).toBe('#ffd700');
  });

  it('should spawn a flag with objectiveId', () => {
    const id = spawnFlag(spatial, 5, 5, 'red-flag');
    spatial.commit();

    const data = spatial.getEntityData(id)!;
    expect(isFlag(data)).toBe(true);
    if (isFlag(data)) {
      expect(data.objectiveId).toBe('red-flag');
    }
  });

  it('should spawn an exit on FLOOR layer', () => {
    const id = spawnExit(spatial, 5, 5);
    spatial.commit();

    const data = spatial.getEntityData(id)!;
    expect(isExit(data)).toBe(true);

    const pos = spatial.getEntityPosition(id);
    expect(pos?.layer).toBe(GameLayers.FLOOR);
  });

  it('should accept color overrides', () => {
    const coinId = spawnCoin(spatial, 1, 1, 5, { color: '#silver' });
    const flagId = spawnFlag(spatial, 2, 2, 'blue', { color: '#0000ff' });
    const exitId = spawnExit(spatial, 3, 3, { color: '#ffffff' });
    spatial.commit();

    expect(spatial.getEntityData(coinId)!.color).toBe('#silver');
    expect(spatial.getEntityData(flagId)!.color).toBe('#0000ff');
    expect(spatial.getEntityData(exitId)!.color).toBe('#ffffff');
  });
});
