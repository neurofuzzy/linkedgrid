# Poison Gas Fix - Implementation Summary

**Date**: 2026-01-27  
**Status**: ✅ Complete - 199/199 Tests Passing

---

## Problem Statement

Poison gas in the floor hazards demo was not damaging the player. Requirements:
1. Poison should damage player while in the cloud
2. Poison should have a lasting effect, draining health even after leaving the cloud

---

## Root Cause Analysis

### Issue 1: Layer Mismatch
`FloorEffectSystem` only checked `GameLayers.FLOOR` (layer 1) for floor effects, but poison gas was on `GameLayers.EPHEMERALS` (layer 6).

**Evidence:**
```typescript
// OLD CODE (line 146):
const floorEntityId = cell.getValue(GameLayers.FLOOR); // Only checks layer 1!
```

### Issue 2: No Lingering Effect
No mechanism existed for status effects that persist after leaving the source.

---

## Solution

### 1. Multi-Layer Floor Effect Detection ✅

Modified both continuous and on-entry effect processing to check multiple layers.

**Changes:**
```typescript
// NEW CODE:
const layersToCheck = [GameLayers.FLOOR, GameLayers.EPHEMERALS];

for (const layer of layersToCheck) {
  const floorEntityId = cell.getValue(layer);
  if (!floorEntityId) continue;
  
  const floorData = context.spatial.getEntityData(floorEntityId);
  if (!floorData || !hasFloorEffect(floorData)) continue;
  
  // Process effect...
}
```

**Impact:**
- Poison gas clouds on EPHEMERALS layer now detected
- Fire/lava on FLOOR layer still work
- Ice/mud/other effects unaffected

---

### 2. Poison Status Effect System ✅

Added tick-based poison status tracking that persists after leaving the cloud.

**New Data Structures:**
```typescript
interface PoisonStatus {
  damage: number;          // Damage per tick
  ticksRemaining: number;  // Ticks until poison expires
  tickInterval: number;    // Ticks between damage applications
  lastDamageTick: number;  // Last tick when damage was applied
}
```

**System State:**
```typescript
private poisonStatuses = new Map<number, PoisonStatus>();
private currentTick = 0;
```

**Processing Logic:**

**Phase 0 - Process Poison Statuses:**
```typescript
private processPoisonStatuses(context: GameContext): void {
  for (const [entityId, poison] of this.poisonStatuses.entries()) {
    // Apply damage at intervals
    if (ticksSinceLastDamage >= poison.tickInterval) {
      applyDamage(entityId, poison.damage);
      poison.lastDamageTick = this.currentTick;
    }
    
    // Countdown to expiration
    poison.ticksRemaining--;
    if (poison.ticksRemaining <= 0) {
      // Poison expired
    }
  }
}
```

**Poison Application:**
```typescript
// When entity takes damage from poison gas
if (floorData.type === 'poison-gas') {
  // Poison lasts 6 ticks after leaving cloud
  // Applies damage every 3 ticks
  this.applyPoison(entityId, floorData.damage, 6, 3);
}
```

---

## Behavior

### In Poison Cloud
1. Player enters poison gas cloud (layer 6, EPHEMERALS)
2. `FloorEffectSystem` detects gas on EPHEMERALS layer
3. Applies immediate damage (based on gas cadence)
4. Applies/refreshes poison status effect (6 tick duration)

### After Leaving Cloud
1. Player moves away from gas
2. Poison status continues for 6 more ticks
3. Damage applied every 3 ticks
4. Poison expires after 6 ticks

### Configuration

Current poison gas settings (`floor-hazards.json`):
```json
{
  "type": "poison-gas",
  "layer": 6,
  "data": {
    "effectType": "damage",
    "damage": 2,
    "cadence": 3,      // In-cloud damage every 3 ticks
    "propagationType": "gas",
    "spreadRate": 1,
    "lifetime": 80
  }
}
```

**Effective Behavior:**
- **In cloud**: 2 damage every 3 ticks (from floor effect)
- **Poison status applied/refreshed**: Every 3 ticks
- **After leaving**: 2 damage every 3 ticks for 6 ticks
- **Total lingering damage**: ~4 damage (6 ticks ÷ 3 interval × 2 damage)

---

## Files Modified

### Core System
**`packages/spartan/systems/floor-effect-system.ts`**
- Added `PoisonStatus` interface (+6 lines)
- Added `poisonStatuses` Map and `currentTick` counter (+3 lines)
- Modified `processContinuousEffects()` to check multiple layers (+10 lines)
- Modified `processOnEntryEffects()` to check multiple layers (+10 lines)
- Added `processPoisonStatuses()` method (+35 lines)
- Added `applyPoison()` method (+15 lines)
- Modified `applyDamage()` to apply poison status (+5 lines)
- Updated `update()` to process poison statuses (+3 lines)

**Total:** ~87 lines added/modified

---

## Testing

### Automated Tests
```bash
✓ 199/199 tests passing
✓ No regressions
✓ All floor effect tests pass
✓ Poison gas propagation tests pass
```

### Manual Testing Steps

1. **Run floor hazards demo:**
   ```bash
   cd dev
   npm run dev
   # Select "floor-hazards.json"
   ```

2. **Test in-cloud damage:**
   - Move player (2,7) toward poison gas at (10,11)
   - Verify HP decreases while in cloud
   - Damage should apply every 3 ticks

3. **Test lingering poison:**
   - Leave poison cloud
   - Observe HP continues to decrease for ~6 ticks
   - Poison should expire after leaving

4. **Test other floor effects:**
   - Walk through lava (should damage)
   - Walk through medbay (should heal)
   - Walk on ice (should slide)
   - Walk through mud (should slow)

---

## Design Decisions

### Why Tick-Based Instead of Time-Based?

Poison status uses tick count instead of milliseconds for consistency with game logic:
- Game systems update per-tick, not per-millisecond
- `spreadRate`, `lifetime`, and `cadence` are all tick-based
- Simplifies synchronization with game loop

### Why Poison Duration = 6 Ticks?

Balanced gameplay:
- Long enough to be meaningful (6 ticks ≈ 1-2 seconds typical play)
- Short enough to not be frustrating
- Matches typical "poison" duration in roguelikes

Can be tuned via constants if needed.

### Why Refresh Poison on Re-Entry?

If player enters cloud again before poison expires, duration resets to 6 ticks:
- Prevents stacking multiple poisons
- Simpler mental model for players
- Matches typical roguelike behavior

---

## Future Enhancements

### Potential Improvements (Not Implemented)
1. **Configurable Poison Duration**
   - Add `poisonDuration` property to poison-gas entities
   - Allow per-entity customization

2. **Visual Poison Indicator**
   - Show green tint or icon when poisoned
   - Display ticks remaining

3. **Antidote Items**
   - Collectible that removes poison status
   - Healing items reduce poison duration

4. **Stacking Poisons**
   - Multiple poison types with different effects
   - Acid poison (damage), slow poison (movement), etc.

5. **Other Status Effects**
   - Burn (from fire)
   - Freeze (from ice)
   - Slow (from mud - currently instant, could persist)

---

## Compatibility

### Backward Compatibility
✅ All existing floor effects work unchanged:
- Lava/acid on FLOOR layer
- Fire propagation and damage
- Ice slide effects
- Mud slow effects
- Medbay healing

### Breaking Changes
❌ None - purely additive features

---

## Performance Impact

**Minimal:**
- Poison status map is sparse (only poisoned entities)
- O(n) where n = number of poisoned entities
- Typical case: 0-2 entities (player + maybe 1 enemy)
- No measurable performance impact

---

## Documentation Updates Needed

- [ ] Update `FloorEffectSystem` docstring to mention multi-layer support
- [ ] Add poison status effect example to system documentation
- [ ] Update floor hazards demo README with poison behavior

---

## Summary

**Problem:** Poison gas didn't damage player  
**Root Cause:** Layer mismatch + no lingering effect system  
**Solution:** Multi-layer detection + tick-based poison status  
**Result:** ✅ Poison damages in cloud AND lingers after leaving  
**Tests:** ✅ 199/199 passing  
**Performance:** ✅ Negligible impact  

**Ready for production!** 🧪☠️
