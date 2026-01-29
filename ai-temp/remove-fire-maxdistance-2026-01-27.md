# Remove maxDistance from Fire - January 27, 2026

## Rationale

Fire spread is naturally limited by the availability of flammable materials (grass, gasoline, fuses, etc.). Adding an artificial `maxDistance` cap is redundant and contradicts the flammability system's design.

**Fire should only spread as far as there are flammable entities to consume.**

## Changes Made

### Documentation Updates (3 files)
1. **propagation-system.ts** - Updated example in class documentation
2. **traits.ts** - Updated `HasPropagation` trait example
3. **entity-types.ts** - Updated `FireData` type example

All examples now show fire without `maxDistance` and include a comment explaining why.

### Test Files (3 files)
Removed `maxDistance` from all fire entity definitions in:
1. **propagation.visual.test.ts**
   - "fire spreads to adjacent cells" test
   - "fire blocked by walls" test
   - "fire spreads and damages player" test
   - "multiple fire sources spread independently" test
   - Removed entire "fire respects max distance limit" test (no longer relevant)

2. **flammability.visual.test.ts** 
   - All 6 flammability test scenarios

3. **scene-integration.test.ts**
   - Both integration test scenarios

### Demo Scenes (2 files)
1. **dev/games/flammability.json** - Removed from fire entity
2. **dev/games/floor-hazards.json** - Removed from fire entity

## Why Other Propagation Types Keep maxDistance

### Liquids (Water, Oil)
- **Need distance limits** - water should pool and stop, not spread infinitely
- Example: Water flood should stop at a reasonable distance from source
- `maxDistance` controls pool size

### Gas (Poison, Smoke)
- **Need distance limits** - gas should dissipate over distance
- Example: Poison gas cloud shouldn't fill entire level
- `maxDistance` represents diffusion range

### Chain Reactions (Explosions)
- **Need distance limits** - explosion propagation has physical limits
- Example: Chain of bombs shouldn't trigger infinitely far
- `maxDistance` represents blast radius

### Fire is Different
- **Naturally limited** - fire can only spread TO flammable entities
- No flammable material = fire stops automatically
- `maxDistance` was redundant and potentially confusing

## Impact

### Before
```typescript
spatial.spawn('fire', 10, 10, GameLayers.FLOOR, {
  propagationType: 'fire',
  spreadRate: 2,
  spreadProbability: 0.6,
  spreadLayer: GameLayers.FLOOR,
  spreadType: 'fire',
  maxDistance: 5,  // ❌ Artificial limit
  lifetime: 20,
  blockedByLayers: [GameLayers.WALLS]
});
```

### After
```typescript
spatial.spawn('fire', 10, 10, GameLayers.FLOOR, {
  propagationType: 'fire',
  spreadRate: 2,
  spreadProbability: 0.6,
  spreadLayer: GameLayers.FLOOR,
  spreadType: 'fire',
  // No maxDistance - fire spread is limited by flammable materials
  lifetime: 20,
  blockedByLayers: [GameLayers.WALLS]
});
```

## Design Benefits

1. **More Intuitive**: Fire behavior matches real-world expectations
2. **Simpler**: One less parameter to configure for fire
3. **More Flexible**: Fire can spread as far as flammable materials exist
4. **Better Level Design**: Map designers control fire spread by placement of flammable entities
5. **Consistent with Flammability System**: The flammability trait system naturally limits fire

## Testing

- ✅ All 199 tests passing
- ✅ Fire still spreads correctly through flammable materials
- ✅ Fire still stops at non-flammable barriers
- ✅ Fire still respects blocked layers (walls)
- ✅ Flammability system works as expected

## Files Modified

### Core System
- `packages/spartan/systems/propagation-system.ts` (documentation only)

### Type Definitions & Traits
- `packages/spartan/entities/traits.ts` (documentation only)
- `packages/spartan/entities/entity-types.ts` (documentation only)

### Tests
- `packages/spartan/test/propagation.visual.test.ts`
- `packages/spartan/test/flammability.visual.test.ts`
- `packages/spartan/test/scene-integration.test.ts`

### Demo Scenes  
- `dev/games/flammability.json`
- `dev/games/floor-hazards.json`

## Backward Compatibility

**No breaking changes** - the `maxDistance` property is optional in `HasPropagation`. Existing code with `maxDistance` will still work, it will just be ignored by the system when checking fire spread (fire checks for flammable entities instead).

## Future Consideration

If there's ever a need to artificially limit fire spread (e.g., "weak fire that can't spread far"), consider:
1. Using `lifetime` to make fire burn out quickly
2. Using lower `spreadProbability` to make spread less likely
3. Level design with strategic placement of non-flammable barriers

Rather than reintroducing `maxDistance` for fire.
