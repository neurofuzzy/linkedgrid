/**
 * PowerupSystem Tests
 *
 * Tests for powerup collection and buff lifecycle management.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedGrid, SpatialSystem } from '../core';
import { SparseEntityStore } from '../core/entity-store';
import { GameLoop } from '../core/game-loop';
import { PowerupSystem } from '../systems/powerup.system';
import { HealthSystem } from '../systems/health.system';
import { GameLayers } from '../config/layers.config';
import type { PlayerData } from '../entities/player.entity';
import type { HealthPackData, HealthPotionData, ShieldPackData, SpeedBoostData, DamageBoostData, InvincibilityData, AmmoPackData } from '../entities/powerup.entity';
import type { HasBuff } from '../traits/buff.trait';
import { hasBuff } from '../traits/trait-guards';

describe('PowerupSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let healthSystem: HealthSystem;
  let powerupSystem: PowerupSystem;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    healthSystem = new HealthSystem();
    powerupSystem = new PowerupSystem({ healthSystem });
    gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(powerupSystem);
  });

  function createPlayer(x: number, y: number, hp: number = 100, maxHp: number = 100): number {
    const playerData: Partial<PlayerData> = {
      type: 'player',
      hp,
      maxHp,
      damage: 10,
      healthState: 'alive',
      speed: 1,
      inventory: [],
    };
    return spatial.spawn('player', x, y, GameLayers.ACTORS, playerData);
  }

  function createHealthPack(x: number, y: number, healAmount: number = 25): number {
    const packData: Partial<HealthPackData> = {
      type: 'health-pack',
      healAmount,
      collectibleType: 'powerup',
      collectibleId: 'health-pack-1',
      color: '#00ff00',
    };
    return spatial.spawn('health-pack', x, y, GameLayers.COLLECTIBLES, packData);
  }

  function createShieldPack(x: number, y: number, shieldAmount: number = 50, duration?: number): number {
    const packData: Partial<ShieldPackData> = {
      type: 'shield-pack',
      shieldAmount,
      duration,
      collectibleType: 'powerup',
      collectibleId: 'shield-pack-1',
      color: '#0000ff',
    };
    return spatial.spawn('shield-pack', x, y, GameLayers.COLLECTIBLES, packData);
  }

  function createSpeedBoost(x: number, y: number, speedMultiplier: number = 1.5, duration: number = 10): number {
    const boostData: Partial<SpeedBoostData> = {
      type: 'speed-boost',
      speedMultiplier,
      duration,
      collectibleType: 'powerup',
      collectibleId: 'speed-boost-1',
      color: '#ffff00',
    };
    return spatial.spawn('speed-boost', x, y, GameLayers.COLLECTIBLES, boostData);
  }

  function createDamageBoost(x: number, y: number, damageMultiplier: number = 2.0, duration: number = 10): number {
    const boostData: Partial<DamageBoostData> = {
      type: 'damage-boost',
      damageMultiplier,
      duration,
      collectibleType: 'powerup',
      collectibleId: 'damage-boost-1',
      color: '#ff0000',
    };
    return spatial.spawn('damage-boost', x, y, GameLayers.COLLECTIBLES, boostData);
  }

  function createInvincibility(x: number, y: number, duration: number = 5): number {
    const invincData: Partial<InvincibilityData> = {
      type: 'invincibility',
      duration,
      collectibleType: 'powerup',
      collectibleId: 'invincibility-1',
      color: '#ffffff',
    };
    return spatial.spawn('invincibility', x, y, GameLayers.COLLECTIBLES, invincData);
  }

  function createAmmoPack(x: number, y: number, weaponType: string = 'pistol', ammoAmount: number = 20): number {
    const ammoData: Partial<AmmoPackData> = {
      type: 'ammo-pack',
      weaponType,
      ammoAmount,
      collectibleType: 'powerup',
      collectibleId: 'ammo-pack-1',
      color: '#888888',
    };
    return spatial.spawn('ammo-pack', x, y, GameLayers.COLLECTIBLES, ammoData);
  }

  describe('Health Pack', () => {
    it('heals player when collected', () => {
      const playerId = createPlayer(5, 5, 50, 100);
      createHealthPack(5, 5, 25);
      spatial.commit();

      gameLoop.tick();

      const playerData = spatial.getEntityData(playerId) as PlayerData;
      expect(playerData.hp).toBe(75);
    });

    it('removes health pack after collection', () => {
      createPlayer(5, 5, 50, 100);
      const packId = createHealthPack(5, 5, 25);
      spatial.commit();

      gameLoop.tick();

      expect(spatial.getEntityData(packId)).toBeUndefined();
    });

    it('does not heal beyond max HP', () => {
      const playerId = createPlayer(5, 5, 90, 100);
      createHealthPack(5, 5, 25);
      spatial.commit();

      gameLoop.tick();

      const playerData = spatial.getEntityData(playerId) as PlayerData;
      expect(playerData.hp).toBe(100);
    });

    it('does not consume if player at full health', () => {
      createPlayer(5, 5, 100, 100);
      const packId = createHealthPack(5, 5, 25);
      spatial.commit();

      gameLoop.tick();

      // Pack should still exist
      expect(spatial.getEntityData(packId)).toBeDefined();
    });
  });

  describe('Shield Pack', () => {
    it('grants shield to player without shield', () => {
      const playerId = createPlayer(5, 5);
      createShieldPack(5, 5, 50);
      spatial.commit();

      gameLoop.tick();

      const playerData = spatial.getEntityData(playerId) as PlayerData & { shield: number; maxShield: number };
      expect(playerData.shield).toBe(50);
      expect(playerData.maxShield).toBe(50);
    });

    it('restores shield to player with existing shield', () => {
      const playerId = createPlayer(5, 5);
      const playerData = spatial.getEntityData(playerId) as PlayerData & { shield: number; maxShield: number };
      playerData.shield = 20;
      playerData.maxShield = 100;

      createShieldPack(5, 5, 30);
      spatial.commit();

      gameLoop.tick();

      const updated = spatial.getEntityData(playerId) as PlayerData & { shield: number; maxShield: number };
      expect(updated.shield).toBe(50);
    });

    it('temporary shield creates buff with expiration', () => {
      const playerId = createPlayer(5, 5);
      createShieldPack(5, 5, 50, 10); // 10 tick duration
      spatial.commit();

      gameLoop.tick();

      const playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(hasBuff(playerData)).toBe(true);
      expect(playerData.activeBuffs.some(b => b.type === 'shield')).toBe(true);
    });
  });

  describe('Speed Boost', () => {
    it('applies speed buff to player', () => {
      const playerId = createPlayer(5, 5);
      createSpeedBoost(5, 5, 1.5, 10);
      spatial.commit();

      gameLoop.tick();

      const playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(hasBuff(playerData)).toBe(true);
      const speedBuff = playerData.activeBuffs.find(b => b.type === 'speed');
      expect(speedBuff).toBeDefined();
      expect(speedBuff?.magnitude).toBe(1.5);
    });

    it('removes speed boost powerup after collection', () => {
      createPlayer(5, 5);
      const boostId = createSpeedBoost(5, 5);
      spatial.commit();

      gameLoop.tick();

      expect(spatial.getEntityData(boostId)).toBeUndefined();
    });
  });

  describe('Damage Boost', () => {
    it('applies damage buff to player', () => {
      const playerId = createPlayer(5, 5);
      createDamageBoost(5, 5, 2.0, 10);
      spatial.commit();

      gameLoop.tick();

      const playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(hasBuff(playerData)).toBe(true);
      const damageBuff = playerData.activeBuffs.find(b => b.type === 'damage');
      expect(damageBuff).toBeDefined();
      expect(damageBuff?.magnitude).toBe(2.0);
    });
  });

  describe('Invincibility', () => {
    it('applies invincibility buff to player', () => {
      const playerId = createPlayer(5, 5);
      createInvincibility(5, 5, 5);
      spatial.commit();

      gameLoop.tick();

      const playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(hasBuff(playerData)).toBe(true);
      const invincBuff = playerData.activeBuffs.find(b => b.type === 'invincibility');
      expect(invincBuff).toBeDefined();
      expect(invincBuff?.magnitude).toBe(1);
    });
  });

  describe('Ammo Pack', () => {
    it('adds ammo to player with weapon', () => {
      const playerId = createPlayer(5, 5);
      const playerData = spatial.getEntityData(playerId) as PlayerData & { equippedWeapon: string; ammo: Record<string, number> };
      playerData.equippedWeapon = 'pistol';
      playerData.ammo = { pistol: 10 };

      createAmmoPack(5, 5, 'pistol', 20);
      spatial.commit();

      gameLoop.tick();

      const updated = spatial.getEntityData(playerId) as PlayerData & { ammo: Record<string, number> };
      expect(updated.ammo.pistol).toBe(30);
    });

    it('initializes ammo for new weapon type', () => {
      const playerId = createPlayer(5, 5);
      const playerData = spatial.getEntityData(playerId) as PlayerData & { equippedWeapon: string; ammo: Record<string, number> };
      playerData.equippedWeapon = 'pistol';
      playerData.ammo = {};

      createAmmoPack(5, 5, 'shotgun', 8);
      spatial.commit();

      gameLoop.tick();

      const updated = spatial.getEntityData(playerId) as PlayerData & { ammo: Record<string, number> };
      expect(updated.ammo.shotgun).toBe(8);
    });

    it('does not collect if player has no weapon trait', () => {
      createPlayer(5, 5); // No weapon trait
      const ammoId = createAmmoPack(5, 5, 'pistol', 20);
      spatial.commit();

      gameLoop.tick();

      // Ammo pack should still exist
      expect(spatial.getEntityData(ammoId)).toBeDefined();
    });
  });

  describe('Buff Expiration', () => {
    it('removes expired buffs after duration', () => {
      const playerId = createPlayer(5, 5);
      createSpeedBoost(5, 5, 1.5, 3); // 3 tick duration
      spatial.commit();

      // Tick 1: Collect powerup (expiration set to tick 1+3=4)
      gameLoop.tick();
      let playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(playerData.activeBuffs.length).toBe(1);

      // Tick 2, 3: Buff still active
      gameLoop.tick();
      gameLoop.tick();
      playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(playerData.activeBuffs.length).toBe(1);

      // Tick 4: Buff expires (expirationTick=4, currentTick=4)
      gameLoop.tick();
      playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(playerData.activeBuffs.length).toBe(0);
    });

    it('refreshes existing buff instead of stacking', () => {
      const playerId = createPlayer(5, 5);

      // First speed boost
      createSpeedBoost(5, 5, 1.5, 5);
      spatial.commit();
      gameLoop.tick();

      let playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(playerData.activeBuffs.length).toBe(1);
      const firstExpiration = playerData.activeBuffs[0].expirationTick;

      // Move player away and back with new speed boost
      spatial.move(playerId, 6, 5);
      spatial.commit();
      createSpeedBoost(5, 5, 2.0, 10); // Higher multiplier, longer duration
      spatial.commit();

      spatial.move(playerId, 5, 5);
      spatial.commit();
      gameLoop.tick();

      playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      // Should still be 1 buff, not 2
      expect(playerData.activeBuffs.length).toBe(1);
      // Should have the new values
      expect(playerData.activeBuffs[0].magnitude).toBe(2.0);
      expect(playerData.activeBuffs[0].expirationTick).toBeGreaterThan(firstExpiration);
    });
  });

  describe('Health Potion (heal-over-time)', () => {
    function createHealthPotion(x: number, y: number, regenPerTick: number = 2, duration: number = 5): number {
      const potionData: Partial<HealthPotionData> = {
        type: 'health-potion',
        regenPerTick,
        duration,
        collectibleType: 'powerup',
        collectibleId: 'health-potion-1',
        color: '#ff00ff',
      };
      return spatial.spawn('health-potion', x, y, GameLayers.COLLECTIBLES, potionData);
    }

    it('applies health-regen buff when collected by hurt player', () => {
      const playerId = createPlayer(5, 5, 60, 100);
      createHealthPotion(5, 5, 3, 10);
      spatial.commit();

      gameLoop.tick(); // tick 1: collect potion

      const playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(hasBuff(playerData)).toBe(true);
      const regenBuff = playerData.activeBuffs.find(b => b.type === 'health-regen');
      expect(regenBuff).toBeDefined();
      expect(regenBuff?.magnitude).toBe(3);
    });

    it('does not collect if player is at full health', () => {
      createPlayer(5, 5, 100, 100);
      const potionId = createHealthPotion(5, 5, 3, 10);
      spatial.commit();

      gameLoop.tick();

      // Potion should still be there
      expect(spatial.getEntityData(potionId)).toBeDefined();
    });

    it('heals player each tick while buff is active', () => {
      const playerId = createPlayer(5, 5, 50, 100);
      createHealthPotion(5, 5, 5, 4); // 5 HP/tick for 4 ticks
      spatial.commit();

      // tick 1: collect + first regen applied
      gameLoop.tick();
      let pd = spatial.getEntityData(playerId) as PlayerData;
      expect(pd.hp).toBe(55); // 50 + 5

      // tick 2
      gameLoop.tick();
      pd = spatial.getEntityData(playerId) as PlayerData;
      expect(pd.hp).toBe(60); // 55 + 5

      // tick 3
      gameLoop.tick();
      pd = spatial.getEntityData(playerId) as PlayerData;
      expect(pd.hp).toBe(65); // 60 + 5

      // tick 4
      gameLoop.tick();
      pd = spatial.getEntityData(playerId) as PlayerData;
      expect(pd.hp).toBe(70); // 65 + 5
    });

    it('does not heal beyond maxHp', () => {
      const playerId = createPlayer(5, 5, 95, 100);
      createHealthPotion(5, 5, 10, 5); // 10 HP/tick, only needs 5
      spatial.commit();

      // tick 1: collect + first regen (capped at 100)
      gameLoop.tick();
      let pd = spatial.getEntityData(playerId) as PlayerData;
      expect(pd.hp).toBe(100);

      // tick 2: already at max, no further healing
      gameLoop.tick();
      pd = spatial.getEntityData(playerId) as PlayerData;
      expect(pd.hp).toBe(100);
    });

    it('HP gained stays after buff expires', () => {
      const playerId = createPlayer(5, 5, 50, 100);
      createHealthPotion(5, 5, 5, 3); // 5 HP/tick for 3 ticks
      spatial.commit();

      // tick 1: collect + regen -> 55
      gameLoop.tick();
      // tick 2: regen -> 60
      gameLoop.tick();
      // tick 3: regen -> 65
      gameLoop.tick();
      // tick 4: buff expires (expirationTick = 1+3 = 4)
      gameLoop.tick();

      const pd = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      // HP should NOT be reverted
      expect(pd.hp).toBe(65);
      // Buff should be expired and removed
      const regenBuff = pd.activeBuffs?.find(b => b.type === 'health-regen');
      expect(regenBuff).toBeUndefined();
    });

    it('removes potion entity after collection', () => {
      createPlayer(5, 5, 60, 100);
      const potionId = createHealthPotion(5, 5, 3, 10);
      spatial.commit();

      gameLoop.tick();

      expect(spatial.getEntityData(potionId)).toBeUndefined();
    });
  });

  describe('Static Helper Methods', () => {
    it('hasActiveBuff returns true for active buff', () => {
      const playerId = createPlayer(5, 5);
      createSpeedBoost(5, 5, 1.5, 10);
      spatial.commit();
      gameLoop.tick();

      const playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(PowerupSystem.hasActiveBuff(playerData, 'speed')).toBe(true);
      expect(PowerupSystem.hasActiveBuff(playerData, 'damage')).toBe(false);
    });

    it('getBuffMagnitude returns correct value', () => {
      const playerId = createPlayer(5, 5);
      createDamageBoost(5, 5, 2.5, 10);
      spatial.commit();
      gameLoop.tick();

      const playerData = spatial.getEntityData(playerId) as PlayerData & HasBuff;
      expect(PowerupSystem.getBuffMagnitude(playerData, 'damage')).toBe(2.5);
      expect(PowerupSystem.getBuffMagnitude(playerData, 'speed')).toBe(0);
    });
  });
});
