/**
 * Effects Integration Tests (Phase 4c)
 *
 * Tests that systems correctly push visual effects to the EffectsQueue.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedGrid, SpatialSystem } from '../core';
import { SparseEntityStore } from '../core/entity-store';
import { GameLoop } from '../core/game-loop';
import { GameManager } from '../core/game-manager';
import { VisualEventBus } from '../core/visual-event-bus';
import { EffectsQueue } from '../core/effects-queue';
import { VisualStateSystem } from '../systems/visual-state.system';
import { HealthSystem } from '../systems/health.system';
import { ExplosionSystem } from '../systems/explosion.system';
import { FireSystem } from '../systems/fire.system';
import { GameLayers } from '../config/layers.config';

describe('Effects Integration (Phase 4c)', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let effectsQueue: EffectsQueue;
  let eventBus: VisualEventBus;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameManager = new GameManager();
    effectsQueue = new EffectsQueue();
    eventBus = new VisualEventBus();
    gameLoop = new GameLoop(spatial, gameManager);
  });

  // === HealthSystem Effects ===

  describe('HealthSystem effects', () => {
    let healthSystem: HealthSystem;

    beforeEach(() => {
      healthSystem = new HealthSystem({}, effectsQueue);
      gameLoop.addSystem(healthSystem);
      gameLoop.addSystem(new VisualStateSystem(eventBus, effectsQueue));
    });

    it('should push blood particle on damage', () => {
      // Arrange
      const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        healthState: 'alive',
      });
      spatial.commit();

      // Act
      healthSystem.damage(id, 20);
      gameLoop.tick();

      // Assert
      const effects = effectsQueue.drain();
      const bloodEffects = effects.filter(
        (fx) => fx.type === 'particle' && fx.preset === 'blood'
      );
      expect(bloodEffects.length).toBeGreaterThanOrEqual(1);
      if (bloodEffects[0].type === 'particle') {
        expect(bloodEffects[0].x).toBe(5);
        expect(bloodEffects[0].y).toBe(5);
      }
    });

    it('should set visual state to hurt on damage', () => {
      // Arrange
      const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        healthState: 'alive',
        visualState: 'idle',
        visualDirty: false,
      });
      spatial.commit();

      // Act
      healthSystem.damage(id, 20);
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      // After VisualStateSystem clears the dirty flag, visualState should be 'hurt'
      // (the entity:state-changed event carried 'hurt')
      expect(entity?.visualState).toBe('hurt');
    });

    it('should set visual state to die on death', () => {
      // Arrange
      const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
        hp: 10,
        maxHp: 100,
        healthState: 'alive',
        visualState: 'idle',
        visualDirty: false,
      });
      spatial.commit();

      // Act -- lethal damage
      healthSystem.damage(id, 100);
      gameLoop.tick();

      // Assert
      const entity = spatial.getEntityData(id);
      // Entity should be in dying state with visualState 'die'
      expect(entity?.healthState).toBe('dying');
      expect(entity?.visualState).toBe('die');
    });

    it('should push smoke particle on entity death removal', () => {
      // Arrange
      spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
        hp: 10,
        maxHp: 100,
        healthState: 'alive',
      });
      spatial.commit();

      // Kill the entity
      const entityId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
      healthSystem.damage(entityId, 100);
      gameLoop.tick(); // dying state

      // Fast-forward through dying ticks
      gameLoop.tick();
      gameLoop.tick();
      gameLoop.tick(); // should transition to dead and be removed

      // Assert
      const effects = effectsQueue.drain();
      const smokeEffects = effects.filter(
        (fx) => fx.type === 'particle' && fx.preset === 'smoke'
      );
      expect(smokeEffects.length).toBeGreaterThanOrEqual(1);
    });

    it('should push heal particle on healing', () => {
      // Arrange
      const id = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        hp: 50,
        maxHp: 100,
        healthState: 'alive',
      });
      spatial.commit();

      // Act
      healthSystem.heal(id, 30);
      gameLoop.tick();

      // Assert
      const effects = effectsQueue.drain();
      const healEffects = effects.filter(
        (fx) => fx.type === 'particle' && fx.preset === 'heal'
      );
      expect(healEffects.length).toBeGreaterThanOrEqual(1);
    });
  });

  // === ExplosionSystem Effects ===

  describe('ExplosionSystem effects', () => {
    let healthSystem: HealthSystem;

    beforeEach(() => {
      healthSystem = new HealthSystem({}, effectsQueue);
      const explosionSystem = new ExplosionSystem(effectsQueue);
      gameLoop.addSystem(explosionSystem);
      gameLoop.addSystem(healthSystem);
      gameLoop.addSystem(new VisualStateSystem(eventBus, effectsQueue));
    });

    it('should push shake + particle + area on explosion', () => {
      // Arrange -- create a barrel that will explode
      const barrelId = spatial.spawn('barrel', 5, 5, GameLayers.COLLECTIBLES, {
        hp: 1,
        maxHp: 20,
        healthState: 'alive',
        explosionDamage: 30,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        flammable: false,
        temperature: 0,
        flamePoint: 100,
      });
      spatial.commit();

      // Kill the barrel to trigger explosion
      healthSystem.damage(barrelId, 100);
      gameLoop.tick(); // damage applied, barrel at 0 hp
      // Drain damage effects (blood from barrel taking damage)
      effectsQueue.drain();

      // Tick again -- barrel dying -> dead -> removed, and explosion system detects hp<=0
      gameLoop.tick();
      gameLoop.tick();
      gameLoop.tick(); // dying -> dead -> removed

      const effects = effectsQueue.drain();

      // Should have at least shake, particle, and area effects from explosion
      // (and possibly smoke from death)
      const shakeEffects = effects.filter((fx) => fx.type === 'shake');
      const particleEffects = effects.filter(
        (fx) => fx.type === 'particle' && fx.preset === 'explosion'
      );
      const areaEffects = effects.filter((fx) => fx.type === 'area');

      expect(shakeEffects.length).toBeGreaterThanOrEqual(1);
      expect(particleEffects.length).toBeGreaterThanOrEqual(1);
      expect(areaEffects.length).toBeGreaterThanOrEqual(1);
    });
  });

  // === FireSystem Effects ===

  describe('FireSystem effects', () => {
    beforeEach(() => {
      const fireSystem = new FireSystem(effectsQueue);
      gameLoop.addSystem(fireSystem);
      gameLoop.addSystem(new VisualStateSystem(eventBus, effectsQueue));
    });

    it('should push fire particle on ignition', () => {
      // Arrange -- create a flammable entity at ignition temperature
      spatial.spawn('grass', 5, 5, GameLayers.FLOOR, {
        temperature: 200,
        flammable: true,
        flamePoint: 100,
        hp: 10,
        maxHp: 10,
      });
      spatial.commit();

      // Act
      gameLoop.tick();

      // Assert
      const effects = effectsQueue.drain();
      const fireEffects = effects.filter(
        (fx) => fx.type === 'particle' && fx.preset === 'fire'
      );
      expect(fireEffects.length).toBeGreaterThanOrEqual(1);
    });
  });

  // === Combined Pipeline ===

  describe('full effects pipeline', () => {
    it('should accumulate multiple effects across systems in one tick', () => {
      // Arrange
      const healthSystem = new HealthSystem({}, effectsQueue);
      gameLoop.addSystem(healthSystem);
      gameLoop.addSystem(new VisualStateSystem(eventBus, effectsQueue));

      // Create two entities
      const id1 = spatial.spawn('enemy', 3, 3, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        healthState: 'alive',
      });
      const id2 = spatial.spawn('player', 7, 7, GameLayers.ACTORS, {
        hp: 50,
        maxHp: 100,
        healthState: 'alive',
      });
      spatial.commit();

      // Act -- damage one, heal another in same tick
      healthSystem.damage(id1, 20);
      healthSystem.heal(id2, 30);
      gameLoop.tick();

      // Assert
      const effects = effectsQueue.drain();
      expect(effects.length).toBeGreaterThanOrEqual(2); // blood + heal
      const types = effects.map((fx) => fx.type === 'particle' ? fx.preset : fx.type);
      expect(types).toContain('blood');
      expect(types).toContain('heal');
    });
  });
});
