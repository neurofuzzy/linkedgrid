# FLOOR_EFFECTS Layer & Fire Damage System Implementation

## Summary

Successfully added a new FLOOR_EFFECTS layer (layer 2) and updated fire to damage flammable entities continuously. This enables barrels and other flammable items to burn down over time and explode when destroyed.

## Changes Made

### 1. New Layer Structure (9 layers total)

**File: `packages/spartan/layers/types.ts`**

Added FLOOR_EFFECTS as layer 2, shifting all subsequent layers up by 1:

```
0: BACKGROUND      (unchanged)
1: FLOOR           (unchanged)
2: FLOOR_EFFECTS   (NEW!) - Fire, acid pools, damage zones
3: LOGIC           (was 2)
4: COLLECTIBLES    (was 3)
5: WALLS           (was 4)
6: ACTORS          (was 5)
7: EPHEMERALS      (was 6)
8: TEXT            (was 7)
```

### 2. Fire System Updates

**PropagationSystem (`packages/spartan/systems/propagation-system.ts`):**
- Fire now spawns on FLOOR_EFFECTS layer instead of FLOOR
- Ash spawns on FLOOR_EFFECTS (marks consumed fire locations)
- Fire checks FLOOR and COLLECTIBLES layers for flammable targets
- Fire consumes flammable entities on FLOOR/COLLECTIBLES when spreading
- Updated flammability probability checks to scan multiple layers

**ExplosionSystem (`packages/spartan/systems/explosion-system.ts`):**
- Explosions spawn fire on FLOOR_EFFECTS with damage properties
- Fire configuration includes: damage: 5, cadence: 2, triggerMode: 'continuous'
- On-fire trigger checks FLOOR_EFFECTS layer for fire entities
- Updated layer iteration to include FLOOR_EFFECTS

**FloorEffectSystem (`packages/spartan/systems/floor-effect-system.ts`):**
- Added FLOOR_EFFECTS to layers checked for floor effects
- Now checks: FLOOR, FLOOR_EFFECTS, EPHEMERALS

### 3. Fire Damage Flow

Fire now operates on a dual-layer system:
- **Fire entity**: Lives on FLOOR_EFFECTS layer
- **Flammable targets**: On FLOOR (grass) or COLLECTIBLES (barrels, gasoline)
- **Damage mechanism**: FloorEffectSystem checks position overlap
  - Fire has `effectType: 'damage'`, `triggerMode: 'continuous'`, `damage: 5`, `cadence: 2`
  - Any entity with HasHealth at the same (x,y) takes continuous damage
  - Barrels burn down: `hp -= 5` every 2 ticks
  - When barrel hp <= 0, ExplosionSystem triggers on-death explosion

### 4. Layer Separation Benefits

**Before FLOOR_EFFECTS:**
- Fire and grass competed for same layer slot
- Liquids (water) and hazards (fire) couldn't coexist
- Fire had to replace terrain

**After FLOOR_EFFECTS:**
- Fire on FLOOR_EFFECTS, grass on FLOOR (no conflict)
- Water can flow on FLOOR while fire burns on FLOOR_EFFECTS above
- Barrels on COLLECTIBLES can burn from fire on FLOOR_EFFECTS below
- Clear semantic distinction: FLOOR = terrain, FLOOR_EFFECTS = hazards

### 5. JSON Demo Files Updated

All 6 demo files migrated to new layer numbering:
- `basic.json` - All layers ≥2 incremented
- `doors-keys.json` - All layers ≥2 incremented
- `explosions.json` - All layers ≥2 incremented, fire moved to layer 2
- `flammability.json` - All layers ≥2 incremented, fire moved to layer 2
- `floor-hazards.json` - All layers ≥2 incremented, fire moved to layer 2
- `teleporter.json` - All layers ≥2 incremented

### 6. Test Suite Updates

**Updated 26 test files** (~464 references):
- All GameLayers constant usages automatically updated
- Fire spawn calls changed to FLOOR_EFFECTS
- Fire assertions check FLOOR_EFFECTS layer
- spreadLayer properties updated to FLOOR_EFFECTS
- Added 2 new tests for fire damaging barrels

**New Tests:**
- `fire continuously damages barrel` - Verifies fire applies damage over time
- `barrel explodes after fire burns it down` - Verifies damage→explosion chain

### 7. Documentation Updates

**Files Updated:**
- `packages/spartan/layers/types.ts` - Layer constant documentation
- `packages/spartan/entities/traits.ts` - HasPropagation examples
- `packages/spartan/entities/entity-types.ts` - FireData and AshData examples

## Verification

**Test Results:**
- ✅ All 225 tests passing
- ✅ All 38 grid tests passing
- ✅ All 18 explosion tests passing (including new barrel tests)
- ✅ All 8 propagation visual tests passing
- ✅ All 6 flammability visual tests passing
- ✅ No new linting errors introduced

## Key Technical Details

**Fire Propagation Logic:**
```typescript
// Fire checks multiple layers for flammable targets
const layersToCheck = [GameLayers.FLOOR, GameLayers.COLLECTIBLES];
for (const layer of layersToCheck) {
  const targetValue = cell.getValue(layer);
  if (targetValue && hasFlammability(targetValue)) {
    // Found flammable target - fire can spread
    // Remove target entity (consumption)
    // Spawn new fire on FLOOR_EFFECTS
  }
}
```

**Fire Damage Mechanism:**
```typescript
// FloorEffectSystem checks FLOOR_EFFECTS for damage sources
// Fire entity has: effectType: 'damage', triggerMode: 'continuous'
// Any entity at same (x,y) position takes damage
// Barrels have HasHealth, so they take damage
// When barrel.hp <= 0, ExplosionSystem detects and triggers explosion
```

## Breaking Changes

This is a breaking change for:
1. All existing JSON scene files (layer numbers shifted)
2. Any code using hardcoded layer numbers instead of GameLayers constants
3. Save files with serialized layer data (if any exist)

**Migration Path:** Always use `GameLayers.X` constants instead of hardcoded numbers.

## Next Steps

The system is now ready for gameplay scenarios:
- Place barrels near flammable materials
- Fire spreads and ignites barrels
- Barrels burn down over ~4-8 ticks (10 HP / 5 damage every 2 ticks = ~4 ticks)
- Exploded barrels can trigger chain reactions
- Water on FLOOR doesn't interfere with fire on FLOOR_EFFECTS
- Gasoline spills on COLLECTIBLES can burn while barrels sit on same layer
