# Character Personas Specification

## Overview

Character Personas are preset stat templates for players and NPCs. They bundle combat stats, movement, and scoring properties into reusable archetypes that can be applied at spawn time.

The system supports:
- A **Player** persona (the superset -- most flexible and composable)
- **Tiered NPC** personas (grunt, soldier, elite, boss) with escalating stats
- **Custom personas** defined by consumers at runtime
- **Per-instance overrides** at spawn time for fine-tuning

## Design Principles

1. **Personas are data, not behavior.** A persona defines stat values, not AI logic or system behavior. Systems read the data; personas provide defaults.
2. **The player is the superset.** PlayerData accepts all traits. NPC personas are restricted subsets.
3. **Spawn helpers merge, never replace.** `spawnNPC(persona, overrides)` deep-merges overrides onto persona defaults. Explicit overrides always win.
4. **Tier is informational.** The `tier` field is metadata for sorting/UI, not used by game systems.

## CharacterPersona Interface

```typescript
interface CharacterPersona {
  name: string;            // Display name
  tier?: number;           // Difficulty tier (1-4). Player has no tier.

  // Health
  hp: number;              // Hit points (required)
  maxHp?: number;          // Maximum HP (defaults to hp)

  // Defense
  armor?: number;          // Flat damage reduction per hit
  hardness?: number;       // Minimum damage required to hurt this entity
  shield?: number;         // Shield hit points (absorbs before HP)
  maxShield?: number;      // Maximum shield capacity
  resistance?: number;     // Percentage damage reduction (0.0 - 1.0)

  // Offense
  damage?: number;         // Contact/base damage
  meleeDamage?: number;    // Melee attack damage
  meleeCooldown?: number;  // Ticks between melee attacks
  meleeRange?: number;     // Melee attack range in cells

  // Movement
  speed?: number;          // Movement frequency (ticks between moves). 1=fast, 2=medium, 4=slow.
  movementMode?: NPCMovementMode; // AI movement behavior

  // Scoring
  scoreValue?: number;     // Points awarded to player on kill

  // Visual
  color?: string;          // Entity color (hex)
}
```

## Built-in Personas

### Player

| Property | Value | Notes |
|----------|-------|-------|
| hp | 100 | Standard player health |
| armor | 0 | No default armor |
| damage | 10 | Base weapon damage |
| meleeDamage | 25 | Melee punch |
| meleeCooldown | 3 | 3 ticks between melee |
| meleeRange | 1 | Adjacent cells only |
| speed | 1 | Moves every tick |
| color | #00aaff | Bright blue |

The player persona is a baseline. In practice, players are spawned with full `PlayerData` properties (inventory, weapon, ammo, etc.) and the persona provides sensible combat defaults.

### NPC Tiers

| Property | Grunt (T1) | Soldier (T2) | Elite (T3) | Boss (T4) |
|----------|-----------|-------------|-----------|---------|
| hp | 30 | 60 | 100 | 200 |
| armor | -- | 2 | 5 | 10 |
| hardness | -- | -- | 3 | 5 |
| damage | 5 | 10 | 15 | 25 |
| meleeDamage | -- | -- | 20 | 35 |
| meleeCooldown | -- | -- | 4 | 5 |
| meleeRange | -- | -- | 1 | 1 |
| shield | -- | -- | -- | 50 |
| maxShield | -- | -- | -- | 50 |
| resistance | -- | -- | -- | 0.1 (10%) |
| speed | 3 | 2 | 2 | 1 |
| movementMode | pursue | pursue | pursue | pursue |
| scoreValue | 10 | 25 | 50 | 100 |
| color | #ff4444 | #ff8800 | #cc00cc | #ff0000 |

### Tier Design Intent

- **Tier 1 (Grunt)**: Cannon fodder. Low HP, no armor, slow. Easy to kill, swarms are the threat.
- **Tier 2 (Soldier)**: Standard combatant. Moderate HP, light armor, faster. Requires a few hits.
- **Tier 3 (Elite)**: Tough opponent. High HP, armor + hardness (resists weak attacks), melee capable. Forces player to use strong weapons.
- **Tier 4 (Boss)**: Miniboss/boss. Very high HP, heavy armor + hardness + shields + resistance. Multiple attack types. Designed for set-piece encounters.

## Spawn API

### spawnNPC

Spawns an enemy entity from a persona name with optional overrides.

```typescript
spawnNPC(
  spatial: SpatialSystem,
  persona: string,         // Persona name key (e.g., 'grunt', 'soldier')
  x: number, y: number,
  overrides?: Record<string, unknown>
): number  // Returns entity ID
```

### spawnNPCFromPersona

Spawns an enemy entity from a CharacterPersona object directly.

```typescript
spawnNPCFromPersona(
  spatial: SpatialSystem,
  persona: CharacterPersona,
  x: number, y: number,
  overrides?: Record<string, unknown>
): number  // Returns entity ID
```

### How merging works

1. Start with base enemy data (`type: 'enemy'`, `healthState: 'alive'`, etc.)
2. Apply all non-undefined persona properties
3. Apply all override properties (these win over persona values)
4. If `maxHp` is not set, default to `hp`

```typescript
// Example: spawn a grunt with extra armor
spawnNPC(spatial, 'grunt', 5, 5, { armor: 3, color: '#ff6666' });

// Example: spawn a custom persona
spawnNPCFromPersona(spatial, {
  name: 'Berserker',
  tier: 2,
  hp: 80,
  damage: 20,
  speed: 1,
  movementMode: 'pursue',
  scoreValue: 40,
  color: '#ff3300',
}, 5, 5);
```

## JSON Configuration

Personas can be used in scene JSON files by setting the entity's `data` properties directly. The spawn helpers are for programmatic use.

```json
{
  "type": "enemy",
  "x": 5, "y": 5,
  "layer": 6,
  "data": {
    "hp": 30, "maxHp": 30,
    "healthState": "alive",
    "damage": 5,
    "aiState": "idle",
    "team": "enemy",
    "scoreValue": 10,
    "speed": 3,
    "movementMode": "pursue",
    "color": "#ff4444"
  }
}
```

## Future Considerations

- **Weapon presets per persona**: Bosses could spawn with specific weapon loadouts.
- **Loot tables**: Personas could define drop tables on death.
- **Scaling functions**: `getScaledPersona('grunt', multiplier)` for difficulty scaling.
- **Faction personas**: Different color/behavior themes per faction (undead, mech, etc.).
- **Persona inheritance**: Elite could extend Soldier with additional properties.
- **Visual variants**: Multiple color options per tier for visual variety.
- **Custom movement patterns**: Persona-specific patrol paths or AI behaviors.

## File Locations

| File | Purpose |
|------|---------|
| `packages/spartan/config/personas.config.ts` | Persona definitions and `getPersona()` |
| `packages/spartan/entities/spawn-helpers.ts` | `spawnNPC()`, `spawnNPCFromPersona()` |
| `packages/spartan/entities/enemy.entity.ts` | `EnemyData` type with optional persona traits |
| `packages/spartan/test/persona.test.ts` | Tests for persona spawning |
| `dev/games/tournament-demo.json` | Demo using tiered NPC personas |
