# Spartan Framework Layer Architecture Specification

## Overview

The Spartan Framework uses a fixed 8-layer architecture for all games created with the system. This opinionated structure provides a consistent mental model that works across multiple game genres while remaining simple enough for non-programmers to understand.

## Design Principles

1. **Fixed Layer Count**: Exactly 8 layers, always present, numbered 0-7
2. **Semantic Meaning**: Each layer has a specific game design purpose
3. **Entity Exclusivity**: Each entity occupies exactly one layer at a time
4. **Visual Stacking**: Higher layer numbers render on top of lower layers
5. **Multi-Entity Cells**: Multiple entities can occupy the same cell on different layers
6. **Genre Agnostic**: The same 8 layers work for roguelikes, puzzle games, shooters, adventure games, etc.

## The 8 Layers

### Layer 0: BACKGROUND
**Purpose**: Visual decoration with no gameplay effect

**Typical Contents**:
- Decorative patterns (clouds, stars, wallpaper)
- Parallax elements
- Ambient visual details

**Data Storage**:
- `values[0]`: Background tile type/ID
- `items[0]`: Rarely used

**Gameplay Impact**: None - purely cosmetic

**Example Uses**:
- Roguelike: Dungeon floor variations
- Shmup: Scrolling starfield
- Puzzle: Background pattern

---

### Layer 1: FLOOR
**Purpose**: Walkable terrain that may have gameplay effects

**Typical Contents**:
- Ground tiles (grass, stone, sand)
- Interactive terrain (lava, water, ice, teleport pads)
- Surface effects

**Data Storage**:
- `values[1]`: Floor type (determines behavior)
- `items[1]`: Rarely used (terrain is typically in values)

**Gameplay Impact**: 
- Characters can walk on floor tiles
- May trigger effects (damage from lava, slipping on ice)
- Does not block movement or vision

**Example Uses**:
- Roguelike: Stone floor, lava (damages player)
- Side-scroller: Ground/platform surface
- Adventure: Different terrain types with movement costs

---

### Layer 2: LOGIC
**Purpose**: Invisible AI and editor helpers

**Typical Contents**:
- Spawn points
- Waypoints for AI pathfinding
- Tagged regions (shop zone, danger area)
- Trigger volumes
- Level transitions

**Data Storage**:
- `values[2]`: Region tags, zone types
- `items[2]`: Waypoint entities, spawn point entities

**Gameplay Impact**:
- Affects game logic but not visuals
- Never renders during gameplay
- Only visible in editor/debug mode

**Example Uses**:
- Roguelike: Monster spawn points, safe zones
- Shmup: Enemy wave spawn triggers
- Adventure: Room transition markers

---

### Layer 3: COLLECTIBLES
**Purpose**: Items that can be picked up by the player

**Typical Contents**:
- Coins, gems, points
- Keys, quest items
- Power-ups, health packs
- Weapons, upgrades

**Data Storage**:
- `values[3]`: Rarely used
- `items[3]`: Collectible entity IDs

**Gameplay Impact**:
- Does not block movement
- Triggers collection logic when player overlaps
- Typically removed from grid after collection

**Example Uses**:
- Roguelike: Gold, potions, scrolls
- Platformer: Coins, power stars
- Puzzle: Keys needed to unlock doors

---

### Layer 4: WALLS
**Purpose**: Static blocking elements

**Typical Contents**:
- Walls, barriers
- Locked doors
- Destructible obstacles
- Immovable terrain

**Data Storage**:
- `values[4]`: Wall type (stone, glass, metal)
- `items[4]`: Door entities, destructible wall entities

**Gameplay Impact**:
- Blocks character movement
- Typically blocks vision/line-of-sight
- Renders below actors (layer 5)

**Example Uses**:
- Roguelike: Dungeon walls, closed doors
- Puzzle: Immovable walls
- Shmup: Asteroids, barriers

---

### Layer 5: ACTORS
**Purpose**: Dynamic moving entities

**Typical Contents**:
- Player character(s)
- Enemies, monsters
- NPCs (non-player characters)
- Moving platforms
- Vehicles

**Data Storage**:
- `values[5]`: Rarely used
- `items[5]`: Actor entity IDs

**Gameplay Impact**:
- Typically blocks movement (only one actor per cell)
- Subject to AI/player control
- Renders above walls (layer 4)

**Example Uses**:
- Roguelike: Player, goblins, dragons
- Platformer: Mario, Goombas, Koopas
- Puzzle: Player, movable boxes

---

### Layer 6: EPHEMERALS
**Purpose**: Temporary visual effects and projectiles

**Typical Contents**:
- Projectiles (bullets, arrows, fireballs)
- Explosions
- Particle effects
- Energy beams
- Animation overlays
- Screen shake markers

**Data Storage**:
- `values[6]`: Rarely used
- `items[6]`: Ephemeral entity IDs

**Gameplay Impact**:
- Short lifespan (typically frames to seconds)
- May or may not block movement (depends on game)
- Cleaned up frequently
- Entity exclusivity applies (one ephemeral per cell)

**Example Uses**:
- Roguelike: Magic missile, explosion sprites
- Shmup: Bullet trails, laser beams
- Platformer: Jump dust, coin sparkle

---

### Layer 7: TEXT
**Purpose**: UI elements and text overlays

**Typical Contents**:
- HUD elements (health bars, score)
- Menus (pause, inventory, game over)
- Dialog boxes
- Floating combat text
- Tutorial messages
- Debug overlays

**Data Storage**:
- `values[7]`: Character codes for cell-based text rendering
- `items[7]`: Text/UI entity IDs

**Gameplay Impact**:
- Always renders on top of everything
- Does not affect walkability, vision, or collision
- Can be screen-space (HUD) or world-space (nameplates)
- Frequently cleared/rewritten

**Example Uses**:
- All games: Score, health, lives
- RPG: Dialog boxes, quest text
- Any genre: "Game Over", "Paused"

---

## Rendering Order

Layers render from lowest to highest (back to front):

```
Layer 0 (BACKGROUND)    ← Furthest back
Layer 1 (FLOOR)
Layer 2 (LOGIC)         ← Invisible during gameplay
Layer 3 (COLLECTIBLES)
Layer 4 (WALLS)
Layer 5 (ACTORS)
Layer 6 (EPHEMERALS)
Layer 7 (TEXT)          ← Topmost
```

**Special Case**: Layer 2 (LOGIC) renders only in editor/debug mode.

---

## Cell Data Arrays

Each `LinkedCell` contains four parallel arrays for different data types:

### `items[layer]`: Entity Occupancy
- Stores entity IDs (numbers)
- Managed by `SpatialSystem`
- One entity ID per layer
- `undefined` means layer is empty

**Example**:
```typescript
cell.items[GameLayers.WALLS] = undefined;       // No wall
cell.items[GameLayers.ACTORS] = 42;            // Player (entity ID 42)
cell.items[GameLayers.COLLECTIBLES] = 108;     // Coin (entity ID 108)
```

### `values[layer]`: Terrain/Tile Types
- Stores tile type IDs (numbers)
- Set by game logic
- Used by spatial algorithms (blockFn, passFn)

**Example**:
```typescript
cell.values[GameLayers.BACKGROUND] = TILE_DIRT_PATTERN;
cell.values[GameLayers.FLOOR] = FLOOR_LAVA;
cell.values[GameLayers.WALLS] = WALL_STONE;
```

### `masks[layer]`: Boolean Properties
- Stores boolean flags
- Game-specific properties
- Examples: explored, revealed, highlighted

**Example**:
```typescript
cell.masks[0] = true;   // Cell explored (fog of war)
cell.masks[1] = false;  // Cell not currently visible
cell.masks[2] = true;   // Cell highlighted (pathfinding preview)
```

### `distances[layer]`: Computed Fields
- Stores numeric calculations (numbers)
- Written by algorithms (Dijkstra maps, lighting, influence)
- Read for AI movement, rendering

**Example**:
```typescript
cell.distances[0] = 8;    // Distance to player (for AI)
cell.distances[1] = 255;  // Light intensity
cell.distances[2] = 3;    // Distance to nearest exit
```

---

## Blocking and Vision

### Movement Blocking
Typically checked for layers:
- `WALLS` (layer 4)
- `ACTORS` (layer 5)

```typescript
function isBlocked(cell: LinkedCell): boolean {
  return cell.items[GameLayers.WALLS] !== undefined ||
         cell.items[GameLayers.ACTORS] !== undefined;
}
```

### Vision Blocking
Typically checked for:
- `WALLS` (layer 4) - both values and items

```typescript
function blocksVision(cell: LinkedCell): boolean {
  return cell.values[GameLayers.WALLS] !== undefined ||
         cell.items[GameLayers.WALLS] !== undefined;
}
```

---

## Layer Usage Across Game Genres

### 1. Roguelike
```
BACKGROUND:    Dungeon floor variations
FLOOR:         Terrain effects (lava, water)
LOGIC:         Spawn points, safe zones
COLLECTIBLES:  Gold, potions, keys
WALLS:         Dungeon walls, doors
ACTORS:        Player, monsters
EPHEMERALS:    Fireballs, explosions
TEXT:          HP, inventory UI
```

### 2. Puzzle Game (Sokoban-style)
```
BACKGROUND:    Background pattern
FLOOR:         Floor tiles
LOGIC:         Win condition zones
COLLECTIBLES:  Optional gems
WALLS:         Immovable walls
ACTORS:        Player, movable boxes
EPHEMERALS:    Push animations
TEXT:          Move counter, level name
```

### 3. Side Scroller (Flyer)
```
BACKGROUND:    Parallax clouds/sky
FLOOR:         Scrolling ground/water
LOGIC:         Enemy spawn triggers
COLLECTIBLES:  Power-ups, coins
WALLS:         Obstacles, platforms
ACTORS:        Player ship, enemies
EPHEMERALS:    Bullets, explosions
TEXT:          Score, lives
```

### 4. Vertical Scroller (Shmup/Driving)
```
BACKGROUND:    Starfield / road edges
FLOOR:         Space / road surface
LOGIC:         Wave triggers
COLLECTIBLES:  Fuel, weapons
WALLS:         Barriers, asteroids
ACTORS:        Player vehicle, enemies
EPHEMERALS:    Lasers, debris
TEXT:          Speed, score
```

### 5. Adventure Game (Zelda-like)
```
BACKGROUND:    Grass pattern
FLOOR:         Different terrain types
LOGIC:         Room transitions
COLLECTIBLES:  Keys, hearts, rupees
WALLS:         Dungeon walls, locked doors
ACTORS:        Link, enemies, NPCs
EPHEMERALS:    Sword slashes, magic
TEXT:          Dialog, item messages
```

### 6. Linked Scenes
```
BACKGROUND:    Scene background
FLOOR:         Scene terrain
LOGIC:         Teleport/exit zones
COLLECTIBLES:  Scene-specific items
WALLS:         Scene boundaries
ACTORS:        Player, scene NPCs
EPHEMERALS:    Transition effects
TEXT:          Scene name, dialog
```

---

## TypeScript Implementation

### Layer Constants
```typescript
/**
 * Spartan Framework Layer Constants
 * 
 * All games use these 8 semantic layers.
 * Each layer has a specific purpose in game design.
 */
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
```

### Helper Constants
```typescript
/**
 * Layers that typically block movement.
 */
export const BLOCKING_LAYERS = [
  GameLayers.WALLS,
  GameLayers.ACTORS,
] as const;

/**
 * Layers that typically block vision.
 */
export const VISION_BLOCKING_LAYERS = [
  GameLayers.WALLS,
] as const;

/**
 * Layers visible during gameplay.
 * LOGIC layer excluded (only visible in editor/debug mode).
 */
export const GAMEPLAY_VISIBLE_LAYERS = [
  GameLayers.BACKGROUND,
  GameLayers.FLOOR,
  GameLayers.COLLECTIBLES,
  GameLayers.WALLS,
  GameLayers.ACTORS,
  GameLayers.EPHEMERALS,
  GameLayers.TEXT,
] as const;

/**
 * All layers (for editor mode).
 */
export const ALL_LAYERS = [
  GameLayers.BACKGROUND,
  GameLayers.FLOOR,
  GameLayers.LOGIC,
  GameLayers.COLLECTIBLES,
  GameLayers.WALLS,
  GameLayers.ACTORS,
  GameLayers.EPHEMERALS,
  GameLayers.TEXT,
] as const;
```

### Utility Functions
```typescript
/**
 * Check if a cell blocks movement.
 */
export function isBlocked(cell: LinkedCell | null): boolean {
  if (!cell) return true;
  return BLOCKING_LAYERS.some(layer => cell.items[layer] !== undefined);
}

/**
 * Check if a cell blocks vision.
 */
export function blocksVision(cell: LinkedCell | null): boolean {
  if (!cell) return true;
  return VISION_BLOCKING_LAYERS.some(layer => 
    cell.values[layer] !== undefined || cell.items[layer] !== undefined
  );
}

/**
 * Check if a cell is walkable.
 */
export function isWalkable(cell: LinkedCell | null): boolean {
  return !isBlocked(cell);
}

/**
 * Get the topmost visible entity in a cell (for rendering).
 */
export function getTopmostEntity(
  cell: LinkedCell,
  visibleLayers = GAMEPLAY_VISIBLE_LAYERS
): number | undefined {
  // Check from top to bottom
  for (let i = visibleLayers.length - 1; i >= 0; i--) {
    const layer = visibleLayers[i];
    const entityId = cell.items[layer];
    if (entityId !== undefined) {
      return entityId;
    }
  }
  return undefined;
}
```

---

## Best Practices

### DO:
- ✓ Use `GameLayers` constants instead of magic numbers
- ✓ Check blocking layers before movement
- ✓ Clean up ephemerals regularly (remove when animation ends)
- ✓ Use LOGIC layer for invisible game mechanics
- ✓ Keep TEXT layer free from gameplay logic
- ✓ Store terrain types in `values[]`, entities in `items[]`

### DON'T:
- ✗ Create custom layers beyond the 8 defined
- ✗ Store entities in `values[]` or terrain in `items[]`
- ✗ Make LOGIC layer visible during gameplay
- ✗ Block movement with COLLECTIBLES layer
- ✗ Put gameplay-affecting elements in BACKGROUND layer
- ✗ Forget to remove collected items from the grid

---

## Migration from Abstract to Concrete

If migrating from an abstract layer system:

**Before** (abstract):
```typescript
const PLAYER_LAYER = 5;
const WALL_LAYER = 3;
cell.items[PLAYER_LAYER] = playerId;
```

**After** (concrete):
```typescript
import { GameLayers } from './layers';
cell.items[GameLayers.ACTORS] = playerId;
cell.items[GameLayers.WALLS] = wallId;
```

The semantic names make code self-documenting and prevent mistakes.

---

## Future Considerations

### Advanced Features (Optional)
- **Layer Renaming**: Allow users to rename layers (e.g., "ACTORS" → "CARS") while keeping the underlying index
- **Layer Visibility Groups**: Preset visibility configurations for different editing modes
- **Layer Locking**: Prevent accidental edits to specific layers
- **Layer Templates**: Pre-configured layer setups for different game genres

### Potential Extensions
- **Sub-layers**: If needed, use entity properties rather than adding more layers
- **Composite Rendering**: Allow entities to render sprites from multiple layers
- **Custom Block Functions**: Per-layer blocking behavior customization

---

## Version History

- **v1.0** (2026-01-25): Initial specification with 8-layer architecture

---

## Summary

The Spartan Framework's 8-layer architecture provides:
- **Consistency**: Same structure for all game types
- **Clarity**: Each layer has a clear purpose
- **Simplicity**: Fixed count reduces decision fatigue
- **Power**: Sufficient for diverse game genres
- **Learnability**: Semantic names are self-documenting

This specification should be treated as the authoritative reference for all Spartan Framework implementations and game creator tools.