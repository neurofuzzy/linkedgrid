HIGH-LEVEL ROADMAP:

Phase 1: Core

1. Player Start, CheckPoint/Respawn Points with scene connection support (respawn on checkpoint if in a previous scene)
2. Melee System for players and moving NPCs
3. Player Weapons System with ammo, drops down to melee when out, option for unlimited ammo
4. Pickups system / buffs for weapons, armor, temp shields, invincibility or health (not same as collection)

Phase 1.5: Cleanup and Refactor

1. Assess all systems and execution flow
2. Assess proper usage patterns and leveraging LinkedGrid/LinkedCell API
3. Audit responsibility boundaries
4. Normalize and refactor where necessary 

Phase 2: Core II

1. Score System (score on kill, coin collection)
2. Game Objectives System - Scene/Game completion using Flag pickup (like capture the flag) or when all enemies are killed

Phase 3: Gameplay Enhancements

1. Range Sensors (like pressure plates but activates within range + LOS)
2. Wave spawners (contiguous spawners than spawn multiple NPCs at a time)

Phase 4: Visual - logic-only via Visual Traits enhancements with basic support in playground

1. Visual System for dirty state tracking
2. VisualStates and default states (up to 5 states supported)
3. Facing Direction (mirror left/right or mirror left/right/up/down)
4. Sprite animation (up to 5 frames with modes: play once, repeat, yoyo)
5. Effects Manager (grid-based area effects and grid-aligned particle-systems)

Phase 4.5: Refactor Visual Interplay

1. Audit Layers and Visual State types
2. Normalize common states

Phase 5: Gameplay Enhancements

1. Scene coordinates (grid-based adjacency)  and bounds-based scene-linking (walk between scenes)
2. Homing projectiles
3. Freeze/stun weapon (for both players and NPCs)
4. Flammable Walls
5. Conjoined NPCS (Snakes/Centipedes/Convoys)

Phase 6: Finalize

1. Finalize package APIs and documentation
2. Establish helpers, wrappers, and quickstart
3. Final linting, typecheck and test audit
