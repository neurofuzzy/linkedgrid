/**
 * Experimental Systems - UNVALIDATED
 * 
 * ⚠️ WARNING: These systems are not validated in games-lab demos.
 * Use with caution. May have bugs or API inconsistencies.
 * 
 * See README.md for details.
 */

// Combat systems
export { ArmorSystem } from './combat/armor-system';
export { ShieldSystem } from './combat/shield-system';
export { KnockbackSystem } from './combat/knockback-system';
export { SplashDamageSystem } from './combat/splash-damage-system';
export { LeadTargetingSystem } from './combat/lead-targeting-system';
export { PredictiveAimSystem } from './combat/predictive-aim-system';
export { ProjectileSystem } from './combat/projectile-system';
export { MeleeAttackSystem } from './combat/melee-attack-system';
export { RayWeaponSystem } from './combat/ray-weapon-system';
export { CollisionDamageSystem } from './combat/collision-damage-system';

// Structure systems
export { OneWayDoorSystem } from './structures/one-way-door-system';
export { LogicCircuitSystem } from './structures/logic-circuit-system';
export { StructureSystem } from './structures/structure-system';
export { StructureHealthSystem } from './structures/structure-health-system';
export { ConditionalDoorSystem } from './structures/conditional-door-system';
export { DoorRoomSystem } from './structures/door-room-system';

// Spawning systems
export { WaveSpawnerSystem } from './spawning/wave-spawner-system';
export { ConditionalSpawnerSystem } from './spawning/conditional-spawner-system';
export { SpawnOnDeathSystem } from './spawning/spawn-on-death-system';
export { EdgeSpawnerSystem } from './spawning/edge-spawner-system';

// Trigger systems
export { AlarmSystem } from './triggers/alarm-system';
export { PressurePlateSystem } from './triggers/pressure-plate-system';
export { ProximityTriggerSystem } from './triggers/proximity-trigger-system';
export { SequenceTriggerSystem } from './triggers/sequence-trigger-system';
export { TimerTriggerSystem } from './triggers/timer-trigger-system';

// Environmental systems
export { FogOfWarSystem } from './environmental/fog-of-war-system';
export { LineOfSightSystem } from './environmental/line-of-sight-system';
export { FluidSpreadSystem } from './environmental/fluid-spread-system';
export { LavaHazardSystem } from './environmental/lava-hazard-system';
export { IceFreezeSystem } from './environmental/ice-freeze-system';

// AI systems
export { NearestTargetSystem } from './ai/nearest-target-system';
export { PatrolSystem } from './ai/patrol-system';

// Level mechanics systems
export { ResourceDropSystem } from './level-mechanics/resource-drop-system';
export { RespawnSystem } from './level-mechanics/respawn-system';
export { TeleporterSystem } from './level-mechanics/teleporter-system';

// Assembly systems
export { LineAssemblySystem } from './assembly/line-assembly-system';
export { RingAssemblySystem } from './assembly/ring-assembly-system';
export { SnakeAssemblySystem } from './assembly/snake-assembly-system';

// Input system
export { ClickTriggerSystem } from './click-trigger-system';
