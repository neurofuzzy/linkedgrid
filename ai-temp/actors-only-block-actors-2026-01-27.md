# Actors Only Block Actors - January 27, 2026

## Problem

Actors were setting the `BLOCKING` mask carte-blanche, which prevented:
- Fire from spreading to cells with players
- Items from spawning on actor positions
- Any other effects from targeting actor cells

This was discovered when testing fire spread after removing `maxDistance` - fire couldn't reach the player because the player was blocking the cell entirely.

## Solution

**Actors now only block other actors, not everything.**

### Changes Made

1. **Updated `updateCellMasks()`** in `spatial-system.ts`
   - Removed actors from setting the `BLOCKING` mask
   - Only walls set the `BLOCKING` mask now
   ```typescript
   // Before
   cell.setMask(CellMasks.BLOCKING, hasWall || hasActor);
   
   // After
   cell.setMask(CellMasks.BLOCKING, hasWall);
   ```

2. **Updated move validation** in `commit()` method
   - Added specific check for actor-to-actor blocking
   - Walls still block everything via `isBlocked()`
   - Actors on ACTORS layer specifically check for other actors
   ```typescript
   // Check if blocked by walls
   if (this.isBlocked(toCell)) {
     // reject move
   }
   
   // If moving on ACTORS layer, also check for other actors
   if (move.layer === GameLayers.ACTORS) {
     const hasActor = toCell.getValue(GameLayers.ACTORS) !== undefined;
     if (hasActor) {
       // reject move
     }
   }
   ```

3. **Updated documentation**
   - `isBlocked()` method documentation
   - `updateCellMasks()` documentation
   - `CellMasks` documentation
   - `BLOCKING_LAYERS` documentation

## Behavior Changes

### Before
- ❌ Actors blocked everything:
  - Other actors ✓ (intended)
  - Fire spread ✗ (unintended)
  - Item spawning ✗ (unintended)
  - Effects ✗ (unintended)

### After
- ✅ Actors only block other actors:
  - Other actors ✓ (intended)
  - Fire spread ✓ (now works!)
  - Item spawning ✓ (now works!)
  - Effects ✓ (now works!)

### What Still Blocks Everything
- Walls (via `BLOCKING` mask)
- Closed doors (via `BLOCKING` mask)
- Other truly blocking terrain

## Examples

### Fire Can Now Reach Players
```typescript
// Grass path leading to player
spatial.spawn('grass', 5, 5, GameLayers.FLOOR, { flammability: 1.0 });
spatial.spawn('player', 5, 5, GameLayers.ACTORS, { hp: 100 });
spatial.spawn('fire', 4, 5, GameLayers.FLOOR, { propagationType: 'fire', ... });

// Fire will now spread to (5,5) FLOOR layer and damage the player!
// Before: Fire would stop at (4,5) because player was blocking
```

### Items Can Spawn on Actor Cells
```typescript
// Player at (10, 10) on ACTORS layer
spatial.spawn('player', 10, 10, GameLayers.ACTORS);

// Can now spawn item at same position on COLLECTIBLES layer
spatial.spawn('key', 10, 10, GameLayers.COLLECTIBLES);

// Before: Spawn would be rejected because player was blocking
```

### Actors Still Block Each Other
```typescript
// Player at (5, 5) on ACTORS layer
spatial.spawn('player', 5, 5, GameLayers.ACTORS);

// Enemy trying to move to (5, 5) on ACTORS layer
spatial.move(enemyId, 5, 5);
spatial.commit();

// Move is rejected - actors still block other actors!
```

## Layer System Design

This change reinforces the layer system's design principle:
- **Layers provide collision domains**
- Entities on different layers don't automatically collide
- Special blocking logic only applies within specific contexts:
  - Walls block everything (truly blocking terrain)
  - Actors block other actors only (living entities)
  - Other layers coexist peacefully

## Testing

All tests pass:
- ✅ 199 tests passing
- ✅ Actor movement tests still work
- ✅ Fire spread tests now work correctly
- ✅ Movement blocking tests pass
- ✅ No regressions

## Impact on Gameplay

1. **Fire is now dangerous to players** - fire can spread to player's cell
2. **Items can be on player cells** - natural for pickup mechanics
3. **Effects apply to actors** - damage zones, healing pads work correctly
4. **Actor collision works** - players and enemies still can't overlap

## Files Modified

1. `packages/spartan/spatial-system.ts`
   - `updateCellMasks()` - removed actors from BLOCKING mask
   - `commit()` - added actor-specific blocking check
   - `isBlocked()` - updated documentation
   - `getBlockedCells()` - updated documentation

2. `packages/spartan/layers/types.ts`
   - `BLOCKING_LAYERS` - updated comment
   - `CellMasks` - updated documentation

## Design Rationale

### Why Not Use a Separate ACTOR_BLOCKING Mask?

We considered adding a separate `ACTOR_BLOCKING` mask but decided against it because:
1. **Simpler** - less mask management overhead
2. **Explicit** - the layer check is clear and intentional
3. **Flexible** - easier to add nuanced blocking logic per layer in the future
4. **Efficient** - one mask check instead of two for walls

### Why Check Layer Specifically?

The check `if (move.layer === GameLayers.ACTORS)` is intentional:
- Only entities on the ACTORS layer need actor blocking
- Other layers (COLLECTIBLES, FLOOR, etc.) should not check for actors
- Keeps the logic explicit and maintainable

## Future Considerations

This pattern could extend to other layers if needed:
- COLLECTIBLES could check for other collectibles (item stacking rules)
- EPHEMERALS could have their own collision rules
- Custom layers could define their own blocking logic

The key principle: **blocking is layer-contextual, not global**.
