# Roadmap Gap Analysis

**Date:** 2026-02-04  
**Scope:** Compare roadmap.md against current spartan implementation  
**Goal:** Identify gaps, incompatibilities, ambiguities, and unrealistic goals

---

## Executive Summary

The spartan package is a mature grid-based game engine with 19 systems, 20 trait files, and 13 entity types. The roadmap proposes 6 phases of enhancements. This analysis identifies:

- **Phase 1 (Core):** 4 significant gaps requiring new systems
- **Phase 2 (Core II):** 2 medium gaps, depends on Phase 1
- **Phase 3 (Gameplay):** Mostly covered, minor extensions needed
- **Phase 4 (Visual):** Entirely new subsystem
- **Phase 5 (Gameplay II):** Mixed - some trivial, one architecturally risky
- **Phase 6 (Finalize):** Process work only

**Key Risk:** Conjoined NPCs (Phase 5) challenges core single-cell assumption.

---

## Current Implementation Inventory

### Systems (19 total)
| System | Purpose |
|--------|---------|
| PlayerInputSystem | Player movement from input |
| HealthSystem | Intent-based damage/healing with death states |
| NPCMovementSystem | Follow, flee, pursue, wander, patrol, guard |
| DoorSystem | Key-based door unlocking |
| CollectionSystem | Item pickup |
| TeleporterSystem | Scene transitions |
| SignalSystem | Switches, conductors, gates |
| GateSystem | Signal-controlled gates |
| SpawningSystem | Spawner entities with limits/cooldowns |
| FireSystem | Temperature-based fire spread |
| ExplosionSystem | Area damage explosions |
| PoisonSystem | Gas spread |
| LiquidSystem | Volumetric liquid flow |
| ChainReactionSystem | Chain link spreading |
| ProjectileSystem | Autonomous projectiles |
| TurretSystem | Stationary shooters |
| PushSystem | Push mechanics |
| FloorEffectSystem | Floor hazards (lava, ice, mud) |

### Traits (Key ones)
- HasHealth (with states: alive/dying/dead)
- HasArmor, HasShield, HasResistance, HasVulnerability
- CanDealDamage (contact damage)
- HasNPCMovement (6 movement modes)
- HasProjectile (Bresenham paths, bouncing, piercing)
- HasTurret (stationary shooting)
- HasSpawner (spawn limits, cooldowns)
- HasSignalEmitter/Receiver/Conductive
- HasTemperature, HasExplosion
- HasInventory, IsCollectible
- HasPushable, HasPusher
- HasFloorEffect

### GameState Properties
- playerEntityId, lives, score (exists but unused)
- inventory, buffs (exists but unused), upgrades, flags, connections

---

## Phase 1: Core - Gap Analysis

### 1.1 Player Start / CheckPoints / Respawn

**Gap Level:** HIGH

**Current State:**
- GameState tracks playerEntityId and lives
- TeleporterSystem handles scene transitions
- HasSceneConnection trait for cross-scene portals
- No respawn concept

**Required Implementation:**

```typescript
// New entity types
type PlayerStartData = BaseEntityData & {
  type: 'player-start';
  sceneId: string;
};

type CheckpointData = BaseEntityData & {
  type: 'checkpoint';
  activated: boolean;
  sceneId: string;
} & HasColor;

// New trait
interface HasCheckpoint {
  lastCheckpointId?: number;
  lastCheckpointSceneId?: string;
}

// New system
class RespawnSystem extends BaseReactiveSystem {
  // Detects player death (healthState === 'dead')
  // Finds last activated checkpoint
  // Respawns player at checkpoint (may be different scene)
  // Decrements lives, handles game-over
}
```

**Dependencies:**
- HealthSystem death detection (exists via healthState)
- Scene transition capability (exists via GameManager)

**Ambiguity:** "Respawn on checkpoint if in a previous scene" - confirmed this means cross-scene respawn.

---

### 1.2 Melee System

**Gap Level:** HIGH

**Current State:**
- CanDealDamage trait exists (contact damage only)
- HealthSystem with intent-based damage
- InputProvider has getAction() method
- No attack action or melee mechanics

**Required Implementation:**

```typescript
// New trait
interface HasMelee {
  meleeRange: number;      // Typically 1 for adjacent cells
  meleeDamage: number;
  meleeCooldown: number;   // Ticks between attacks
  lastAttackTick?: number;
  meleeDirection?: Direction; // Attack direction
}

// New system
class MeleeSystem extends BaseTickedSystem {
  // Listens for action input
  // Determines attack direction (from facing or input)
  // Finds targets in range
  // Applies damage via HealthSystem.damage()
  // Manages cooldowns
}
```

**Dependencies:**
- InputProvider.getAction() (exists)
- HealthSystem.damage() (exists)
- Direction enum (exists)

**Compatibility:** Works well with existing intent-based architecture.

---

### 1.3 Player Weapons System

**Gap Level:** HIGH

**Current State:**
- ProjectileSystem handles autonomous projectiles
- TurretSystem fires from stationary entities
- HasInventory trait exists
- No player shooting or ammo

**Required Implementation:**

```typescript
// New trait
interface HasWeapon {
  equippedWeapon: string;
  ammo: Record<string, number>;  // weaponType -> ammoCount
  unlimitedAmmo?: boolean;
  weaponCooldown?: number;
  lastFireTick?: number;
}

// Weapon definitions (config)
interface WeaponConfig {
  name: string;
  damage: number;
  projectileType: string;
  fireRate: number;      // Ticks between shots
  ammoCost: number;
  range?: number;        // For raycast weapons
}

// New system
class PlayerWeaponSystem extends BaseReactiveSystem {
  // Listens for secondary input (getSecondary())
  // Checks ammo
  // Spawns projectile from player position
  // Falls back to melee when out of ammo
}
```

**Dependencies:**
- ProjectileSystem (exists)
- InputProvider.getSecondary() (exists)
- MeleeSystem (Phase 1.2) for fallback

**Ambiguity Resolution:** Melee should be a separate system. Weapons system checks ammo and falls back to triggering melee attack when empty.

---

### 1.4 Pickups / Buffs System

**Gap Level:** MEDIUM

**Current State:**
- CollectionSystem handles item pickup
- GameState.buffs exists but unused
- HasShield, HasArmor traits exist
- FloorEffectSystem has temporary effects

**Required Implementation:**

```typescript
// New entity types
type HealthPackData = BaseEntityData & {
  type: 'health-pack';
  healAmount: number;
} & IsCollectible;

type ShieldPackData = BaseEntityData & {
  type: 'shield-pack';
  shieldAmount: number;
  duration?: number;  // Temporary shield
} & IsCollectible;

type SpeedBoostData = BaseEntityData & {
  type: 'speed-boost';
  speedMultiplier: number;
  duration: number;
} & IsCollectible;

// New trait
interface HasBuff {
  activeBuffs: Array<{
    type: string;
    magnitude: number;
    expirationTick: number;
  }>;
}

// New system or extend CollectionSystem
class PowerupSystem extends BaseTickedSystem {
  // Apply buff on pickup
  // Track buff durations
  // Remove expired buffs
  // Apply buff effects (speed, invincibility, etc.)
}
```

**Dependencies:**
- CollectionSystem (exists, can extend)
- GameState.buffs (exists, reuse)

---

## Phase 2: Core II - Gap Analysis

### 2.1 Score System

**Gap Level:** MEDIUM

**Current State:**
- GameState.score exists but unused
- HealthSystem removes dead entities
- DamageIntent has sourceId for tracking

**Required Implementation:**

```typescript
// New entity type
type CoinData = BaseEntityData & {
  type: 'coin';
  scoreValue: number;
} & IsCollectible;

// Add callback to HealthSystem
interface HealthSystemConfig {
  dyingDuration: number;
  onEntityDeath?: (entityId: number, killerEntityId?: number) => void;
}

// New system
class ScoreSystem extends BaseReactiveSystem {
  // Listen to HealthSystem death callback
  // Award points based on enemy type
  // Handle coin collection (extend CollectionSystem)
}
```

**Implementation Approach:** Add optional `onEntityDeath` callback to HealthSystem rather than creating event system.

---

### 2.2 Game Objectives System

**Gap Level:** HIGH

**Current State:**
- No objective tracking
- GameState.flags exists but unused
- No win/lose conditions

**Required Implementation:**

```typescript
// New entity type
type FlagData = BaseEntityData & {
  type: 'flag';
  objectiveId: string;
} & IsCollectible;

// New trait
interface HasObjective {
  objectives: Array<{
    id: string;
    type: 'collect-flag' | 'kill-all' | 'reach-exit';
    completed: boolean;
    sceneId?: string;  // Scene-specific or game-wide
  }>;
}

// New system
class ObjectiveSystem extends BaseReactiveSystem {
  // Track objective progress
  // Detect completion conditions
  // Emit completion events
  // Handle scene completion
}
```

**Ambiguity:** Scene completion should flag as complete and emit event. Auto-advance is renderer/game-specific.

---

## Phase 3: Gameplay Enhancements - Gap Analysis

### 3.1 Range Sensors

**Gap Level:** LOW

**Current State:**
- PressureSwitch activates on contact
- SignalSystem propagates signals
- SpawningSystem has LOS + range detection

**Required Implementation:**

```typescript
// New entity type
type RangeSensorData = BaseEntityData & {
  type: 'range-sensor';
  sensorRange: number;
  requiresLOS: boolean;
} & HasSignalEmitter;

// Extend SignalSystem or create dedicated logic
// Reuse LOS pattern from SpawningSystem
```

**Effort:** Low - pattern exists in SpawningSystem.

---

### 3.2 Wave Spawners

**Gap Level:** LOW

**Current State:**
- SpawningSystem has grouping, limits, cooldowns
- Direction cycling for spawn locations

**Required Implementation:**

```typescript
// Extend HasSpawner trait
interface HasSpawner {
  // ... existing properties
  waveMode?: boolean;
  waveSize?: number;      // Entities per wave
  waveCount?: number;     // Total waves
  waveCooldown?: number;  // Ticks between waves
  currentWave?: number;
}
```

**Clarification:** Wave spawners spawn multiple entities simultaneously from a single spawner, distinct from existing group coordination.

---

## Phase 4: Visual System - Gap Analysis

**Gap Level:** HIGH (all new)

This phase adds logical support for visual metadata. Core remains platform-agnostic.

### 4.1 Dirty State Tracking

```typescript
interface HasVisualDirty {
  visualDirty: boolean;
}

class VisualSystem extends BaseReactiveSystem {
  // Collect entities with visualDirty === true
  // Provide dirty list to renderer
  // Clear dirty flags after render
}
```

### 4.2 Visual States

```typescript
interface HasVisualState {
  visualState: 0 | 1 | 2 | 3 | 4;
  defaultState: number;
}
```

### 4.3 Facing Direction

```typescript
interface HasFacing {
  facing: Direction;
  facingMode: '2-way' | '4-way';
}
// Auto-update on movement in PlayerInputSystem/NPCMovementSystem
```

### 4.4 Sprite Animation

```typescript
interface HasAnimation {
  frameCount: number;
  currentFrame: number;
  animationMode: 'once' | 'repeat' | 'yoyo';
  frameDuration: number;  // Ticks per frame
  animationTick?: number;
}

class AnimationSystem extends BaseTickedSystem {
  // Advance frames based on tick
  // Handle animation modes
}
```

### 4.5 Effects Manager

```typescript
class EffectsManager {
  spawnEffect(type: string, x: number, y: number, duration: number): void;
  spawnParticles(config: ParticleConfig): void;
  spawnAreaEffect(x: number, y: number, radius: number, type: string): void;
}
```

**Recommendation:** Split Phase 4 into sub-phases:
- 4a: Dirty tracking + visual states (foundation)
- 4b: Facing + animation (movement-related)
- 4c: Effects manager (independent)

---

## Phase 5: Gameplay Enhancements II - Gap Analysis

### 5.1 Scene Coordinates + Edge-Based Linking

**Gap Level:** HIGH

**Current State:**
- Scenes are isolated with string IDs
- Explicit teleporter transitions

**Required Implementation:**

```typescript
// Scene metadata
interface SceneMetadata {
  id: string;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
}

// Edge transition detection
class EdgeTransitionSystem extends BaseReactiveSystem {
  // Detect player at grid edge
  // Find adjacent scene by grid coordinates
  // Transition player to opposite edge of adjacent scene
}
```

**Potential Incompatibility:** Current isolation model assumes explicit transitions. Edge transitions are implicit and may require SceneManager changes.

---

### 5.2 Homing Projectiles

**Gap Level:** LOW

```typescript
// Extend HasProjectile
interface HasProjectile {
  // ... existing
  homing?: boolean;
  homingStrength?: number;  // 0-1, turn rate
  homingTargetId?: number;
}

// In ProjectileSystem
// Recalculate path each tick toward target
```

---

### 5.3 Freeze/Stun Weapon

**Gap Level:** MEDIUM

```typescript
interface HasStunnable {
  stunned: boolean;
  stunTicks: number;
}

class StunSystem extends BaseTickedSystem {
  // Apply stun from weapons/projectiles
  // Countdown stun duration
  // Integrate with NPCMovementSystem (skip movement when stunned)
}
```

---

### 5.4 Flammable Walls

**Gap Level:** VERY LOW

**Solution:** Add HasTemperature to DestructibleWallData type definition.

```typescript
// In structure.entity.ts
type DestructibleWallData = BaseEntityData & {
  type: 'destructible-wall';
} & HasHealth & HasTemperature;  // Add HasTemperature
```

This is a configuration change, not new implementation.

---

### 5.5 Conjoined NPCs (Snakes/Centipedes)

**Gap Level:** VERY HIGH - ARCHITECTURAL RISK

**Current State:**
- Entities occupy single cells (core assumption)
- No multi-cell concept
- No segment following logic

**Option A: Following Entities (Recommended)**
Maintains single-cell principle. Each segment is independent entity following previous.

```typescript
interface HasSegmentFollowing {
  followTargetId: number;       // Entity to follow
  followDelay: number;          // Ticks behind leader
  positionHistory: Array<{x: number, y: number}>;
}

// SegmentFollowSystem tracks leader position history
// Followers move to position N ticks behind leader
```

**Option B: Multi-Cell Entity (Not Recommended)**
Breaks core assumption. Would require:
- Exception handling throughout spatial system
- Visual rendering changes
- Collision detection changes
- Complex death handling

**Recommendation:** Use Option A (following entities). This:
- Maintains single-cell principle
- Works with existing systems
- Simpler collision/death handling
- Visually achieves same effect

---

## Priority Matrix

| Phase | Item | Gap | Complexity | Risk |
|-------|------|-----|------------|------|
| 1 | Checkpoint/Respawn | HIGH | Medium | Low |
| 1 | Melee | HIGH | Medium | Low |
| 1 | Weapons | HIGH | High | Low |
| 1 | Pickups/Buffs | MEDIUM | Low | Low |
| 2 | Score | MEDIUM | Low | Low |
| 2 | Objectives | HIGH | Medium | Low |
| 3 | Range Sensors | LOW | Low | Low |
| 3 | Wave Spawners | LOW | Low | Low |
| 4 | Visual System | HIGH | Medium | Low |
| 5 | Scene Edges | HIGH | Medium | Medium |
| 5 | Homing | LOW | Low | Low |
| 5 | Freeze/Stun | MEDIUM | Low | Low |
| 5 | Flammable Walls | VERY LOW | Trivial | None |
| 5 | Conjoined NPCs | VERY HIGH | High | HIGH |

---

## Ambiguities Resolved

1. **Melee vs Weapons:** Separate systems. Weapons falls back to melee when out of ammo.

2. **Wave Spawners:** Single spawner spawns multiple entities at once. Distinct from existing group coordination.

3. **Scene Completion:** Flag as complete + emit event. Auto-advance is renderer-specific.

4. **Conjoined NPCs:** Use following entities pattern to maintain single-cell principle.

5. **Edge Scene Linking:** Automatic detection, transition requires explicit SceneManager call.

---

## Recommendations

1. **Reorder Phase 5.4 (Flammable Walls):** Move to Phase 1 or 2 - it's trivial config change.

2. **Split Phase 4:** Into 4a (foundation), 4b (movement-visual), 4c (effects).

3. **Defer Phase 5.5 (Conjoined NPCs):** Most complex item, consider separate spike/prototype first.

4. **Add Phase 1 dependency:** Melee before Weapons (weapons needs melee fallback).

5. **Create HealthSystem events:** Death callback enables both Score and Objectives.

---

## Next Steps

1. Implement Phase 1 in order: Melee -> Weapons -> Checkpoint/Respawn -> Pickups
2. Add HealthSystem.onEntityDeath callback (enables Phase 2)
3. Prototype following entities for conjoined NPCs before committing
