HIGH-LEVEL ROADMAP:
See [Gap Analysis](./roadmap-gap-analysis-2026-02-04.md) for gap analysis.
Please use this document for tracking using the checkboxes.

Phase 1: Core

[x] 1. Melee System 
   - New `HasMelee` trait and `MeleeSystem`. 
   - Fallback for weapons when out of ammo.
[x] 2. Player Weapons System
   - `HasWeapon` trait, `WeaponConfig`, `PlayerWeaponSystem`.
   - Ammo tracking and projectile integration.
[x] 3. Player Start / Respawn
   - `PlayerStart` and `Checkpoint` entities.
   - Cross-scene respawn support.
[x] 4. Pickups / Buffs
   - Health, Shield, Speed types.
   - `PowerupSystem` for applying effects.
[x] 5. Flammable Walls (Config change only)

Phase [x] 1.25: Lives System

[x] 1. Lives System - Unify lives tracking in GameState
   - GameState.lives as single source of truth
   - GameState.maxLives for reset support
   - RespawnSystem delegates to GameState
   - Visual tests for lives/respawn flow

Phase [x] 1.3: Weapons Pickups / Presets

  - pistol, single projectile at a time: ammo 12, cooldown 8 ticks
  - machine-gun, single projectile at a time: ammo 100, cooldown 2 ticks
  - shotgun, no projectile, uses LinkedCell `fieldOfViewCone` to apply damage: ammo 20, cooldown 16 ticks

Phase [ ] 1.5: Cleanup and Refactor

[ ] 1. Assess all systems and execution flow
[ ] 2. Assess proper usage patterns and leveraging LinkedGrid/LinkedCell API
[ ] 3. Audit responsibility boundaries
[ ] 4. Normalize and refactor where necessary 
[ ] 5. Typescript error sweep and fix (incl. pre-existing)

GAME DEMO DELIVERABLES (see `dev/games` and `dev/playground.tsx`) 

*SEPARATE DEMOS EXPECTED*

[x] A) Single player melee combat and ranged combat -> `dev/games/combat-demo.json`
[x] B) Multiscene game with hazards and checkpoints for death and respawning -> `dev/games/respawn-demo.json`
[x] C) Powerups and buffs -> `dev/games/powerups-demo.json`
[x] D) Flammable Walls (enhanced existing demo) -> `dev/games/flammability.json`
[x] E) Weapons Demo with example weapon pickups -> `dev/games/weapons-demo.json`

---

Phase 2: Core II

[ ] 1. Score System (score on kill, coin collection)
   - Via `HealthSystem` death callback.
[ ] 2. Game Objectives System 
   - Flag pickup, Kill-all, Reach-exit.
   - Scene completion events.

GAME DEMO DELIVERABLES (see `dev/games` and `dev/playground.tsx`) 

*SEPARATE DEMOS EXPECTED*

[ ] A) Score tracking and objectives
[ ] B) Multiscene game with objectives

---

Phase 3: Gameplay Enhancements

[ ] 1. Range Sensors (like pressure plates but activates within range + LOS)
[ ] 2. Wave spawners (contiguous groups spawning simultaneously)

GAME DEMO DELIVERABLES (see `dev/games` and `dev/playground.tsx`) 

*SEPARATE DEMOS EXPECTED*

[ ] A) Range sensors
[ ] B) Wave spawners, single in first scene and contiguous groups in second scene

---

Phase 4: Visual System (New Subsystem)

[ ] 1. Phase 4a: Foundation (Dirty state tracking, Visual States)
[ ] 2. Phase 4b: Enhanced Visuals (Facing direction, Animation states)
[ ] 3. Phase 4c: Effects Manager (Particles, Area effects)

NOTE: Sprite animation is not movement-based, it simply sets a frame number for any states that have more than one sprite, for instance, a walking animation may have legs in different positions. Sprite sheets can be envisioned as a 5x5 matrix with each row being a state and each column being a frame in the state. A state can have 0 or more frames. If no frames, it reverts to the default state (idl[ ] e)

Phase [ ] 4.5: Refactor Visual Interplay

[ ] 1. Audit Layers and Visual State types
[ ] 2. Normalize common states

GAME DEMO DELIVERABLES (see `dev/games` and `dev/playground.tsx`) 

*SEPARATE DEMOS EXPECTED*

[ ] A) Visual states and facing direction, simple animation using numeric frame numbers
[ ] B) Effects manager demo with explosions

---

Phase 5: Gameplay Enhancements II

[ ] 1. Scene coordinates and explicit edge-based linking
[ ] 2. Homing projectiles
[ ] 3. Freeze/stun weapon
[ ] 4. Conjoined NPCs (via "Chain Following" pattern)

GAME DEMO DELIVERABLES (see `dev/games` and `dev/playground.tsx`) 

*SEPARATE DEMOS EXPECTED*

[ ] A) Scene coordinates and explicit edge-based linking
[ ] B) Homing projectiles
[ ] C) Freeze/stun weapon
[ ] D) Conjoined NPCs

---

Phase 6: Finalize

[ ] 1. Finalize package APIs and documentation
[ ] 2. Establish helpers, wrappers, and quickstart
[ ] 3. Final linting, typecheck and test audit
