## PR Code Suggestions ✨

<!-- c91156c -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=2>Possible issue</td>
<td>



<details><summary>Preserve entity ID when respawning</summary>

___

**In <code>applyToBollard</code>, use <code>spatial.spawnWithId</code> instead of <code>spatial.spawn</code> to preserve <br>the bollard's entity ID when it changes state. This prevents dangling references <br>and ensures system stability.**

[packages/spartan/systems/signal.system.ts [398-438]](https://github.com/neurofuzzy/linkedgrid/pull/18/files#diff-6d402037c24eacee3dfd84b69761b78e9f97a4737f2ffc2bf8f2fd561c1217a1R398-R438)

```diff
 private applyToBollard(
   context: GameContext,
   entityId: number,
   pos: { x: number; y: number; layer: number },
   data: any
 ): void {
   const shouldBeOpen = data.receivedSignal; // ON signal = open
   const isOpen = pos.layer !== GameLayers.WALLS;
 
   if (shouldBeOpen && !isOpen) {
-    // Open: move to FLOOR layer (spawn new entity)
+    // Open: move to FLOOR layer (spawn new entity with same ID)
     context.spatial.remove(entityId);
-    context.spatial.spawn(
+    context.spatial.spawnWithId(
+      entityId,
       'bollard-open',
       pos.x,
       pos.y,
       GameLayers.FLOOR,
       {
         receiverType: 'bollard',
         receivedSignal: true,
         color: data.color || '#ff0000',
         sceneId: data.sceneId,
       }
     );
   } else if (!shouldBeOpen && isOpen) {
-    // Close: move to WALLS layer (spawn new entity)
+    // Close: move to WALLS layer (spawn new entity with same ID)
     context.spatial.remove(entityId);
-    context.spatial.spawn(
+    context.spatial.spawnWithId(
+      entityId,
       'bollard-closed',
       pos.x,
       pos.y,
       GameLayers.WALLS,
       {
         receiverType: 'bollard',
         receivedSignal: false,
         color: data.color || '#ff0000',
         sceneId: data.sceneId,
       }
     );
   }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: The suggestion correctly identifies a significant issue where changing a bollard's state discards its entity ID, which can cause dangling references and bugs. Using `spawnWithId`, a function modified in this PR, is the correct and intended solution to maintain entity identity.

</details></details></td><td align=center>High

</td></tr><tr><td>



<details><summary>Strengthen type guard for signal receivers</summary>

___

**Modify the <code>hasSignalReceiver</code> type guard to strictly require the <code>receivedSignal</code> <br>property to be present and of a boolean type. This ensures that only <br>fully-formed signal receivers pass the check, improving type safety.**

[packages/spartan/traits/trait-guards.ts [674-683]](https://github.com/neurofuzzy/linkedgrid/pull/18/files#diff-e6fe0a27a19016994f4da0c6ee5948e9656ec928c82808ef97ff98ac52d8f5d8R674-R683)

```diff
 export function hasSignalReceiver(
   entity: EntityData
 ): entity is BollardData | InverterData | ConductiveFloorData {
   if (!('receiverType' in entity)) return false;
   const receiverType = entity.receiverType;
   return (
     (receiverType === 'bollard' || receiverType === 'inverter' || receiverType === 'floor') &&
-    (!('receivedSignal' in entity) || typeof entity.receivedSignal === 'boolean')
+    'receivedSignal' in entity && typeof entity.receivedSignal === 'boolean'
   );
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a flaw in the `hasSignalReceiver` type guard that weakens type safety by allowing entities without a `receivedSignal` property. Fixing this prevents potential runtime errors and makes the guard more reliable.

</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=3>General</td>
<td>



<details><summary>Optimize receiver updates by iterating fewer entities</summary>

___

**Optimize <code>applyToReceivers</code> by iterating only over entities whose signal state has <br>changed, rather than all entities on the map. This can be achieved by tracking <br>entities in <code>this.currentTickSignals</code> and those powered in the previous tick.**

[packages/spartan/systems/signal.system.ts [365-393]](https://github.com/neurofuzzy/linkedgrid/pull/18/files#diff-6d402037c24eacee3dfd84b69761b78e9f97a4737f2ffc2bf8f2fd561c1217a1R365-R393)

```diff
 private applyToReceivers(context: GameContext): void {
+  // A set of all entities that need a state update.
+  const entitiesToUpdate = new Set(this.currentTickSignals);
+
+  // Also check previously powered entities that might need to be turned off.
+  // This requires tracking previous state, for example:
+  // this.previousTickSignals.forEach(id => entitiesToUpdate.add(id));
+
+  // For simplicity without adding a new state property, we iterate all entities for now.
+  // A future optimization would be to only iterate over entities that have changed state.
+
   // Apply visual/logical state from currentTickSignals
   for (const [entityId, pos] of context.spatial.getAllPositions()) {
+    // This check can be removed if we iterate a smaller set of entities.
+    if (!hasSignalReceiver(context.spatial.getEntityData(entityId)!) && !hasConductive(context.spatial.getEntityData(entityId)!)) {
+      continue;
+    }
+
     const hasSignal = this.currentTickSignals.has(entityId);
+    const data = context.spatial.getEntityData(entityId);
 
-    // Update 'receivedSignal' property on entity for Renderer
-    // This ensures visuals match the resolved state
-    const data = context.spatial.getEntityData(entityId);
     if (data && (hasSignalReceiver(data) || hasConductive(data))) {
-      // Skip writing if not changed? 
-      // For simple sync, just write it.
-      // Avoid overwriting Inverter 'signalState' which was set in resolveCircuit
-      if (data.receiverType !== 'inverter' || !('signalState' in data)) {
-        // Only update strictly receiver props
+      if (data.receivedSignal !== hasSignal) {
+        this.gameManager.gameState.entityStore.setData(entityId, {
+          receivedSignal: hasSignal
+        });
       }
-
-      // Actually, we must update receivedSignal for EVERYONE who cares
-      this.gameManager.gameState.entityStore.setData(entityId, {
-        receivedSignal: hasSignal
-      });
     }
 
     if (data && hasSignalReceiver(data)) {
       if (data.receiverType === 'bollard') {
-        this.applyToBollard(context, entityId, pos, { ...data, receivedSignal: hasSignal });
+        // The data passed to applyToBollard needs the most up-to-date signal state.
+        const updatedData = { ...data, receivedSignal: hasSignal };
+        this.applyToBollard(context, entityId, pos, updatedData);
       }
     }
   }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=2 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion proposes a valid performance optimization by iterating over a smaller, relevant set of entities instead of all entities. While the current implementation is correct, this change would improve efficiency, especially in large scenes.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Warn on duplicate spawnWithId</summary>

___

**Add a <code>console.warn</code> message in <code>spawnWithId</code> to log cases where a spawn fails due <br>to an existing entity ID. This will help detect unintended duplicate-ID spawn <br>attempts during debugging.**

[packages/spartan/core/spatial-system.ts [130-154]](https://github.com/neurofuzzy/linkedgrid/pull/18/files#diff-311e38f7f891bd330c6e8e71daf60fca416e9b8ab269ff5a0ea6931088974a66R130-R154)

```diff
 spawnWithId(
   entityId: number,
   type: string,
   x: number,
   y: number,
   layer: Layer,
   props?: Record<string, unknown>
 ): boolean {
   const success = this.store.createWithId(entityId, type, props);
-  if (!success) return false;
+  if (!success) {
+    console.warn(`spawnWithId: entity ${entityId} already exists, skipping spawn.`);
+    return false;
+  }
 
-  // Stage the spawn operation
   this.pendingOps.push({ /* ... */ });
   return true;
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: The suggestion improves debuggability by adding a warning when a `spawnWithId` call fails due to a duplicate ID. This makes it easier to track down potential logic errors during development without affecting production behavior.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Drop redundant empty conditional</summary>

___

**Remove the redundant and empty <code>if</code> block within <code>applyToReceivers</code> to simplify the <br>code.**

[packages/spartan/systems/signal.system.ts [370-385]](https://github.com/neurofuzzy/linkedgrid/pull/18/files#diff-6d402037c24eacee3dfd84b69761b78e9f97a4737f2ffc2bf8f2fd561c1217a1R370-R385)

```diff
 if (data && (hasSignalReceiver(data) || hasConductive(data))) {
-  // Skip writing if not changed? 
-  // For simple sync, just write it.
-  // Avoid overwriting Inverter 'signalState' which was set in resolveCircuit
-  if (data.receiverType !== 'inverter' || !('signalState' in data)) {
-    // Only update strictly receiver props
-  }
-  // Actually, we must update receivedSignal for EVERYONE who cares
   this.gameManager.gameState.entityStore.setData(entityId, {
     receivedSignal: hasSignal
   });
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 4</summary>

__

Why: The suggestion correctly identifies a commented-out, empty `if` block that serves no purpose and can be removed to improve code clarity. It's a minor but useful cleanup.

</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>

