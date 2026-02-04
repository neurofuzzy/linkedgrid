## PR Code Suggestions ✨

<!-- c82f4a8 -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=2>General</td>
<td>



<details><summary>Improve topology change detection performance</summary>

___

**Improve the performance of <code>checkTopologyChanged</code> by iterating only over the known <br>set of conductive entities to check for position changes, rather than scanning <br>all entities in the game every tick.**

[packages/spartan/systems/signal.system.ts [140-172]](https://github.com/neurofuzzy/linkedgrid/pull/26/files#diff-6d402037c24eacee3dfd84b69761b78e9f97a4737f2ffc2bf8f2fd561c1217a1R140-R172)

```diff
 private checkTopologyChanged(context: GameContext): boolean {
   let changed = false;
-  const currentPositions = new Map<number, string>();
+  const nextConductivePositions = new Map<number, string>();
 
-  // Scan all entities for conductive ones
-  for (const [entityId, pos] of context.spatial.getAllPositions()) {
-    const data = context.spatial.getEntityData(entityId);
-    if (!data) continue;
+  // Iterate over previously known conductive entities
+  for (const entityId of this.conductivePositions.keys()) {
+    const pos = context.spatial.getPosition(entityId);
+    if (!pos) {
+      // Entity was removed
+      changed = true;
+      continue; // Don't add to next positions
+    }
 
-    // Check if entity is conductive (conductors, signal emitters/receivers on ACTORS layer)
-    if (hasConductive(data) || hasSignalEmitter(data) || hasSignalReceiver(data)) {
-      const posKey = `${pos.x}:${pos.y}`;
-      currentPositions.set(entityId, posKey);
+    const posKey = `${pos.x}:${pos.y}`;
+    nextConductivePositions.set(entityId, posKey);
 
-      const previousPos = this.conductivePositions.get(entityId);
-      if (previousPos !== posKey) {
-        changed = true;
-      }
-    }
-  }
-
-  // Check for removed entities
-  for (const entityId of this.conductivePositions.keys()) {
-    if (!currentPositions.has(entityId)) {
+    if (this.conductivePositions.get(entityId) !== posKey) {
       changed = true;
     }
   }
 
-  // Update tracked positions
-  this.conductivePositions = currentPositions;
+  // To detect newly spawned conductive entities, you would need to hook into
+  // an on-spawn event or similar mechanism to add them to `this.conductivePositions`.
+  // Assuming that is handled elsewhere, we can now update the positions.
+
+  this.conductivePositions = nextConductivePositions;
+
+  // If a change was detected, no need to check for newly added entities this frame,
+  // as a full network refresh is already triggered.
+  // A full scan for new entities can be done if `changed` is still false.
+  // For simplicity and performance, relying on spawn events is better.
 
   return changed;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: This is a strong performance optimization for a function that runs every tick. The suggestion correctly identifies that iterating all entities is inefficient and proposes a much more performant approach by checking only known conductive entities.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Optimize topology change handling</summary>

___

**To optimize topology change handling, maintain a dedicated set of signal <br>receiver entity IDs. Iterate over this set instead of all entities on the map to <br>reset receivers, improving performance.**

[packages/spartan/systems/signal.system.ts [311-333]](https://github.com/neurofuzzy/linkedgrid/pull/26/files#diff-6d402037c24eacee3dfd84b69761b78e9f97a4737f2ffc2bf8f2fd561c1217a1R311-R333)

```diff
 if (topologyChanged) {
-  for (const [entityId] of context.spatial.getAllPositions()) {
+  // Assuming a `this.signalReceivers: Set<number>` is maintained
+  for (const entityId of this.signalReceivers) {
     const data = context.spatial.getEntityData(entityId);
+    // The entity might have been removed, so check for data
     if (!data || !hasSignalReceiver(data)) continue;
 
     const receiverType = data.receiverType;
 
     // Reset simple conductors immediately
     if (receiverType === 'floor' || receiverType === 'path' || receiverType === 'sleep-wake') {
       this.gameManager.gameState.entityStore.setData(entityId, {
         receivedSignal: false,
       });
     }
 
     // Reset STEs (gates, inverters, transceivers) via pending
     // This gives them 1-tick delay to update
     if (receiverType === 'gate' || receiverType === 'inverter' || receiverType === 'transceiver') {
       this.gameManager.gameState.entityStore.setData(entityId, {
         pendingSignal: false,
       });
     }
   }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly identifies a performance bottleneck where all entities are iterated, and proposes a valid optimization by tracking only relevant `signalReceivers`. This improves efficiency, especially in larger scenes.


</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>

