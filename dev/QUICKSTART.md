# Quick Start - Spartan Playground

Get up and running with the interactive playground in 2 minutes.

## Step 1: Install & Run

```bash
# In the linkedgrid root directory
npm install
npm run dev
```

The browser will automatically open to `http://localhost:5183/dev/index.html`

## Step 2: Play the Game

You'll see a 20×20 grid with:
- **Blue P** - Your player (center)
- **Gray █** - Walls (perimeter)
- **Yellow *** - Items (corners)

**Move around:**
- Press `W` `A` `S` `D` or arrow keys
- Player moves one cell per game tick
- Walls block your movement

## Step 3: Try Hot Reload

1. Open `dev/games/basic.json` in your editor
2. Find the player entity:
```json
{
  "type": "player",
  "x": 10,
  "y": 10,
  "layer": 5
}
```
3. Change `"x": 10` to `"x": 5`
4. Save the file
5. **Watch the browser** - the scene reloads instantly!
6. Player is now at the new position

## Step 4: Test Scene Transitions

1. Use the dropdown to select **"Teleporter Test"**
2. Walk your player to the cyan `T` at bottom-right
3. After ~1 second, you'll teleport to a new room!
4. New room has red enemies (`E`)
5. Find the teleporter at top-left to return

## That's It!

You now have a working interactive game runtime. Check out:
- `dev/README.md` - Full documentation
- `dev/games/` - Edit JSON files to create new scenes
- `dev/IMPLEMENTATION_SUMMARY.md` - Technical details

## Common Issues

### Browser doesn't open?
Open manually: `http://localhost:5183/dev/index.html`

### Scene not loading?
Check browser console (F12) for JSON syntax errors

### Player not moving?
- Check the debug panel shows tick count increasing
- Try different keys (WASD vs arrows)
- Make sure destination isn't blocked by a wall

### Hot reload not working?
- Make sure you saved the file
- Check Vite dev server is running
- Try hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

## Next Steps

**Create your own scene:**
```bash
# Copy an example
cp dev/games/basic.json dev/games/my-scene.json

# Edit it
code dev/games/my-scene.json

# Add to dropdown in dev/playground.tsx
```

**Add a new entity type:**
1. Add to scene JSON
2. Define character in `grid-renderer.tsx`
3. Add CSS color in `index.html`

**Create a custom system:**
1. Implement `GameSystem` interface
2. Add to `SYSTEM_REGISTRY` in `scene-loader.ts`
3. Reference in scene JSON

Happy developing! 🎮
