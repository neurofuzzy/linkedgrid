## PR Code Suggestions ✨

<!-- ac14db2 -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=7>Possible issue</td>
<td>



<details><summary>Handle empty projectile path to prevent crash</summary>

___

**Handle empty projectile paths in <code>initializePath</code> to prevent crashes by marking <br>the projectile for immediate removal.**

[packages/spartan/systems/projectile.system.ts [150-154]](https://github.com/neurofuzzy/linkedgrid/pull/35/files#diff-fa7d17df78052e6c381688b9b446202dd6cb2fbd446ad1abb90d0afb6e04e15eR150-R154)

```diff
 // getLine excludes the start cell — path contains only cells to MOVE to.
 // The entity is already at the start cell; spawn collision is checked
 // separately in onTick so we don't waste a movement step.
 const lineCells = LinkedCellUtils.getLine(startCell, targetCell);
+
+if (lineCells.length === 0) {
+  // Path is empty (e.g., target is same as or adjacent to start).
+  // Mark for immediate removal as it has nowhere to travel.
+  projectile.path = [];
+  projectile.impactTick = context.game.tickCount;
+  return;
+}
+
 projectile.path = lineCells.map((c) => ({ x: c.x, y: c.y }));
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a potential crash when a projectile's path is empty and provides a robust fix by marking the projectile for removal.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Prevent crash when player entity missing</summary>

___

**Add a null check for <code>playerEntity</code> and return early to prevent a potential crash <br>when processing player input.**

[packages/spartan/systems/player-input.system.ts [66-94]](https://github.com/neurofuzzy/linkedgrid/pull/35/files#diff-9d78b1dbf8f8122dfcb1dbcc39ee13d0c32d57545e5787c3931cd67acf3857aeR66-R94)

```diff
 // Update visual state based on input
 const playerEntity = context.spatial.getEntityData(playerId);
-if (playerEntity) {
-  if (lastDirection === Direction.NONE) {
-    // No input -- revert to idle if currently walking
-    if (hasVisualState(playerEntity) && playerEntity.visualState === 'walk') {
-      playerEntity.visualState = 'idle';
-      playerEntity.visualDirty = true;
-    }
-    return;
+if (!playerEntity) {
+  // If no player entity, no input can be processed.
+  if (lastDirection === Direction.NONE) return;
+  // Also return if there is input but no entity to apply it to.
+  return;
+}
+
+if (lastDirection === Direction.NONE) {
+  // No input -- revert to idle if currently walking
+  if (hasVisualState(playerEntity) && playerEntity.visualState === 'walk') {
+    playerEntity.visualState = 'idle';
+    playerEntity.visualDirty = true;
   }
+  return;
+}
 
-  // Set facing from input direction
-  if (hasFacing(playerEntity)) {
-    playerEntity.facing = lastDirection;
+// Set facing from input direction
+if (hasFacing(playerEntity)) {
+  playerEntity.facing = lastDirection;
+}
+
+// Set walk state
+if (hasVisualState(playerEntity) && playerEntity.visualState !== 'attack') {
+  if (playerEntity.visualState !== 'walk') {
+    playerEntity.visualState = 'walk';
+    playerEntity.visualDirty = true;
   }
-
-  // Set walk state
-  if (hasVisualState(playerEntity) && playerEntity.visualState !== 'attack') {
-    if (playerEntity.visualState !== 'walk') {
-      playerEntity.visualState = 'walk';
-      playerEntity.visualDirty = true;
-    }
-  }
-} else if (lastDirection === Direction.NONE) {
-  return;
 }
 
 const delta = this.directionToDelta(lastDirection);
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a potential null reference error that would crash the system if the player entity is not found while there is movement input.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Prevent division by zero error</summary>

___

**Add a check in <code>updateConfig</code> to ensure <code>tickRate</code> is positive before calculating <br><code>tickDurationMs</code> to prevent division by zero.**

[packages/spartan-web/debug-renderer.ts [436-442]](https://github.com/neurofuzzy/linkedgrid/pull/35/files#diff-fa22b64180fb735992517991f71400969db7b346a7006127ea3967b747553a51R436-R442)

```diff
 updateConfig(partial: Partial<DebugRendererConfig>): void {
   Object.assign(this.config, partial);
-  if (partial.tickRate) {
+  if (partial.tickRate && partial.tickRate > 0) {
     this.tickDurationMs = 1000 / partial.tickRate;
   }
   this.resizeCanvas();
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=2 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: This suggestion correctly identifies a potential division-by-zero issue if `tickRate` is `0`, improving the robustness of the `updateConfig` method.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Prevent overriding important visual states</summary>

___

**Modify the NPC visual state logic to prevent overriding 'attack' or 'hurt' <br>states with 'idle' when the NPC is not moving.**

[packages/spartan/systems/npc-movement.system.ts [87-102]](https://github.com/neurofuzzy/linkedgrid/pull/35/files#diff-f252990c88405e3357f3d35b86e4a425e79449afd0824e502bd4c0000a9bcf01R87-R102)

```diff
 // Update lastMoveTick and visual state if the entity moved
 if (moved) {
   entityData.lastMoveTick = currentTick;
 
-  // Update visual state to 'walk' while moving
-  if (hasVisualState(entityData) && entityData.visualState !== 'walk') {
+  // Update visual state to 'walk' while moving, but not if attacking/hurt
+  if (hasVisualState(entityData) && entityData.visualState === 'idle') {
     entityData.visualState = 'walk';
     entityData.visualDirty = true;
   }
 } else {
-  // Revert to idle when not moving
+  // Revert to idle when not moving, only if currently walking
   if (hasVisualState(entityData) && entityData.visualState === 'walk') {
     entityData.visualState = 'idle';
     entityData.visualDirty = true;
   }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=3 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies a logic flaw where an NPC's 'attack' or 'hurt' state could be incorrectly overridden, improving the visual state machine's correctness.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Validate allowed facingMode values</summary>

___

**Enhance the <code>hasFacing</code> type guard to validate that <code>facingMode</code> is one of the <br>expected values, either <code>'2-way'</code> or <code>'4-way'</code>.**

[packages/spartan/traits/trait-guards.ts [1431-1440]](https://github.com/neurofuzzy/linkedgrid/pull/35/files#diff-e6fe0a27a19016994f4da0c6ee5948e9656ec928c82808ef97ff98ac52d8f5d8R1431-R1440)

```diff
 export function hasFacing(
   entity: EntityData
 ): entity is EntityData & HasFacing {
   return (
     'facing' in entity &&
     typeof entity.facing === 'number' &&
     'facingMode' in entity &&
-    typeof entity.facingMode === 'string'
+    (entity.facingMode === '2-way' || entity.facingMode === '4-way')
   );
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion makes the `hasFacing` type guard more specific by validating the value of `facingMode`, which improves type safety and prevents invalid states.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Guard animationTick presence</summary>

___

**Add a check for the <code>animationTick</code> property to the <code>hasAnimation</code> type guard for <br>more complete validation of the <code>HasAnimation</code> trait.**

[packages/spartan/traits/trait-guards.ts [1450-1463]](https://github.com/neurofuzzy/linkedgrid/pull/35/files#diff-e6fe0a27a19016994f4da0c6ee5948e9656ec928c82808ef97ff98ac52d8f5d8R1450-R1463)

```diff
 export function hasAnimation(
   entity: EntityData
 ): entity is EntityData & HasAnimation {
   return (
     'frameCount' in entity &&
     typeof entity.frameCount === 'number' &&
     'currentFrame' in entity &&
     typeof entity.currentFrame === 'number' &&
     'animationMode' in entity &&
     typeof entity.animationMode === 'string' &&
     'frameDuration' in entity &&
-    typeof entity.frameDuration === 'number'
+    typeof entity.frameDuration === 'number' &&
+    'animationTick' in entity &&
+    typeof entity.animationTick === 'number'
   );
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: The suggestion improves the type guard's robustness by checking for the `animationTick` property, ensuring the `HasAnimation` trait is fully validated.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Correct visual states export</summary>

___

**Replace the incorrect export of <code>VISUAL_STATES</code> with the correct <br><code>VISUAL_STATE_PRESETS</code> from the configuration file.**

[packages/spartan/index.ts [92]](https://github.com/neurofuzzy/linkedgrid/pull/35/files#diff-204823dfb785c311debba67468642a35b19df27ed309468bf0f589ead3805ce8R92-R92)

```diff
-export { VISUAL_STATES } from './traits/visual.trait';
+export { VISUAL_STATE_PRESETS } from './config/visual.config';
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=6 -->


<details><summary>Suggestion importance[1-10]: 4</summary>

__

Why: The suggestion correctly identifies and fixes an erroneous export, preventing potential `undefined` import issues in consuming packages.

</details></details></td><td align=center>Low

</td></tr><tr><td rowspan=1>General</td>
<td>



<details><summary>Isolate listener errors</summary>

___

**Wrap event bus listener calls in a <code>try/catch</code> block to prevent one failing <br>listener from halting the execution of others.**

[packages/spartan/core/visual-event-bus.ts [108-114]](https://github.com/neurofuzzy/linkedgrid/pull/35/files#diff-1fdff1c762e7befd9021b838cd23ccf572314306459ab0c91d0767115b0b833eR108-R114)

```diff
 emit(event: VisualEvent): void {
   const set = this.listeners.get(event.type);
   if (!set) return;
   for (const callback of set) {
-    callback(event);
+    try {
+      callback(event);
+    } catch (error) {
+      console.error('[VisualEventBus] listener error', error);
+    }
   }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=7 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: This is a good defensive programming practice that makes the event bus more robust by isolating faulty listeners and preventing them from crashing the event dispatch loop.

</details></details></td><td align=center>Medium

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>
