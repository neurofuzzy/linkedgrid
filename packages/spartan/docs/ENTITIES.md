# Entity Trait System

Spartan uses a trait-based system: entities are **dumb data containers** composed of **traits**, while logic lives exclusively in **systems**.

## Core Architecture

| Concept | Responsibility | Example |
| :--- | :--- | :--- |
| **Trait** | Passive data contract (Interface) | `HasHealth { hp: number; maxHp: number }` |
| **Entity** | Composition of traits (Type) | `PlayerData = BaseEntityData & HasHealth & HasWeapon` |
| **Guard** | Runtime type check (Function) | `hasHealth(e): e is EntityData & HasHealth` |
| **System** | Logic operating on traits | `if (hasHealth(e)) e.hp -= 10` |

**Data Flow:** Systems read traits -> Modify data -> SpatialSystem commits.

## Working with Entities

### 1. Defining and Spawning

Use **spawn helpers** for type safety, or raw `spawn()` for dynamic loading.

```typescript
import { spawnPlayer, spawnNPC, spawnCoin } from '../entities/spawn-helpers';

// Type-safe: TypeScript enforces required traits
const playerId = spawnPlayer(spatial, 10, 10, {
  hp: 100, maxHp: 100, damage: 10,
  healthState: 'alive', inventory: [], team: 'player',
});

// NPC from persona preset
const gruntId = spawnNPC(spatial, 'grunt', 5, 5);

// Objective entity
const coinId = spawnCoin(spatial, 7, 3, { scoreValue: 10 });
```

### 2. Accessing Data (Trait Guards)

Systems should generally operate on **Traits** (generic), not **Entity Types** (specific).

```typescript
import { hasHealth, canDealDamage, hasArmor } from '../traits/trait-guards';

// Good: Generic logic (works on Players, Enemies, Walls, etc.)
if (hasHealth(entity) && canDealDamage(attacker)) {
  let dmg = attacker.damage;
  if (hasArmor(entity)) dmg = Math.max(0, dmg - entity.armor);
  entity.hp -= dmg;
}

// Specific: Use only when logic is unique to one archetype
if (isPlayer(entity)) {
  // Access player-specific traits (e.g., inventory, weapons)
}
```

## Entity Categories

| Category | Types | Default Layer | Key Traits |
| :--- | :--- | :--- | :--- |
| **Player** | `player` | ACTORS (6) | HasHealth, HasMelee, HasWeapon, HasInventory, HasBuff |
| **Enemies** | `enemy`, `guard` | ACTORS (6) | HasHealth, CanDealDamage, HasAI, HasNPCMovement |
| **Structures** | `wall`, `door`, `open-door`, `destructible-wall`, `spawner` | WALLS (5) | IsLockable, HasSpawner |
| **Collectibles** | `item`, `key`, `gasoline`, `fuse` | COLLECTIBLES (4) | IsCollectible |
| **Hazards** | `lava`, `acid`, `medbay`, `ice`, `mud` | FLOOR (1) | HasFloorEffect |
| **Powerups** | `health-pack`, `health-potion`, `shield-pack`, `speed-boost`, `ammo-pack`, `weapon-pickup` | COLLECTIBLES (4) | IsCollectible |
| **Objectives** | `coin`, `flag`, `exit` | COLLECTIBLES (4) | HasScoreValue, IsCollectible |
| **Signals** | `oscillator`, `pressure-switch`, `gate`, `conductive-floor`, `inverter`, `transceiver`, `range-sensor` | FLOOR/WALLS | HasSignalEmitter, HasSignalReceiver |
| **Spawning** | `player-start`, `checkpoint` | FLOOR (1) | HasCheckpoint |
| **Logic** | `path-node`, `sleep-wake`, `chain-link` | LOGIC (3) | -- |
| **Teleporters** | `teleporter` | FLOOR (1) | HasSceneConnection |

## Character Personas

Preset stat templates for quick NPC spawning. Four tiers of increasing difficulty:

| Persona | Tier | HP | Armor | Damage | Speed | Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `grunt` | T1 | 30 | 0 | 5 | 3 | 10 |
| `soldier` | T2 | 60 | 2 | 10 | 2 | 25 |
| `elite` | T3 | 100 | 5 | 15 | 2 | 50 |
| `boss` | T4 | 200 | 10 | 25 | 1 | 100 |

```typescript
import { spawnNPC } from '../entities/spawn-helpers';

const id = spawnNPC(spatial, 'elite', 5, 5, { movementMode: 'guard', guardRadius: 3 });
```

See [config/personas.config.ts](../config/personas.config.ts).

## Extending the System

To add custom gameplay elements, follow this 3-step pattern:

```typescript
// 1. Define Trait (Data Contract)
interface HasMana { mana: number; maxMana: number; }

// 2. Create Type Guard (Runtime Check)
function hasMana(e: unknown): e is EntityData & HasMana {
  return typeof (e as any).mana === 'number';
}

// 3. Compose Entity (Archetype)
type Mage = BaseEntityData & HasHealth & HasMana;
```

## Built-in Traits

### Combat
| Trait | Properties | Usage |
| :--- | :--- | :--- |
| `HasHealth` | `hp`, `maxHp`, `healthState` | Damage, death states |
| `CanDealDamage` | `damage` | Contact damage |
| `HasMelee` | `meleeDamage`, `meleeCooldown`, `meleeRange` | Close combat |
| `HasWeapon` | `equippedWeapon`, `ammo` | Ranged combat |
| `HasArmor` | `armor` | Flat damage reduction |
| `HasShield` | `shield`, `maxShield` | Absorb damage before HP |
| `HasBuff` | `activeBuffs` | Temporary status effects (speed, damage, health-regen, shield, invincibility) |

### Movement and AI
| Trait | Properties | Usage |
| :--- | :--- | :--- |
| `HasAI` | `aiState` | Enemy behavior state |
| `HasNPCMovement` | `movementMode`, `speed` | Autonomous movement |
| `HasNPCBrain` | `posture`, `threatRange`, `attackRange`, `preferRanged` | Autonomous combat AI (Controller/Executor pattern) |
| `HasPushable` | `pushable` | Can be pushed |
| `HasPusher` | `pushStrength` | Can push others |

### Spatial
| Trait | Properties | Usage |
| :--- | :--- | :--- |
| `HasFloorEffect` | `effectType`, `effectDamage` | Floor hazards |
| `HasTemperature` | `temperature`, `flammable`, `flamePoint` | Fire system |
| `HasExplosion` | `explosionRadius`, `explosionDamage` | Explosions |
| `HasSceneConnection` | `connectionKey` | Cross-scene portals |

### Identity
| Trait | Properties | Usage |
| :--- | :--- | :--- |
| `HasTeam` | `team` | Team-based combat |
| `HasScoreValue` | `scoreValue` | Score on kill/collect |
| `HasInventory` | `inventory` | Item collection |
| `IsCollectible` | `collectible` | Can be picked up |

## Best Practices

- **Keep Entities Dumb**: No methods on entity types. Pure data only.
- **Composition over Inheritance**: Entities *have* traits, they don't inherit them.
- **Independent Traits**: Traits should not depend on other traits.
- **Use Guards**: Always use type guards (`hasHealth`) before accessing properties.
- **Prefer Traits over Type Checks**: `hasHealth(e)` works on any entity; `isPlayer(e)` limits reuse.

## FAQ

- **Why not ECS?** Components add lifecycle overhead. Traits are zero-cost data interfaces.
- **Can I add dynamic props?** Yes, `EntityData` allows arbitrary keys. Archetypes enforce the "happy path".

## See Also

- [REFERENCE.md](./REFERENCE.md) -- Full framework reference
- [traits/](../traits/) -- All trait definitions
- [traits/trait-guards.ts](../traits/trait-guards.ts) -- All type guards
- [entities/spawn-helpers.ts](../entities/spawn-helpers.ts) -- Spawn helpers
- [config/personas.config.ts](../config/personas.config.ts) -- Character personas
