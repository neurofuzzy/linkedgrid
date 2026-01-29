## PR Code Suggestions ✨

<!-- 706b7d8 -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=2>Possible issue</td>
<td>



<details><summary>Fix incorrect lifetime calculation for sources</summary>

___

**Correct the lifetime calculation for original propagation sources by tracking <br>their actual spawn tick instead of assuming <code>tick 0</code>.**

[packages/spartan/systems/propagation-system.ts [335-337]](https://github.com/neurofuzzy/linkedgrid/pull/14/files#diff-da7fe36d01404df17a3a99ff5ea1618f70da21a17e791719ec02fb4413f0664dR335-R337)

```diff
-// This is an original source entity, assume it was spawned at tick 0
-// (or we could track original sources separately, but this is simpler)
-spawnTick = 0;
+// This is an original source entity. Use its spawn tick from the spread state.
+const state = this.spreadState.get(entityId);
+spawnTick = state?.spawnTick ?? 0;
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: The suggestion correctly identifies a significant bug where the lifetime of original propagation sources is calculated from `tick 0`, causing them to expire prematurely if spawned mid-game.

</details></details></td><td align=center>High

</td></tr><tr><td>



<details><summary>Use ticks instead of Date.now()</summary>

___

**Replace <code>Date.now()</code> with the internal tick counter for timing continuous effects <br>to ensure deterministic behavior in the <code>FloorEffectSystem</code>.**

[packages/spartan/systems/floor-effect-system.ts [137-145]](https://github.com/neurofuzzy/linkedgrid/pull/14/files#diff-6b1bacec710b0e9a711251cdef059920e509f7045e3f33dc96a80e18c9cea7d4R137-R145)

```diff
 update(context: GameContext): void {
-  const now = Date.now();
   this.currentTick++;
   // Phase 0: Process poison status effects
   this.processPoisonStatuses(context);
   // Phase 1: Process on-entry effects
   this.processOnEntryEffects(context);
-  // Phase 2: Process continuous effects (damage, heal)
-  this.processContinuousEffects(context, now);
+  // Phase 2: Process continuous effects (damage, heal) using tick count
+  this.processContinuousEffects(context, this.currentTick);
   ...
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies that mixing `Date.now()` with tick-based logic leads to non-deterministic behavior, and proposes a valid fix to use the tick counter for all timing.

</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=1>High-level</td>
<td>



<details><summary>Decouple propagation from entity data</summary>

___

**Move propagation properties from individual entities into the <code>PropagationSystem</code>. <br>Entities would then only need a reference ID to the propagation effect, <br>centralizing control and reducing data duplication.**


### Examples:



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/14/files#diff-da7fe36d01404df17a3a99ff5ea1618f70da21a17e791719ec02fb4413f0664dR264-R291">packages/spartan/systems/propagation-system.ts [264-291]</a>
</summary>



```typescript
        const newEntityId = context.spatial.spawn(
          sourceData.spreadType,
          neighbor.x,
          neighbor.y,
          sourceData.spreadLayer,
          {
            // Copy propagation properties so spawned entities can also spread
            propagationType: sourceData.propagationType,
            spreadRate: sourceData.spreadRate,
            spreadProbability: sourceData.spreadProbability,

 ... (clipped 18 lines)
```
</details>




### Solution Walkthrough:



#### Before:
```typescript
// In PropagationSystem.ts

// Each entity's data contains a full copy of propagation properties.
// e.g., { type: 'fire', propagationType: 'fire', spreadRate: 2, ... }

function propagateFromSources(context, sources) {
  for (const [sourceId, pos] of sources) {
    const sourceData = context.spatial.getEntityData(sourceId);
    // ... checks ...

    for (const dir of directions) {
      // ... checks ...
      
      // Spawn new entity and copy ALL properties from the source.
      const newEntityId = context.spatial.spawn(
        sourceData.spreadType,
        neighbor.x, neighbor.y, sourceData.spreadLayer,
        {
          // All properties are duplicated for each new entity.
          propagationType: sourceData.propagationType,
          spreadRate: sourceData.spreadRate,
          spreadProbability: sourceData.spreadProbability,
          // ... and so on for all other properties.
        }
      );
    }
  }
}

```



#### After:
```typescript
// In PropagationSystem.ts

// System holds propagation definitions, referenced by an ID.
const propagationEffects = new Map<number, PropagationEffect>();

// Entity data only holds a reference.
// e.g., { type: 'fire', propagationEffectId: 1 }

function propagateFromSources(context, sources) {
  for (const [sourceId, pos] of sources) {
    const sourceData = context.spatial.getEntityData(sourceId);
    // Get the effect properties from the system, not the entity.
    const effect = propagationEffects.get(sourceData.propagationEffectId);
    // ... checks using `effect` properties ...

    for (const dir of directions) {
      // ... checks ...
      
      // Spawn new entity with only the reference ID.
      const newEntityId = context.spatial.spawn(
        effect.spreadType,
        neighbor.x, neighbor.y, effect.spreadLayer,
        {
          // Only the reference is needed.
          propagationEffectId: sourceData.propagationEffectId,
        }
      );
    }
  }
}

```




<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This is a significant architectural suggestion that correctly identifies data duplication and proposes a more scalable, flexible design by centralizing propagation properties in the system.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=3>General</td>
<td>



<details><summary>Strengthen test assertion for player damage</summary>

___

**Update the 'fire spreads and damages player' test to assert that the player's <br>health has actually decreased, rather than just checking for nearby fire.**

[packages/spartan/test/propagation.visual.test.ts [397-417]](https://github.com/neurofuzzy/linkedgrid/pull/14/files#diff-899082c5417daeaf9fb7f76306e3da779a58f78fc602f1f56857ffde9ae9d276R397-R417)

```diff
-expect('Player took damage from fire (if reached)', () => {
+expect('Player took damage from fire', () => {
   const playerId = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS);
   if (!playerId) {
-    return; // Player might be removed if killed
+    // This can happen if the player is killed by the fire, which is a valid outcome.
+    // We can consider this a pass, as damage was clearly applied.
+    return;
   }
 
   const playerData = spatial.getEntityData(playerId);
-  if (!playerData || typeof playerData.hp !== 'number') {
-    return;
+  if (!playerData || typeof playerData.hp !== 'number' || typeof playerData.maxHp !== 'number') {
+    throw new Error('Player data or HP properties are missing.');
   }
 
-  // Just verify fire spread happened, damage is secondary
-  const fireNearby = Array.from(spatial.getAllPositions()).some(([id, pos]) => {
-    const data = spatial.getEntityData(id);
-    return data?.type === 'fire' && Math.abs(pos.x - 8) <= 1 && Math.abs(pos.y - 5) <= 1;
-  });
-
-  if (!fireNearby) {
-    throw new Error('Fire should have spread near player');
+  if (playerData.hp >= playerData.maxHp) {
+    // Check if fire is even on the player's tile to provide a better error message.
+    const fireAtPlayerPos = spatial.getEntityIdAt(8, 5, GameLayers.FLOOR);
+    const fireData = fireAtPlayerPos ? spatial.getEntityData(fireAtPlayerPos) : null;
+    if (fireData?.type === 'fire') {
+      throw new Error(`Player should have taken damage from fire but HP is full (${playerData.hp}/${playerData.maxHp}).`);
+    } else {
+      // If fire didn't reach, the test setup might be the issue, but we still fail.
+      throw new Error('Player did not take damage, and fire did not reach the player\'s location.');
+    }
   }
 });
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=3 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly points out that the test assertion does not match its description, and proposes a stricter check that properly verifies the player has taken damage.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Improve performance of state cleanup logic</summary>

___

**Optimize the <code>spreadState</code> cleanup logic by iterating over its keys and using <br><code>context.spatial.isAlive()</code> instead of building a set of all existing entities.**

[packages/spartan/systems/propagation-system.ts [365-375]](https://github.com/neurofuzzy/linkedgrid/pull/14/files#diff-da7fe36d01404df17a3a99ff5ea1618f70da21a17e791719ec02fb4413f0664dR365-R375)

```diff
 // Clean up spread state for entities that no longer exist
-const existingEntities = new Set<number>();
-for (const [entityId] of context.spatial.getAllPositions()) {
-  existingEntities.add(entityId);
-}
-
 for (const entityId of this.spreadState.keys()) {
-  if (!existingEntities.has(entityId)) {
+  if (!context.spatial.isAlive(entityId)) {
     this.spreadState.delete(entityId);
   }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion provides a more performant and cleaner way to clean up the `spreadState` map by avoiding an unnecessary iteration over all game entities.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Fallback props into data</summary>

___

**Add a fallback to automatically use the <code>props</code> field as <code>data</code> in the scene loader <br>to support legacy scene files.**

[dev/scene-loader.ts [257-264]](https://github.com/neurofuzzy/linkedgrid/pull/14/files#diff-950f0a4080831ca6034793672a2302efb2c0fe3af1f13faaa883e7fe9890b4b5R257-R264)

```diff
 // Validate schema: Check for common mistake of using 'props' instead of 'data'
 if ((entityDef as any).props && !entityDef.data) {
   console.error(
     `[SceneLoader] ❌ SCHEMA ERROR: ... uses 'props' instead of 'data'.`
   );
+  // Fallback to support legacy JSON
+  entityDef.data = (entityDef as any).props;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: The suggestion improves backward compatibility by automatically handling a deprecated field, preventing silent failures for older scene configurations.

</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>
