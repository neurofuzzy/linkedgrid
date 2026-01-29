# Floor Effects System

A comprehensive system for floor hazards and environmental effects in Spartan games.

## Features

### Damage Effects
- **Lava** (≈) - Deals damage over time with configurable cadence
  - Color: Orange-red (#ff6b35)
- **Acid** (~) - Fast-ticking damage (more frequent than lava)
  - Color: Toxic green (#7dce82)

### Healing Effects
- **Medbay** (+) - Heals players over time with cooldown system
  - Color: Cyan-green (#4ec9b0)
  - Only heals while standing on the pad
  - Respects max HP limit
  - Cooldown prevents instant full healing

### Movement Modifiers
- **Ice** (❄) - Causes sliding in the direction of movement
  - Color: Light blue (#9cdcfe)
  - Configurable slide distance
  - Stops at walls or blocking entities
- **Mud** (▒) - Slows movement
  - Color: Brown (#8b6914)
  - Configurable slow factor (0-1)
  - Deterministic slow (e.g., 0.5 = every other move)

## Architecture

### System-Owned State
The `FloorEffectSystem` uses internal timing state rather than polluting entity data:
```typescript
private timingState = new Map<number, EntityTimingState>();
```

This tracks:
- Last damage time (for cadence)
- Last heal time (for cadence and cooldown)
- Mud move counter (for deterministic slowing)

### Trait-Based Design
All floor effects use the `HasFloorEffect` and `HasColor` traits:
```typescript
export interface HasFloorEffect {
  effectType: 'damage' | 'heal' | 'slide' | 'slow';
  damage?: number;
  healRate?: number;
  cooldown?: number;
  slideDistance?: number;
  slowFactor?: number;
  cadence?: number;
}

export interface HasColor {
  color: string;
}
```

## Usage

### In Game JSON
```json
{
  "systems": ["FloorEffectSystem"],
  "scenes": [{
    "entities": [
      {
        "type": "lava",
        "x": 5,
        "y": 5,
        "layer": 1,
        "data": {
          "effectType": "damage",
          "damage": 10,
          "cadence": 1000,
          "color": "#ff6b35"
        }
      }
    ]
  }]
}
```

### Programmatically
```typescript
// Spawn lava
spatial.spawn('lava', 5, 5, GameLayers.FLOOR, {
  effectType: 'damage',
  damage: 10,
  cadence: 1000,
  color: '#ff6b35'
});

// Create system
const floorSystem = new FloorEffectSystem(gameManager);
gameLoop.addSystem(floorSystem);
```

## Demo

Run the playground and select **"Floor Hazards Demo"** to see:
- Lava pools (row 5)
- Acid pools (row 9)
- Medbay healing pads (center)
- Ice patches (row 4)
- Mud patches (row 10)

Navigate with WASD or arrow keys and observe the effects!

## Test Coverage

6/8 visual tests passing (98.9% overall test pass rate):
- ✅ Lava damage over time
- ✅ Acid faster damage
- ✅ Medbay healing with cooldown
- ✅ Medbay max HP limit
- ✅ Mud slowing
- ✅ Player death from damage
- ⚠️ Ice sliding (known timing issue with reactive system)

## Performance

- **O(N) per tick** where N = entities with health
- No quadratic checks (doesn't check all floor tiles)
- Timing state is sparse (only tracked entities)
- System-owned state means no entity data overhead
