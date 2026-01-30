# Flammability System Implementation Retro

**Date**: 2026-01-27  
**Status**: ✅ Complete and Working

---

## Summary

Successfully implemented the flammability system allowing fire to spread probabilistically to flammable entities (grass, gasoline, fuses). The system integrates with the existing PropagationSystem and introduces entity consumption mechanics.

---

## What Went Right ✅

1. **Type System Integration**: The `HasFlammability` trait integrated cleanly with existing entity system
2. **Probabilistic Spread**: Flammability multiplier (0.0-1.0) works intuitively with spread probability
3. **Visual Tests**: Created comprehensive test suite covering all major scenarios
4. **Documentation**: Updated DEVELOPER_CONTEXT.md with clear examples and patterns
5. **Systematic Debugging**: Structured console logging revealed issues quickly during manual testing

---

## What Went Wrong ❌

### Issue 1: JSON Schema Confusion
**Problem**: Used `props` instead of `data` in `flammability.json`, causing entity properties to not load.

**Root Cause**: Unfamiliarity with the scene loader's JSON schema.

**Resolution**: Checked existing demo file (`floor-hazards-demo.json`) to find correct schema.

**Time Lost**: ~5 minutes

---

### Issue 2: Silent Layer Collision Failures ⚠️ CRITICAL
**Problem**: Fire was spawning successfully (returning valid entity IDs) but entities never appeared on grid. Fire kept attempting to spawn at the same location every 2 ticks.

**Root Cause**: 
- Fire tried to spawn on **layer 1**
- Grass (flammable target) was already on **layer 1**  
- Spatial system silently rejected the spawn due to collision
- No errors or warnings indicated the failure

**Why Tests Didn't Catch This**:
- Visual tests spawn fire *adjacent* to flammable materials, allowing fire to spread into empty cells first
- Manual demo JSON had fire spawning into a cell already occupied by grass
- The collision scenario wasn't tested

**Resolution**: Added consumption logic - fire now removes flammable entities before spawning.

**Time Lost**: ~30-45 minutes of debugging

---

### Issue 3: Missing Consumption Mechanic
**Problem**: The original implementation didn't remove flammable entities when fire spread to them.

**Root Cause**: 
- Requirement "fire spreads to flammable entities" was interpreted as spawning fire adjacent to them
- The core mechanic of **consuming** (replacing) the entity wasn't explicitly stated
- No prior example of entity replacement in the codebase

**Resolution**: Added explicit removal logic in `PropagationSystem`:

```typescript
// For fire propagation, consume (remove) the flammable target entity
if (sourceData.propagationType === 'fire') {
  const existingEntity = context.spatial.getEntityData(existingEntityId);
  if (existingEntity && hasFlammability(existingEntity)) {
    context.spatial.remove(existingEntityId);
  }
}
```

**Time Lost**: Minimal once collision issue was identified

---

## Lessons Learned 📚

### 1. Silent Failures Are Dangerous
The spatial system's `commit()` method silently rejects invalid operations. This made debugging extremely difficult.

**Evidence**:
- `spatial.spawn()` returned valid entity IDs
- Console showed "Spawn fire at (4, 7) layer 1"
- But `getEntityIdAt(4, 7, 1)` returned undefined after commit
- No error message or warning indicated collision

**Recommendation**: Add debug logging or warnings when operations are rejected during commit.

---

### 2. Test Scenarios Should Mirror Real Use Cases
Visual tests used fire spreading from adjacent cells, which worked fine. The manual demo had fire spawning directly onto flammable material, exposing the collision bug.

**Recommendation**: Include integration test scenarios that match real gameplay setups.

---

### 3. Entity Mechanics Need Explicit Specification
"Fire spreads to flammable entities" has two valid interpretations:
- Fire spreads *next to* flammable entities (what I implemented initially)
- Fire *replaces* flammable entities (correct behavior)

**Recommendation**: When designing propagation mechanics, explicitly specify:
- Does propagation spawn adjacent or replace?
- What happens to the target entity?
- Are there layer constraints?

---

### 4. Structured Debugging Pays Off
Adding prefixed, systematic console logs (`[PropagationSystem]`, `[GameLoop]`) made it easy to trace execution flow and identify the exact failure point.

**What Worked**:
- Tick-by-tick logging
- Explicit property inspection (`spreadType property: fire type: string`)
- Operation logging before/after commit
- Clear separation between intent staging and commit

---

## Improvements for Next Time 🔧

### High Priority

1. **Add Commit Operation Logging/Warnings**
   - Log when spawn/move/remove operations are rejected
   - Include reason for rejection (collision, out of bounds, etc.)
   - Add optional debug mode to `SpatialSystem`

2. **Scene Loader Validation**
   - Warn if entity JSON uses `props` instead of `data`
   - Validate required traits for known entity types
   - Suggest corrections for common schema mistakes

3. **Integration Test Suite**
   - Add tests that load actual JSON scene configs
   - Test fire spreading in realistic configurations
   - Catch JSON schema errors before manual testing

### Medium Priority

4. **Propagation Mechanics Documentation**
   - Document consumption vs. adjacent spreading patterns
   - Add examples of entity replacement mechanics
   - Clarify layer collision rules

5. **Visual Test Diversity**
   - Include scenarios with pre-existing entities on target cells
   - Test collision cases explicitly
   - Vary fire spawn positions relative to flammable materials

### Low Priority

6. **Scene Config Dry Run Mode**
   - Validate scene JSON without running game
   - Report schema errors, missing required properties, etc.
   - Preview entity placement and potential collisions

---

## Architecture Decisions 🏗️

### Fire Consumption Model
Fire now **consumes** flammable entities by:
1. Checking if target cell has an entity with `HasFlammability`
2. Removing that entity via `context.spatial.remove()`
3. Spawning fire entity in the same cell

This creates the desired gameplay effect of fire "eating" through grass, gasoline, etc.

### Why Not Queue-Based Consumption?
Considered using the ash spawn queue pattern (remove entity on tick N, spawn fire on tick N+1), but rejected because:
- Fire spread should be immediate and visible
- Deferred spawning would create temporal gaps
- Consumption is intrinsic to the spread action, not a lifecycle event

---

## Test Coverage 🧪

### Visual Tests Created
1. ✅ Fire spreads through grass field
2. ✅ Fire spreads through gasoline spill (higher flammability = faster spread)
3. ✅ Fire spreads along fuse
4. ✅ Non-flammable entities block fire spread
5. ✅ Fire cannot spread without flammable materials
6. ✅ Mixed flammability affects spread patterns

### Test Gaps Identified
- ❌ Fire spawning directly onto flammable entity (caught in manual testing)
- ❌ Layer collision scenarios
- ❌ JSON scene loading with invalid schemas

---

## Metrics 📊

- **Implementation Time**: ~2 hours (from previous conversation)
- **Debugging Time**: ~45 minutes (manual testing phase)
- **Lines of Code Changed**: ~150
- **New Files**: 2 (flammability.visual.test.ts, flammability.json)
- **Documentation Updated**: 1 (DEVELOPER_CONTEXT.md)

---

## Final Thoughts 💭

The flammability system is now working correctly and provides a solid foundation for fire-based gameplay mechanics. The main learning is that **silent failures in core systems** (like spatial commit) are expensive to debug and should be addressed with better logging/validation infrastructure.

The system now correctly:
- ✅ Spreads fire only to flammable entities
- ✅ Consumes flammable entities when fire spreads
- ✅ Modifies spread probability by target flammability
- ✅ Handles entity replacement without collisions
- ✅ Works with ash spawning lifecycle
- ✅ Passes all visual tests

**Ready for production use!** 🔥
