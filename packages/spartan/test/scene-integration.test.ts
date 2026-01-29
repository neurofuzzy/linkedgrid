import { describe, it, expect, beforeEach } from 'vitest';
import { SceneLoader, SceneConfig } from '../../../dev/scene-loader';
import { GameLayers } from '../index';

/**
 * Integration tests for scene loading and gameplay.
 * 
 * These tests load actual JSON scene configs and verify that:
 * - Scene loading works correctly
 * - Entity properties are loaded from JSON
 * - Game systems work together as expected
 * - Common errors (props vs data, collisions) are caught
 */
describe('Scene Integration Tests', () => {
  describe('Flammability Scene', () => {
    let loader: SceneLoader;

    beforeEach(() => {
      loader = new SceneLoader();
    });

    it('should load flammability scene without errors', () => {
      const config: SceneConfig = {
        scenes: [
          {
            id: 'test-scene',
            width: 15,
            height: 15,
            entities: [
              {
                type: 'fire',
                x: 3,
                y: 7,
                layer: GameLayers.COLLECTIBLES,
                data: {
                  propagationType: 'fire',
                  spreadRate: 2,
                  spreadProbability: 0.9,
                  spreadLayer: GameLayers.COLLECTIBLES,
                  spreadType: 'fire',
                  maxDistance: 10,
                  lifetime: 25,
                  color: '#ff0000',
                },
              },
              {
                type: 'grass',
                x: 4,
                y: 7,
                layer: GameLayers.COLLECTIBLES,
                data: {
                  flammability: 0.8,
                  color: '#00ff00',
                },
              },
              {
                type: 'grass',
                x: 5,
                y: 7,
                layer: GameLayers.COLLECTIBLES,
                data: {
                  flammability: 0.8,
                  color: '#00ff00',
                },
              },
            ],
          },
        ],
        initialScene: 'test-scene',
        systems: ['PropagationSystem'],
        tickRate: 100,
      };

      const runtime = loader.load(config);
      expect(runtime).toBeDefined();
      
      // Verify that runtime has expected structure
      expect(runtime.game).toBeDefined();
      expect((runtime as any).spatial).toBeDefined();
    });

    it('should spawn entities with correct properties from JSON', () => {
      const config: SceneConfig = {
        scenes: [
          {
            id: 'test-scene',
            width: 15,
            height: 15,
            entities: [
              {
                type: 'fire',
                x: 5,
                y: 5,
                layer: GameLayers.COLLECTIBLES,
                data: {
                  propagationType: 'fire',
                  spreadRate: 2,
                  spreadType: 'fire',
                  spreadLayer: GameLayers.COLLECTIBLES,
                  color: '#ff0000',
                },
              },
              {
                type: 'grass',
                x: 6,
                y: 5,
                layer: GameLayers.COLLECTIBLES,
                data: {
                  flammability: 0.9,
                  color: '#00ff00',
                },
              },
            ],
          },
        ],
        initialScene: 'test-scene',
        systems: ['PropagationSystem'],
      };

      const runtime = loader.load(config);
      const spatial = (runtime as any).spatial;

      // Verify fire entity has propagation properties
      const fireId = spatial.getEntityIdAt(5, 5, GameLayers.COLLECTIBLES);
      expect(fireId).toBeDefined();
      
      const fireData = spatial.getEntityData(fireId!);
      expect(fireData).toBeDefined();
      expect(fireData!.type).toBe('fire');
      expect((fireData as any).propagationType).toBe('fire');
      expect((fireData as any).spreadType).toBe('fire');
      expect((fireData as any).spreadRate).toBe(2);

      // Verify grass entity has flammability
      const grassId = spatial.getEntityIdAt(6, 5, GameLayers.COLLECTIBLES);
      expect(grassId).toBeDefined();
      
      const grassData = spatial.getEntityData(grassId!);
      expect(grassData).toBeDefined();
      expect(grassData!.type).toBe('grass');
      expect((grassData as any).flammability).toBe(0.9);
    });

    it('should propagate fire to adjacent grass over multiple ticks', () => {
      const config: SceneConfig = {
        scenes: [
          {
            id: 'test-scene',
            width: 15,
            height: 15,
            entities: [
              {
                type: 'fire',
                x: 5,
                y: 5,
                layer: GameLayers.COLLECTIBLES,
                data: {
                  propagationType: 'fire',
                  spreadRate: 1,
                  spreadProbability: 1.0, // 100% to make test deterministic
                  spreadLayer: GameLayers.COLLECTIBLES,
                  spreadType: 'fire',
                  maxDistance: 10,
                  lifetime: 25,
                  color: '#ff0000',
                },
              },
              {
                type: 'grass',
                x: 6,
                y: 5,
                layer: GameLayers.COLLECTIBLES,
                data: {
                  flammability: 1.0, // 100% to make test deterministic
                  color: '#00ff00',
                },
              },
            ],
          },
        ],
        initialScene: 'test-scene',
        systems: ['PropagationSystem'],
      };

      const runtime = loader.load(config);
      const spatial = (runtime as any).spatial;
      const gameLoop = (runtime as any).gameLoop;

      // Initial state: fire at (5,5), grass at (6,5)
      let fireId = spatial.getEntityIdAt(5, 5, GameLayers.COLLECTIBLES);
      expect(fireId).toBeDefined();
      
      let grassId = spatial.getEntityIdAt(6, 5, GameLayers.COLLECTIBLES);
      expect(grassId).toBeDefined();

      // Tick 1: Fire spreads (after spreadRate=1 tick)
      gameLoop.tick();
      
      // Tick 2: Fire should have spread to (6,5), consuming grass
      gameLoop.tick();

      // Verify grass is gone and fire has replaced it
      const cellValue = spatial.getEntityIdAt(6, 5, GameLayers.COLLECTIBLES);
      expect(cellValue).toBeDefined();
      
      const entityData = spatial.getEntityData(cellValue!);
      expect(entityData).toBeDefined();
      expect(entityData!.type).toBe('fire');
    });

    it('should catch schema error: props vs data', () => {
      // Spy on console.error to verify warning is logged
      const errors: string[] = [];
      const originalError = console.error;
      console.error = (...args: any[]) => {
        errors.push(args.join(' '));
      };

      const config: SceneConfig = {
        scenes: [
          {
            id: 'test-scene',
            width: 15,
            height: 15,
            entities: [
              {
                type: 'fire',
                x: 5,
                y: 5,
                layer: GameLayers.COLLECTIBLES,
                // @ts-expect-error - Testing error case
                props: {
                  // WRONG! Should be 'data'
                  propagationType: 'fire',
                  spreadType: 'fire',
                },
              },
            ],
          },
        ],
        initialScene: 'test-scene',
      };

      loader.load(config);

      // Verify error was logged
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('SCHEMA ERROR');
      expect(errors[0]).toContain('props');
      expect(errors[0]).toContain('data');

      // Restore console.error
      console.error = originalError;
    });

    it('should detect missing propagation properties', () => {
      // Spy on console.warn
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        warnings.push(args.join(' '));
      };

      const config: SceneConfig = {
        scenes: [
          {
            id: 'test-scene',
            width: 15,
            height: 15,
            entities: [
              {
                type: 'fire',
                x: 5,
                y: 5,
                layer: GameLayers.COLLECTIBLES,
                data: {
                  // Missing propagation properties!
                  color: '#ff0000',
                },
              },
            ],
          },
        ],
        initialScene: 'test-scene',
      };

      loader.load(config);

      // Verify warning was logged
      expect(warnings.some(w => w.includes('propagation properties'))).toBe(true);

      // Restore console.warn
      console.warn = originalWarn;
    });

    it('should detect missing flammability property', () => {
      // Spy on console.warn
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        warnings.push(args.join(' '));
      };

      const config: SceneConfig = {
        scenes: [
          {
            id: 'test-scene',
            width: 15,
            height: 15,
            entities: [
              {
                type: 'grass',
                x: 5,
                y: 5,
                layer: GameLayers.COLLECTIBLES,
                data: {
                  // Missing flammability!
                  color: '#00ff00',
                },
              },
            ],
          },
        ],
        initialScene: 'test-scene',
      };

      loader.load(config);

      // Verify warning was logged
      expect(warnings.some(w => w.includes('flammability'))).toBe(true);

      // Restore console.warn
      console.warn = originalWarn;
    });
  });

  describe('Collision Detection', () => {
    it('should detect and reject spawn collisions with debug mode', () => {
      const config: SceneConfig = {
        scenes: [
          {
            id: 'test-scene',
            width: 15,
            height: 15,
            entities: [
              {
                type: 'grass',
                x: 5,
                y: 5,
                layer: GameLayers.COLLECTIBLES,
                data: {
                  flammability: 0.8,
                  color: '#00ff00',
                },
              },
            ],
          },
        ],
        initialScene: 'test-scene',
      };

      const loader = new SceneLoader();
      const runtime = loader.load(config);
      const spatial = (runtime as any).spatial;

      // Enable debug mode
      spatial.setDebugCommit(true);

      // Spy on console.warn
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        warnings.push(args.join(' '));
      };

      // Try to spawn fire on top of grass (collision!)
      spatial.spawn('fire', 5, 5, GameLayers.COLLECTIBLES, {
        propagationType: 'fire',
        spreadType: 'fire',
        spreadRate: 1,
        spreadLayer: GameLayers.COLLECTIBLES,
      });
      spatial.commit();

      // Verify collision warning was logged
      expect(warnings.some(w => w.includes('COLLISION'))).toBe(true);
      expect(warnings.some(w => w.includes('grass'))).toBe(true);

      // Restore console.warn
      console.warn = originalWarn;
    });
  });
});
