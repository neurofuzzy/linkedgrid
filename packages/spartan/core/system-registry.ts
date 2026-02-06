/**
 * System Registry - Built-in system factory with dependency resolution.
 *
 * This module provides automatic initialization of all game systems
 * with proper dependency ordering. Systems are created in a specific
 * order to ensure dependencies are available when needed.
 *
 * @example
 * ```typescript
 * const systems = createAllSystems(gameManager, inputProvider);
 * // All 22 systems initialized in correct order
 * ```
 */
import type { GameManager } from './game-manager';
import type { InputProvider } from './input-provider';
import type { GameSystem } from './types';

// Import all systems
import { ChainReactionSystem } from '../systems/chain-reaction.system';
import { CollectionSystem } from '../systems/collection.system';
import { DoorSystem } from '../systems/door.system';
import { ExplosionSystem } from '../systems/explosion.system';
import { FireSystem } from '../systems/fire.system';
import { FloorEffectSystem } from '../systems/floor-effect.system';
import { GateSystem } from '../systems/gate.system';
import { HealthSystem } from '../systems/health.system';
import { LiquidSystem } from '../systems/liquid.system';
import { MeleeSystem } from '../systems/melee.system';
import { NPCMovementSystem } from '../systems/npc-movement.system';
import { PlayerInputSystem } from '../systems/player-input.system';
import { PlayerWeaponSystem } from '../systems/player-weapon.system';
import { PoisonSystem } from '../systems/poison.system';
import { PowerupSystem } from '../systems/powerup.system';
import { ProjectileSystem } from '../systems/projectile.system';
import { PushSystem } from '../systems/push.system';
import { RespawnSystem } from '../systems/respawn.system';
import { SignalSystem } from '../systems/signal.system';
import { SpawningSystem } from '../systems/spawning.system';
import { TeleporterSystem } from '../systems/teleporter.system';
import { TurretSystem } from '../systems/turret.system';
import { ScoreSystem } from '../systems/score.system';
import { ObjectiveSystem } from '../systems/objective.system';
import { NPCBrainSystem } from '../systems/npc-brain.system';
import { VisualStateSystem } from '../systems/visual-state.system';
import { VisualEventBus } from './visual-event-bus';
import { EffectsQueue } from './effects-queue';

/**
 * Create all game systems with proper dependency resolution.
 *
 * Systems are created in dependency order:
 * 1. Core systems (no dependencies)
 * 2. HealthSystem (depended on by many)
 * 3. Systems needing GameManager
 * 4. Systems needing HealthSystem
 * 5. Systems needing ProjectileSystem
 * 6. Systems needing InputProvider
 *
 * @param gameManager - The game manager instance
 * @param inputProvider - Optional input provider for player-controlled systems
 * @returns Array of all initialized systems in execution order
 */
export function createAllSystems(
  gameManager: GameManager,
  inputProvider?: InputProvider
): GameSystem[] {
  const systems: GameSystem[] = [];

  // Effects queue for systems that produce visual effects
  const effectsQueue = gameManager.gameState.effectsQueue;

  // === CORE SYSTEMS (no dependencies) ===
  const pushSystem = new PushSystem();
  const explosionSystem = new ExplosionSystem(effectsQueue);
  const fireSystem = new FireSystem(effectsQueue);
  const liquidSystem = new LiquidSystem();
  const chainReactionSystem = new ChainReactionSystem();
  const npcMovementSystem = new NPCMovementSystem();

  systems.push(pushSystem);
  systems.push(explosionSystem);
  systems.push(fireSystem);
  systems.push(liquidSystem);
  systems.push(chainReactionSystem);
  // NPCBrainSystem is inserted before NPCMovementSystem below (needs ProjectileSystem first)
  systems.push(npcMovementSystem);

  // === HEALTH SYSTEM (depended on by many) ===
  const healthSystem = new HealthSystem({}, effectsQueue);
  systems.push(healthSystem);

  // === SYSTEMS NEEDING GAMEMANAGER ===
  const teleporterSystem = new TeleporterSystem(gameManager);
  const collectionSystem = new CollectionSystem(gameManager);
  const doorSystem = new DoorSystem(gameManager);
  const floorEffectSystem = new FloorEffectSystem(gameManager, healthSystem);
  const poisonSystem = new PoisonSystem(gameManager);
  const signalSystem = new SignalSystem(gameManager);
  const gateSystem = new GateSystem(gameManager);
  const spawningSystem = new SpawningSystem();
  const respawnSystem = new RespawnSystem(gameManager, {}, effectsQueue);

  systems.push(teleporterSystem);
  systems.push(collectionSystem);
  systems.push(doorSystem);
  systems.push(floorEffectSystem);
  systems.push(poisonSystem);
  systems.push(signalSystem);
  systems.push(gateSystem);
  systems.push(spawningSystem);
  systems.push(respawnSystem);

  // === SYSTEMS NEEDING HEALTHSYSTEM ===
  const projectileSystem = new ProjectileSystem(healthSystem);
  const powerupSystem = new PowerupSystem({ healthSystem });
  const scoreSystem = new ScoreSystem(gameManager, healthSystem);
  const objectiveSystem = new ObjectiveSystem(gameManager, healthSystem);

  // Wire ObjectiveSystem to SpawningSystem for wave-clear objectives
  objectiveSystem.setSpawningSystem(spawningSystem);

  // === SYSTEMS NEEDING PROJECTILESYSTEM ===
  const turretSystem = new TurretSystem(healthSystem, projectileSystem);
  const npcBrainSystem = new NPCBrainSystem(projectileSystem);

  // Insert NPCBrainSystem before NPCMovementSystem so brain decisions
  // are available for movement in the same tick.
  const npcMovementIndex = systems.indexOf(npcMovementSystem);
  systems.splice(npcMovementIndex, 0, npcBrainSystem);

  systems.push(turretSystem);
  systems.push(projectileSystem);
  systems.push(powerupSystem);
  systems.push(scoreSystem);
  systems.push(objectiveSystem);

  // === SYSTEMS NEEDING INPUTPROVIDER ===
  // Only create these if inputProvider is available
  if (inputProvider) {
    const playerInputSystem = new PlayerInputSystem(gameManager, inputProvider);
    const meleeSystem = new MeleeSystem(gameManager, inputProvider, healthSystem);
    const playerWeaponSystem = new PlayerWeaponSystem(
      gameManager,
      inputProvider,
      projectileSystem,
      meleeSystem,
      undefined, // customWeapons
      healthSystem // for cone-based weapon damage
    );

    systems.push(playerInputSystem);
    systems.push(meleeSystem);
    systems.push(playerWeaponSystem);
  }

  // === VISUAL SYSTEM (post-commit, no hard dependencies) ===
  const visualEventBus = gameManager.gameState.visualEventBus;
  const visualStateSystem = new VisualStateSystem(visualEventBus, effectsQueue);
  systems.push(visualStateSystem);

  return systems;
}

/**
 * Get the list of all system names.
 * Useful for debugging and documentation.
 */
export const ALL_SYSTEM_NAMES = [
  'PushSystem',
  'ExplosionSystem',
  'FireSystem',
  'LiquidSystem',
  'ChainReactionSystem',
  'NPCBrainSystem',
  'NPCMovementSystem',
  'HealthSystem',
  'TeleporterSystem',
  'CollectionSystem',
  'DoorSystem',
  'FloorEffectSystem',
  'PoisonSystem',
  'SignalSystem',
  'GateSystem',
  'SpawningSystem',
  'RespawnSystem',
  'ProjectileSystem',
  'PowerupSystem',
  'TurretSystem',
  'PlayerInputSystem',
  'MeleeSystem',
  'PlayerWeaponSystem',
  'ScoreSystem',
  'ObjectiveSystem',
  'VisualStateSystem',
] as const;

export type SystemName = (typeof ALL_SYSTEM_NAMES)[number];
