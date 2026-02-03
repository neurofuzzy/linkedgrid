import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * Wave configuration for wave spawner
 */
export interface WaveConfig {
  /** Number of entities to spawn in this wave */
  count: number;
  
  /** Entity factory function */
  entityFactory: () => Entity;
  
  /** Delay between spawns within wave (seconds) */
  spawnDelay?: number;
  
  /** Delay before this wave starts (seconds) */
  startDelay?: number;
  
  /** Optional: Wave name/description */
  name?: string;
}

/**
 * @component WaveSpawner
 * @icon waves
 * @description Spawns entities in organized waves (tower defense, arcade)
 * 
 * Wave Spawner Component
 * 
 * Spawns entities in organized waves.
 * Perfect for tower defense, arcade games, and staged encounters.
 * 
 * @property {WaveConfig[]} waves - Wave configurations
 * @property {number} currentWave - Current wave index
 * @property {number} currentWaveSpawned - Entities spawned in current wave
 * @property {number} spawnTimer - Timer for spawn delay
 * @property {number} waveStartTimer - Timer for wave start delay
 * @property {boolean} active - Whether spawner is active
 * @property {boolean} autoStart - Auto-start first wave
 * @property {boolean} loop - Loop back to first wave after completing all
 * @property {boolean} waitForClear - Wait for all enemies to die before next wave
 * 
 * @example
 * ```typescript
 * // Tower defense waves
 * const spawner = world.createEntity();
 * world.addComponent(spawner, WaveSpawnerComponent, {
 *   waves: [
 *     { count: 5, entityFactory: createBasicEnemy, spawnDelay: 1.0 },
 *     { count: 10, entityFactory: createBasicEnemy, spawnDelay: 0.5, startDelay: 3.0 },
 *     { count: 3, entityFactory: createBossEnemy, spawnDelay: 2.0, startDelay: 5.0 }
 *   ],
 *   autoStart: true,
 *   loop: false
 * });
 * ```
 */
export interface WaveSpawner {
  /** Wave configurations */
  waves: WaveConfig[];
  
  /** Current wave index */
  currentWave?: number;
  
  /** Entities spawned in current wave */
  currentWaveSpawned?: number;
  
  /** Timer for spawn delay */
  spawnTimer?: number;
  
  /** Timer for wave start delay */
  waveStartTimer?: number;
  
  /** Whether spawner is active */
  active?: boolean;
  
  /** Auto-start first wave */
  autoStart?: boolean;
  
  /** Loop back to first wave after completing all */
  loop?: boolean;
  
  /** Track spawned entities */
  spawnedEntities?: Set<Entity>;
  
  /** Wait for all enemies to die before next wave */
  waitForClear?: boolean;
  
  /** Optional: Position provider for spawned entities */
  positionProvider?: () => { x: number; y: number };
  
  /** Optional: Callback when wave starts */
  onWaveStart?: (spawner: Entity, waveIndex: number, wave: WaveConfig) => void;
  
  /** Optional: Callback when wave completes */
  onWaveComplete?: (spawner: Entity, waveIndex: number, wave: WaveConfig) => void;
  
  /** Optional: Callback when all waves complete */
  onAllWavesComplete?: (spawner: Entity) => void;
  
  /** Optional: Callback when entity spawns */
  onSpawn?: (spawner: Entity, entity: Entity, waveIndex: number) => void;
}

export const WaveSpawnerComponent = defineComponent<WaveSpawner>();
