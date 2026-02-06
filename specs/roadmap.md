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

Phase [x] 1.5: Cleanup and Refactor

[x] 1. Assess all systems and execution flow
[x] 2. Assess proper usage patterns and leveraging LinkedGrid/LinkedCell API
[x] 3. Audit responsibility boundaries
[x] 4. Normalize and refactor where necessary 
[x] 5. Typescript error sweep and fix (incl. pre-existing)

GAME DEMO DELIVERABLES (see `dev/games` and `dev/playground.tsx`) 

*SEPARATE DEMOS EXPECTED*

[x] A) Single player melee combat and ranged combat -> `dev/games/combat-demo.json`
[x] B) Multiscene game with hazards and checkpoints for death and respawning -> `dev/games/respawn-demo.json`
[x] C) Powerups and buffs -> `dev/games/powerups-demo.json`
[x] D) Flammable Walls (enhanced existing demo) -> `dev/games/flammability.json`
[x] E) Weapons Demo with example weapon pickups -> `dev/games/weapons-demo.json`

---

Phase 2: Core II

[x] 1. Score System (score on kill, coin collection)
   - Via `HealthSystem` death events (`getDeathEvents()`).
   - `ScoreSystem` awards points for player kills (scoreValue) and coin collection.
   - `CoinData` entity type with scoreValue.
[x] 2. Game Objectives System 
   - Flag pickup, Kill-all, Reach-exit.
   - Scene completion events via callbacks.
   - `ObjectiveSystem` tracks objectives stored in `GameState.objectives`.
   - `FlagData`, `ExitData` entity types.
[x] 3. Character Personas
   - `CharacterPersona` config with speed, hp, armor, hardness, scoreValue.
   - Player Character (most flexible and composable, the superset).
   - Preset NPC classes: grunt (T1), soldier (T2), elite (T3), boss (T4).
   - `spawnNPC()` and `spawnNPCFromPersona()` spawn helpers.

GAME DEMO DELIVERABLES (see `dev/games` and `dev/playground.tsx`) 

*SEPARATE DEMOS EXPECTED*

[x] A) Score tracking and objectives -> `dev/games/score-objectives-demo.json`
[x] B) Multiscene game with objectives -> `dev/games/multiscene-objectives-demo.json`
[x] C) Multiscene game with player, NPC combat as tournament -> `dev/games/tournament-demo.json`

[x] Phase 2.5: Documentation

[x] 1. REFERENCE.md -- Comprehensive LLM-friendly reference
   - I. Basics (concepts, architecture, config, data format, systems overview, entities)
   - II. Getting Started (setup, embedding, input, customization, renderer, HUD)
   - III. Advanced Concepts (spatial queries, layers, lifecycle, intents, signals)
   - IV. Composing Traits (philosophy, built-in reference, custom traits, personas)
   - V. Systems in Detail (base classes, execution order, config, all 24 systems)
   - VI. Visual and Automated Tests (dual execution, writing tests, timing, fixtures)
   - VII. How-tos (new entities, new systems, hazards, scenes, objectives, personas, puzzles)
[x] 2. Updated ENTITIES.md -- Entity categories, personas, all traits, extension guide
[x] 3. Updated SYSTEMS.md -- All 24 systems by phase, base classes, best practices
[x] 4. Updated GUIDELINES.md -- Development philosophy, naming, reactive architecture
[x] 5. Updated HOWTO_SPATIAL.md -- Queries, patterns, field-of-view, API reference

Location: `packages/spartan/docs/`

---

Phase 3: Gameplay Enhancements

[ ] 1. Range Sensors (like pressure plates but activates within range + LOS)
[ ] 2. Wave spawners (contiguous groups spawning simultaneously)
      a. example: 4 contiguous spawners in a line with a wave size of 2 would spawn from pos 1 and 3, then after cooldown, from pos 2 and 4
      b. only spawn as many as max concurrent allowed
[ ] 3. Wave recycling: Allow spawned entities to fly offscreen and be removed without counting as "killed by player"
[ ] 4. Waves and Game Objectives: Link wave completion to (optional) game completion with an (optional) score threshold for win/lose

GAME DEMO DELIVERABLES (see `dev/games` and `dev/playground.tsx`) 

*SEPARATE DEMOS EXPECTED*

[ ] A) Range sensors
[ ] B) Wave spawners, single in first scene and contiguous groups in second scene
[ ] C) Wave recycling, borderless game with flying enemies that go offscreen with score objective

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
