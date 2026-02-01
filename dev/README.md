# Spartan Playground - Interactive Runtime

A web-based interactive development environment for testing Spartan game scenes.

## Features

- **JSON Scene Loading** - Define scenes declaratively with entities, walls, teleporters
- **Keyboard Input** - Control player with WASD or arrow keys
- **Hot Reload** - Edit JSON files and see changes instantly
- **Debug Panel** - Real-time stats (tick count, entity count, player position)
- **Multi-Scene Support** - Test scene transitions with teleporters

## Quick Start

```bash
# Start the dev server
npm run dev

# Browser will open automatically to http://localhost:5183/dev/index.html
```

## Usage

1. **Select a Scene** - Use the dropdown to switch between example scenes
2. **Control the Player** - Press `W`/`A`/`S`/`D` or arrow keys to move
3. **Edit Scenes** - Modify JSON files in `dev/games/` and see instant updates
4. **Test Systems** - Add game systems to see how they interact with the runtime

## Scene Format

Scenes are defined in JSON with the following structure:

```json
{
  "scenes": [
    {
      "id": "room1",
      "name": "Starting Room",
      "width": 20,
      "height": 20,
      "entities": [
        {
          "type": "player",
          "x": 10,
          "y": 10,
          "layer": 5,
          "data": { "hp": 100 }
        }
      ]
    }
  ],
  "initialScene": "room1",
  "systems": ["TeleporterSystem"],
  "tickRate": 10
}
```

### Entity Layers

- **0 - BACKGROUND**: Decorative elements
- **1 - FLOOR**: Walkable terrain (teleporters go here)
- **2 - LOGIC**: Invisible triggers, spawn points
- **3 - COLLECTIBLES**: Items (non-blocking)
- **4 - WALLS**: Static blocking elements
- **5 - ACTORS**: Moving entities (player, enemies)
- **6 - EPHEMERALS**: Projectiles, effects
- **7 - TEXT**: UI overlays

### Entity Types

- `player` - Controllable character (blue P)
- `enemy` - Hostile NPC (red E)
- `wall` - Blocks movement (gray █)
- `teleporter` - Scene transition trigger (cyan T)
- `item` - Collectible object (yellow *)
- `projectile` - Moving projectile (magenta •)

## Example Scenes

### `basic.json`
Simple room with walls around perimeter. Test basic movement.

### `teleporter.json`
Two connected rooms with teleporter pads. Test scene transitions.

## Creating Custom Scenes

1. Create a new JSON file in `dev/games/`
2. Define scenes, entities, and systems
3. Add to the dropdown in `playground.tsx`:

```typescript
const AVAILABLE_SCENES = [
  { id: 'my-scene', name: 'My Scene', path: '/dev/games/my-scene.json' },
];
```

## Architecture

```
dev/
├── index.html           # Entry point
├── playground.tsx       # Main React component
├── scene-loader.ts      # JSON → GameRuntime parser
├── input-system.ts      # Keyboard input → player movement
├── grid-renderer.tsx    # Visual grid display
└── scenes/
    ├── basic.json       # Basic test scene
    └── teleporter.json  # Multi-scene test
```

## Technical Details

### Hot Reload

Vite automatically watches all imported files. When a JSON scene changes:
1. HMR triggers module reload
2. `useEffect` re-runs with new `sceneKey`
3. Old runtime is stopped and cleaned up
4. New runtime is created with updated scene

### Input Queueing

Keyboard events fire at ~60Hz, but game ticks run at 10Hz. The `InputSystem`:
- Queues all keypresses
- Consumes one move per tick
- Validates movement before staging
- Limits queue to prevent buildup

### Movement Validation

Before staging a move:
1. Check bounds (x, y within grid)
2. Get destination cell
3. Check if walkable (`isWalkable` from `layer-helpers.ts`)
4. Stage move if valid (GameLoop commits)

### Rendering

- Grid updates at 60 FPS (smooth)
- Game logic runs at 10 TPS (configurable)
- Only entities on highest layer per cell are shown (Rule 8)
- Color-coded by entity type

## Troubleshooting

### "Failed to load scene"
- Check JSON syntax (use a validator)
- Verify all entity positions are within grid bounds
- Ensure layer values are 0-7
- Check system names match `SYSTEM_REGISTRY`

### Player not moving
- Check player entity exists with `type: "player"`
- Verify player is on `layer: 5` (ACTORS)
- Ensure destination cells aren't blocked by walls
- Check browser console for errors

### Scene not hot reloading
- Save the JSON file (file system events trigger HMR)
- Check Vite dev server is running
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

## Future Enhancements

- [ ] Visual scene editor (drag & drop entities)
- [ ] Save/load game state
- [ ] Custom system hot reload
- [ ] Entity inspector (click to view data)
- [ ] Pathfinding visualization
- [ ] Field-of-view rendering
- [ ] Tick-by-tick stepping (debugging)
