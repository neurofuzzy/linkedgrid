# Fire System Separation - Implementation Status

## Completed Tasks ✓

### 1. Core Implementation
- ✅ Created `HasTemperature` trait replacing `HasFlammability`
- ✅ Created `hasTemperature()` guard, removed `hasFlammability()` and `isFire()`
- ✅ Created complete `FireSystem` with burning entity tracking, temperature spread, and ash spawning
- ✅ Updated `ExplosionSystem` to raise temperature instead of spawning fire entities
- ✅ Removed all fire-specific code from `PropagationSystem`
- ✅ Updated all entity types to use `HasTemperature`
- ✅ Added `FireVisualData` type, removed `FireData` type
- ✅ Exported `FireSystem` from index.ts

### 2. Demo Files
- ✅ Removed all fire entity definitions from 7 JSON files
- ✅ Updated grass, barrel, gasoline, fuse entities to use temperature properties
- ✅ Added `FireSystem` to systems lists in relevant demos

### 3. Infrastructure
- ✅ Updated scene-loader to use `hasTemperature` instead of `hasFlammability`
- ✅ Fixed all imports and exports in index.ts

## Test Status: 219/227 Passing (96.5%)

### Remaining Test Failures (8 tests)

#### 1. `explosion.test.ts` (2 tests)
- **Test**: "ignites flammable entities"
  - **Issue**: Looking for fire entity on FLOOR_EFFECTS, but fire is no longer an entity
  - **Fix**: Check entity temperature instead `expect(grassData.temperature).toBeGreaterThanOrEqual(grassData.flamePoint)`

- **Test**: "explodes when fire entity is at same position"
  - **Issue**: On-fire trigger now checks entity temperature, not fire entity presence
  - **Fix**: Set barrel temperature to trigger explosion, not spawn fire entity

#### 2. `explosion.visual.test.ts` (2 tests)
- **Test**: "explosion ignites flammable entities"
  - **Issue**: Same as above - checking for fire entities
  - **Fix**: Check temperature increase on adjacent entities

- **Test**: "on-fire trigger - barrel explodes when ignited"
  - **Issue**: Barrel needs to reach flamePoint via temperature
  - **Fix**: Add FireSystem to test, set barrel temperature high enough

#### 3. `flammability.visual.test.ts` (1 test)
- **Test**: "fire cannot spread without flammable materials"
  - **Issue**: Test spawns fire entity which no longer exists
  - **Fix**: Spawn ignited grass (with temperature >= flamePoint) and use FireSystem

#### 4. `propagation.visual.test.ts` (1 test)
- **Test**: "fire burns out and leaves ash"
  - **Issue**: Test uses PropagationSystem with fire entities
  - **Fix**: Use FireSystem with ignited entities, check for ash after burnout

#### 5. `scene-integration.test.ts` (2 tests)
- **Test**: "should propagate fire to adjacent grass over multiple ticks"
  - **Issue**: Expects PropagationSystem behavior with fire entities
  - **Fix**: Use FireSystem, check temperature spread to adjacent grass

- **Test**: "should detect missing flammability property"
  - **Issue**: Test checks for flammability warning
  - **Fix**: Update to check for temperature properties warning

## Next Steps

### Pattern for Updating Tests

```typescript
// OLD: PropagationSystem with fire entities
spatial.spawn('fire', 5, 5, GameLayers.FLOOR_EFFECTS, {
  propagationType: 'fire',
  spreadRate: 2,
  spreadProbability: 0.9,
  spreadLayer: GameLayers.FLOOR_EFFECTS,
  spreadType: 'fire',
  lifetime: 20,
});

// NEW: FireSystem with ignited entities
spatial.spawn('grass', 5, 5, GameLayers.FLOOR, {
  temperature: 200,  // Above flamePoint (150)
  flammable: true,
  flamePoint: 150,
  hp: 20,
  maxHp: 20,
  color: '#7cba00',
});

// Replace PropagationSystem with FireSystem
const fireSystem = new FireSystem();
const gameLoop = new GameLoop(spatial);
gameLoop.addSystem(fireSystem);

// Check for fire by temperature, not entity
const grassData = spatial.getEntityData(grassId);
if (grassData && hasTemperature(grassData)) {
  expect(grassData.temperature).toBeGreaterThanOrEqual(grassData.flamePoint);
}

// Check for fire visuals on EPHEMERALS layer
const fireVisualId = spatial.getEntityIdAt(x, y, GameLayers.EPHEMERALS);
expect(fireVisualId).toBeDefined();
```

### Systematic Fix Approach

1. Update explosion tests to check temperature instead of fire entities
2. Update visual tests to use FireSystem and check temperature/visuals
3. Update scene integration tests to use new fire mechanics
4. Run full test suite to verify all 227 tests pass

## Architecture Benefits

The new fire system provides:
- ✅ Temperature-based fire spread (more realistic)
- ✅ Fire as state rather than entity (cleaner design)
- ✅ Visual effects on EPHEMERALS layer (proper separation)
- ✅ Direct HP reduction without floor effects (simpler)
- ✅ Ash spawning on burnout (visual feedback)
- ✅ ExplosionSystem integration via temperature
- ✅ PropagationSystem now focused on liquids/gases only
