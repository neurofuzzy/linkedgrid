# Linting Cleanup - January 27, 2026

## Summary

Reduced linting issues from **133 problems (2 errors, 131 warnings)** to **94 problems (0 errors, 94 warnings)**.

## Fixed Issues (39 total)

### Critical Errors Fixed (2)
- ✅ Fixed `let` vs `const` errors in `scene-integration.test.ts`

### Core System Type Safety Improvements (32)

#### FloorEffectSystem (8 fixes)
- Added `EntityWithHealth` and `FloorEffectData` interfaces
- Replaced `any` types with proper interfaces in `applyDamage()` and `applyHealing()`
- Fixed unused variable warnings (effectType, triggers)
- Prefixed unused `context` parameter with underscore

#### PropagationSystem (2 fixes)
- Added `PropagationConfig` interface
- Imported and used `LinkedCell` type instead of `any`

#### TraitGuards (18 fixes)
- Replaced all `(entity as any).property` checks with proper `'property' in entity` checks
- Improved type safety across all trait guard functions:
  - `hasHealth()`, `canDealDamage()`, `hasAI()`
  - `hasSceneLocation()`, `hasTeleportTarget()`, `hasInventory()`
  - `isLockable()`, `isCollectible()`, `hasColor()`
  - `hasFloorEffect()`, `hasPropagation()`, `hasFlammability()`

#### GameManager & GameRuntime (4 fixes)
- Added `SaveData` interface for type-safe serialization
- Replaced `any` types with `SaveData` in `load()` methods
- Improved type safety for deserialization casts

### Unused Import Cleanup (5)
- Removed `SparseEntityStore` from `scene.ts`
- Removed `GameLayers` from `player-input-system.ts`
- Removed `PlayerData` from `teleporter-system.ts`
- Fixed unused destructured variable in `spatial-system.ts`

## Remaining Issues (94 warnings)

### By Category

**Dev Tools** (29 warnings)
- `dev/grid-renderer.tsx` - 9 warnings (mostly `any` for React event handlers)
- `dev/playground.tsx` - 8 warnings (mostly `any` for React/demo code)
- `dev/scene-loader.ts` - 10 warnings (`any` for JSON loading)
- `packages/grid/linked-cell-utils.ts` - 1 unused import
- `packages/grid/test/linked-grid.test.ts` - 1 `any` in test

**Visual Test Runner** (13 warnings)
- `visual-runner/lib/test-executor.ts` - 7 `any` types
- `visual-runner/components/*.tsx` - 6 warnings (unused vars, `any`)

**Test Files** (~30 warnings)
- Various test files with `any` types for test fixtures
- Unused variables in test assertions
- Acceptable for test code maintainability

**Core Types** (3 warnings)
- `packages/spartan/types.ts` - 3 `any` in `EntityData` definition
  - These are intentional for flexible entity system
  - `EntityData` uses index signature for extensibility

**Other** (19 warnings)
- Scattered minor issues in non-critical files

## Impact

### Type Safety Improvements
- **32 core system issues** fixed in production code
- Trait guards now use proper type narrowing instead of `any` casts
- Floor effects and propagation systems fully typed
- Serialization now type-safe with `SaveData` interface

### Code Quality
- All **2 errors** eliminated (0 errors remaining)
- **29% reduction** in total linting issues (39 of 133 fixed)
- **Core package** (`packages/spartan/`) significantly improved
- Test coverage maintained: **All 199 tests passing**

### Remaining Work
- Dev tools and test infrastructure contain most remaining `any` types
- These are lower priority as they're not part of the core game engine
- Can be addressed in future cleanup passes if needed

## Files Modified

### Core Systems
1. `packages/spartan/systems/floor-effect-system.ts`
2. `packages/spartan/systems/propagation-system.ts`
3. `packages/spartan/traits/trait-guards.ts`
4. `packages/spartan/game-manager.ts`
5. `packages/spartan/game-runtime.ts`
6. `packages/spartan/spatial-system.ts`
7. `packages/spartan/scene.ts`
8. `packages/spartan/systems/player-input-system.ts`
9. `packages/spartan/systems/teleporter-system.ts`

### Tests
10. `packages/spartan/test/scene-integration.test.ts`

## Recommendations

### For Future Work
1. **Dev Tools**: Consider typing JSON scene definitions with Zod or similar
2. **Visual Runner**: Add proper types for test execution framework
3. **Test Fixtures**: Create typed test helper functions
4. **EntityData**: Consider stricter base type with branded types for specific entities

### Maintenance
- Run `npm run lint` before commits
- Address new `any` types as they're introduced
- Prefer `unknown` over `any` for truly dynamic data
- Use type guards and narrowing instead of type assertions

## Testing

All changes verified with full test suite:
```
✓ 15 test files (199 tests)
✓ All tests passing
✓ No regressions introduced
```
