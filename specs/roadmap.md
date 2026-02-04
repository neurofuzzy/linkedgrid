HIGH-LEVEL ROADMAP:

Phase 1: Core (Refined)

1. Melee System 
   - New `HasMelee` trait and `MeleeSystem`. 
   - Fallback for weapons when out of ammo.
2. Player Weapons System
   - `HasWeapon` trait, `WeaponConfig`, `PlayerWeaponSystem`.
   - Ammo tracking and projectile integration.
3. Player Start / Respawn
   - `PlayerStart` and `Checkpoint` entities.
   - Cross-scene respawn support.
4. Pickups / Buffs
   - Health, Shield, Speed types.
   - `PowerupSystem` for applying effects.

Phase 1.5: Cleanup and Refactor

1. Assess all systems and execution flow
2. Assess proper usage patterns and leveraging LinkedGrid/LinkedCell API
3. Audit responsibility boundaries
4. Normalize and refactor where necessary 

Phase 2: Core II

1. Score System (score on kill, coin collection)
   - Via `HealthSystem` death callback.
2. Game Objectives System 
   - Flag pickup, Kill-all, Reach-exit.
   - Scene completion events.

Phase 3: Gameplay Enhancements

1. Range Sensors (like pressure plates but activates within range + LOS)
2. Wave spawners (contiguous groups spawning simultaneously)

Phase 4: Visual System (New Subsystem)

1. Phase 4a: Foundation (Dirty state tracking, Visual States)
2. Phase 4b: Movement Visuals (Facing direction, Animation states)
3. Phase 4c: Effects Manager (Particles, Area effects)

Phase 4.5: Refactor Visual Interplay

1. Audit Layers and Visual State types
2. Normalize common states

Phase 5: Gameplay Enhancements II

1. Scene coordinates and explicit edge-based linking
2. Homing projectiles
3. Freeze/stun weapon
4. Flammable Walls (Config change only)
5. Conjoined NPCs (via "Chain Following" pattern)

Phase 6: Finalize

1. Finalize package APIs and documentation
2. Establish helpers, wrappers, and quickstart
3. Final linting, typecheck and test audit
