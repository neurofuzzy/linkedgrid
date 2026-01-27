# Spartan Framework Layer Architecture

## Overview

Fixed 8-layer architecture for all games. Each layer has semantic meaning and a specific game design purpose.

## Design Principles

1. **Fixed Layer Count**: Exactly 8 layers (0-7), always present
2. **Semantic Meaning**: Each layer has a specific purpose
3. **Entity Exclusivity**: One entity per layer per cell
4. **Visual Stacking**: Higher layers render on top
5. **Multi-Entity Cells**: Multiple entities via different layers
6. **Genre Agnostic**: Same 8 layers work for all game types

## The 8 Layers

### Layer 0: BACKGROUND
Static background visuals with no gameplay effect.
- **Storage**: `values[0]` for tile types
- **Blocking**: Never blocks movement or vision
- **Use**: Background textures, void representation (stars, deep water, pits)

### Layer 1: FLOOR
Walkable terrain that may have gameplay effects.
- **Storage**: `values[1]` for floor type/behavior
- **Blocking**: Generally walkable; can trigger effects (lava damage, ice slipping)
- **Use**: Ground tiles, interactive terrain, teleport pads
- **Game Setting**: "Empty floor tiles block" - when enabled, cells without floor are impassable

### Layer 2: LOGIC
Invisible AI and editor helpers (not rendered during gameplay).
- **Storage**: `values[2]` for zone types; `items[2]` for waypoint entities
- **Blocking**: No gameplay blocking
- **Use**: Spawn points, waypoints, trigger volumes, region tags
- **Visibility**: Editor/debug mode only

### Layer 3: COLLECTIBLES
Items that can be picked up.
- **Storage**: `items[3]` for entity IDs
- **Blocking**: Does not block movement
- **Use**: Coins, keys, power-ups, weapons, quest items

### Layer 4: WALLS
Static blocking elements.
- **Storage**: `values[4]` for wall types; `items[4]` for door entities
- **Blocking**: Blocks movement and vision
- **Use**: Walls, barriers, locked doors, destructible obstacles

### Layer 5: ACTORS
Dynamic moving entities.
- **Storage**: `items[5]` for entity IDs
- **Blocking**: Typically blocks movement
- **Use**: Player, enemies, NPCs, vehicles, moving platforms

### Layer 6: EPHEMERALS
Temporary effects and permanent decals.
- **Storage**: `items[6]` for entity IDs
- **Blocking**: Game-dependent
- **Use**: 
  - Temporary: Projectiles, explosions, particle effects
  - Permanent: Blood splatters, scorch marks, decals

### Layer 7: TEXT
UI elements and text overlays (always on top).
- **Storage**: `values[7]` for character codes; `items[7]` for UI entities
- **Blocking**: Never blocks
- **Use**: HUD, menus, dialog, floating combat text, debug overlays

## Rendering Order

Layers render from lowest to highest (back to front):

```
0 (BACKGROUND)    ← Back
1 (FLOOR)
2 (LOGIC)         ← Invisible during gameplay
3 (COLLECTIBLES)
4 (WALLS)
5 (ACTORS)
6 (EPHEMERALS)
7 (TEXT)          ← Front
```

## Cell Data Arrays

Each `LinkedCell` has four parallel arrays:

### `values[layer]`: Terrain/Tile Types
Static tile IDs managed by game logic.
```typescript
cell.values[GameLayers.FLOOR] = FLOOR_LAVA;
cell.values[GameLayers.WALLS] = WALL_STONE;
```

### `items[layer]`: Entity Occupancy
Entity IDs managed by `SpatialSystem`. One entity per layer.
```typescript
cell.values[GameLayers.ACTORS] = 42;        // Player entity
cell.values[GameLayers.COLLECTIBLES] = 108; // Coin entity
```

### `masks[layer]`: Boolean Properties
Game-specific flags (explored, visible, highlighted).
```typescript
cell.masks[0] = true;  // Explored (fog of war)
cell.masks[1] = false; // Not currently visible
```

### `distances[layer]`: Computed Fields
Numeric calculations (pathfinding, lighting, influence).
```typescript
cell.distances[0] = 8;   // Distance to player
cell.distances[1] = 255; // Light intensity
```

## Blocking and Vision

### Movement Blocking
```typescript
function isBlocked(cell: LinkedCell, emptyFloorsBlock = false): boolean {
  // Empty floor blocks (game setting)
  if (emptyFloorsBlock && cell.values[GameLayers.FLOOR] === undefined) {
    return true;
  }
  
  // Check walls and actors
  return cell.values[GameLayers.WALLS] !== undefined ||
         cell.values[GameLayers.ACTORS] !== undefined;
}
```

### Vision Blocking
```typescript
function blocksVision(cell: LinkedCell): boolean {
  return cell.values[GameLayers.WALLS] !== undefined;
}
```

**Note**: Only WALLS typically block vision. Actors and floor don't block line-of-sight.

## TypeScript Implementation

```typescript
export const GameLayers = {
  BACKGROUND: 0,
  FLOOR: 1,
  LOGIC: 2,
  COLLECTIBLES: 3,
  WALLS: 4,
  ACTORS: 5,
  EPHEMERALS: 6,
  TEXT: 7,
} as const;

export type GameLayer = typeof GameLayers[keyof typeof GameLayers];

export const BLOCKING_LAYERS = [GameLayers.WALLS, GameLayers.ACTORS] as const;
export const VISION_BLOCKING_LAYERS = [GameLayers.WALLS] as const;

export const GAMEPLAY_VISIBLE_LAYERS = [
  GameLayers.BACKGROUND, GameLayers.FLOOR, GameLayers.COLLECTIBLES,
  GameLayers.WALLS, GameLayers.ACTORS, GameLayers.EPHEMERALS, GameLayers.TEXT,
] as const;
```

## Genre Examples

### Roguelike
```
BACKGROUND:    Dungeon floor variations
FLOOR:         Lava, water
LOGIC:         Spawn points, safe zones
COLLECTIBLES:  Gold, potions, keys
WALLS:         Dungeon walls, doors
ACTORS:        Player, monsters
EPHEMERALS:    Fireballs, explosions
TEXT:          HP, inventory UI
```

### Puzzle (Sokoban)
```
BACKGROUND:    Background pattern
FLOOR:         Floor tiles
LOGIC:         Win condition zones
COLLECTIBLES:  Optional gems
WALLS:         Immovable walls
ACTORS:        Player, movable boxes
EPHEMERALS:    Push animations
TEXT:          Move counter
```

### Side Scroller
```
BACKGROUND:    Sky/clouds
FLOOR:         Ground/water
LOGIC:         Enemy spawn triggers
COLLECTIBLES:  Power-ups, coins
WALLS:         Obstacles, platforms
ACTORS:        Player ship, enemies
EPHEMERALS:    Bullets, explosions
TEXT:          Score, lives
```

## Known Limitations

### 1. No Overhead Elements
WALLS render below ACTORS. Cannot create archways or tree canopies that obscure the player. Games must use flat 2.5D perspective.

**This is a fundamental constraint.**

### 2. No Actor Stacking
One entity per layer. Flying units cannot pass over ground units; party members cannot stack.

**Workaround**: Use entity properties (`ignoresWalls: true`) or layer transitions (ACTORS → EPHEMERALS → ACTORS).

### 3. Single Collectible Per Cell
Cannot have two collectibles (coin + key) in one cell.

**Workaround**: Container entities or adjacent placement.

### 4. No Parallax Scrolling
Background layer is static and grid-aligned.

**This is a fundamental constraint.**

## Best Practices

### DO:
- ✓ Use `GameLayers` constants (not magic numbers)
- ✓ Check blocking layers before movement
- ✓ Store terrain in `values[]`, entities in `items[]`
- ✓ Use LOGIC layer for invisible mechanics
- ✓ Keep TEXT layer free from gameplay logic

### DON'T:
- ✗ Create custom layers beyond the 8 defined
- ✗ Store entities in `values[]` or terrain in `items[]`
- ✗ Make LOGIC layer visible during gameplay
- ✗ Block movement with COLLECTIBLES layer
- ✗ Put gameplay effects in BACKGROUND layer

## Summary

**Benefits**:
- Consistency across all game types
- Clear semantic meaning
- Simple fixed structure
- Sufficient for diverse genres

**Core Rules**:
- One entity per layer per cell
- Higher layers render on top
- Only WALLS block vision
- WALLS and ACTORS block movement
- Empty floor cells can block (game setting)

---

**Version**: 1.1 (2026-01-27)  
**Status**: Authoritative specification for all Spartan Framework implementations
