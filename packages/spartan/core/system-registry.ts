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

  // === CORE SYSTEMS (no dependencies) ===
  const pushSystem = new PushSystem();
  const explosionSystem = new ExplosionSystem();
  const fireSystem = new FireSystem();
  const liquidSystem = new LiquidSystem();
  const chainReactionSystem = new ChainReactionSystem();
  const npcMovementSystem = new NPCMovementSystem();

  systems.push(pushSystem);
  systems.push(explosionSystem);
  systems.push(fireSystem);
  systems.push(liquidSystem);
  systems.push(chainReactionSystem);
  systems.push(npcMovementSystem);

  // === HEALTH SYSTEM (depended on by many) ===
  const healthSystem = new HealthSystem();
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
  const respawnSystem = new RespawnSystem(gameManager);

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

  // === SYSTEMS NEEDING PROJECTILESYSTEM ===
  const turretSystem = new TurretSystem(healthSystem, projectileSystem);
  systems.push(turretSystem);

  systems.push(projectileSystem);
  systems.push(powerupSystem);

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
] as const;

export type SystemName = (typeof ALL_SYSTEM_NAMES)[number];
