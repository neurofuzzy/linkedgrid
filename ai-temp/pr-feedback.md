## PR Code Suggestions ✨

<!-- b6a82df -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=3>Possible issue</td>
<td>



<details><summary>Clear wired transceiver states each tick</summary>

___

**Clear the <code>wiredTransceiverStates</code> map at the start of each <code>update</code> cycle to <br>prevent stale states from causing incorrect channel activations on subsequent <br>ticks.**

[packages/spartan/systems/signal.system.ts [91-94]](https://github.com/neurofuzzy/linkedgrid/pull/21/files#diff-6d402037c24eacee3dfd84b69761b78e9f97a4737f2ffc2bf8f2fd561c1217a1R91-R94)

```diff
 update(context: GameContext): void {
+  this.wiredTransceiverStates.clear();
   this.tickCount++;
   // Phase 1: Apply pending signals to STEs (gates, inverters, transceivers)
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: The suggestion correctly identifies a critical bug where stale `wiredTransceiverStates` persist across ticks, leading to incorrect channel state calculations and signal propagation.

</details></details></td><td align=center>High

</td></tr><tr><td>



<details><summary>Fix transceiver signal propagation bug</summary>

___

**Fix a bug in <code>processTransceivers</code> by ensuring an 'off' signal is always <br>propagated when a transceiver's <code>receivedSignal</code> state changes to <code>false</code>, not just <br>when its <code>previousState</code> was <code>true</code>.**

[packages/spartan/systems/signal.system.ts [557-570]](https://github.com/neurofuzzy/linkedgrid/pull/21/files#diff-6d402037c24eacee3dfd84b69761b78e9f97a4737f2ffc2bf8f2fd561c1217a1R557-R570)

```diff
 // Channel not active - turn off transceivers that were channel-powered
 if (hasSignalReceiver(data) && data.receivedSignal) {
   this.gameManager.gameState.entityStore.setData(tx.id, {
     receivedSignal: false,
   });
-}
 
-if (previousState === true) {
+  // Propagate the OFF signal if the state is changing.
+  // This is critical for transceivers that might be wired-powered
+  // but need to propagate an OFF signal when their channel deactivates.
+  if (previousState !== false) {
+    this.previousGeneratorStates.set(tx.id, false);
+
+    const signal = new Signal(tx.id, this.tickCount, false);
+    signal.markVisited(tx.x, tx.y);
+    this.propagateSignal(context, signal);
+  }
+} else if (previousState === true) {
+  // This handles the case where a transceiver was ON but is now OFF
+  // and its receivedSignal was already false (e.g. it was only channel-powered).
   this.previousGeneratorStates.set(tx.id, false);
 
   const signal = new Signal(tx.id, this.tickCount, false);
   signal.markVisited(tx.x, tx.y);
   this.propagateSignal(context, signal);
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a subtle bug where a transceiver's state change to 'off' is not always propagated, potentially leaving connected components in an incorrect state.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Batch gate mutations outside loop</summary>

___

**Refactor the <code>update</code> method to avoid mutating the spatial store while iterating. <br>First, collect gates to be opened or closed, then perform the mutations in <br>separate loops.**

[packages/spartan/systems/gate.system.ts [30-45]](https://github.com/neurofuzzy/linkedgrid/pull/21/files#diff-ab6ada1323874c3f475fb792f9837714f1d10877d1a9cc502c857926490598dcR30-R45)

```diff
 update(context: GameContext): void {
-    // Process all gates
+    const toOpen: Array<[number, { x: number; y: number; layer: number }, any]> = [];
+    const toClose: Array<[number, { x: number; y: number; layer: number }, any]> = [];
     for (const [entityId, pos] of context.spatial.getAllPositions()) {
         const data = context.spatial.getEntityData(entityId);
         if (!data || !isGate(data)) continue;
-
         const shouldBeOpen = data.receivedSignal === true;
         const isOpen = pos.layer !== GameLayers.WALLS;
-
-        if (shouldBeOpen && !isOpen) {
-            this.openGate(context, entityId, pos, data);
-        } else if (!shouldBeOpen && isOpen) {
-            this.closeGate(context, entityId, pos, data);
-        }
+        if (shouldBeOpen && !isOpen) toOpen.push([entityId, pos, data]);
+        else if (!shouldBeOpen && isOpen) toClose.push([entityId, pos, data]);
+    }
+    for (const [id, pos, data] of toOpen) {
+        this.openGate(context, id, pos, data);
+    }
+    for (const [id, pos, data] of toClose) {
+        this.closeGate(context, id, pos, data);
     }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=2 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a potential issue of modifying a collection while iterating over it and proposes a safer pattern, which improves the system's robustness.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=1>High-level</td>
<td>



<details><summary>Separate gate logic from signal system</summary>

___

**The suggestion praises the separation of <code>GateSystem</code> from <code>SignalSystem</code> and <br>recommends applying the same pattern to <code>SleepWake</code> zones. This would involve <br>creating a new system, like an <code>AISystem</code>, to manage NPC activation, thus removing <br>that responsibility from the <code>SignalSystem</code>.**


### Examples:



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/21/files#diff-6d402037c24eacee3dfd84b69761b78e9f97a4737f2ffc2bf8f2fd561c1217a1R377-R495">packages/spartan/systems/signal.system.ts [377-495]</a>
</summary>



```typescript
            if (hasSignalReceiver(data) && data.receiverType === 'sleep-wake') {
              this.handleSleepWake(context, pos.x, pos.y, signal.value);
            }
            break;

          case 'inverter':
          case 'gate':
          case 'transceiver':
            // STEs: set pending, queue for next tick
            if (hasSignalReceiver(data)) {

 ... (clipped 109 lines)
```
</details>




### Solution Walkthrough:



#### Before:
```typescript
// in packages/spartan/systems/signal.system.ts
class SignalSystem {
  // ...
  private propagateSignal(context, signal) {
    // ...
    for (const entityId of entities) {
      const data = context.spatial.getEntityData(entityId);
      // ...
      if (this.classifyEntity(data) === 'conductor') {
        // ...
        if (data.receiverType === 'sleep-wake') {
          // SignalSystem directly handles the effect of waking/sleeping NPCs
          this.handleSleepWake(context, pos.x, pos.y, signal.value);
        }
      }
    }
  }

  private handleSleepWake(context, x, y, signalValue) {
    const actorId = context.spatial.grid.cell(x, y).getValue(GameLayers.ACTORS);
    if (actorId) {
      this.gameManager.gameState.entityStore.setData(actorId, {
        aiActive: signalValue,
      });
    }
  }
}

```



#### After:
```typescript
// in packages/spartan/systems/signal.system.ts
class SignalSystem {
  // ...
  private propagateSignal(context, signal) {
    // ...
    for (const entityId of entities) {
      // ...
      if (this.classifyEntity(data) === 'conductor') {
        // SignalSystem now only sets the signal state on the sleep-wake zone
        if (hasSignalReceiver(data)) {
           this.gameManager.gameState.entityStore.setData(entityId, {
             receivedSignal: signal.value,
           });
        }
      }
    }
  }
  // The handleSleepWake method is removed.
}

// in a new file, e.g., packages/spartan/systems/ai.system.ts
class AISystem {
  update(context) {
    // Iterate over all sleep-wake zones
    for (const [zoneId, pos] of allSleepWakeZones) {
      const zoneData = context.spatial.getEntityData(zoneId);
      const actorId = context.spatial.getEntityIdAt(pos.x, pos.y, GameLayers.ACTORS);
      if (actorId) {
        // A dedicated system reads the signal state and applies the effect
        this.gameManager.gameState.entityStore.setData(actorId, {
          aiActive: zoneData.receivedSignal,
        });
      }
    }
  }
}

```




<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a good design pattern (separating `GateSystem` from `SignalSystem`) and proposes extending it to `SleepWake` zones, which would improve modularity by moving AI state management out of the already complex `SignalSystem`.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=2>General</td>
<td>



<details><summary>Preserve pending signal field</summary>

___

**Preserve the <code>pendingSignal</code> state when a gate is re-spawned by explicitly <br>including <code>pendingSignal: data.pendingSignal</code> in the new entity data.**

[packages/spartan/systems/gate.system.ts [66-79]](https://github.com/neurofuzzy/linkedgrid/pull/21/files#diff-ab6ada1323874c3f475fb792f9837714f1d10877d1a9cc502c857926490598dcR66-R79)

```diff
 context.spatial.spawnWithId(
     entityId,
     'gate-open',
     pos.x,
     pos.y,
     GameLayers.FLOOR,
     {
         receiverType: 'gate',
         receivedSignal: true,
+        pendingSignal: data.pendingSignal,
         color,
-        sceneId: data.sceneId,
-        // Preserve pendingSignal if it existed (though it shouldn't for this tick)
+        sceneId: data.sceneId
     }
 );
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly implements the behavior described in the code comment, fixing a bug where the `pendingSignal` state would be lost when a gate opens.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Correctly apply opacity to colors</summary>

___

**Fix the opacity logic for closed gates to correctly handle colors that already <br>have an alpha channel by first stripping any existing alpha before applying the <br>new one.**

[packages/spartan/systems/gate.system.ts [92-99]](https://github.com/neurofuzzy/linkedgrid/pull/21/files#diff-ab6ada1323874c3f475fb792f9837714f1d10877d1a9cc502c857926490598dcR92-R99)

```diff
 // Make semi-opaque when closed
 let color = data.color || '#ff0000';
 if (color.startsWith('#')) {
-    // If standard hex (7), add alpha
-    if (color.length === 7) {
-        color += '80'; // 50% opacity
+    // Strip any existing alpha
+    if (color.length > 7) {
+        color = color.substring(0, 7);
     }
+    // Add 50% opacity alpha
+    color += '80';
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies a bug in opacity handling for colors that already have an alpha channel and provides a robust fix, improving visual consistency.


</details></details></td><td align=center>Medium

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>
