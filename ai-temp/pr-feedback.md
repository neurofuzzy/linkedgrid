## PR Code Suggestions ✨

<!-- 147d10c -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=4>Possible issue</td>
<td>



<details><summary>Use atomic commits for scene transitions</summary>

___

**Refactor <code>_movePlayerToSceneImmediate</code> to use the transactional <code>spawn</code>, <code>remove</code>, and <br><code>commit</code> methods instead of directly manipulating internal state, ensuring atomic <br>scene transitions.**

[packages/spartan/game-manager.ts [252-317]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-99b97162ed56d2486f3746c9042e236f6cffc6710365dc6ac669ce3f73e61bf7R252-R317)

```diff
-// Remove player from current scene
+// Remove player from current scene and commit immediately
 currentScene.spatial.remove(currentPos.x, currentPos.y, currentPos.layer);
+currentScene.spatial.commit();
 
-// Spawn player in target scene
-try {
-    // We need to spawn with the same ID, so we'll manually handle this
-    // First, create the entity data in the target store
-    targetStore.data.set(playerId, playerData);
+// Try to spawn player in target scene
+const targetSpatial = targetScene.spatial;
+targetSpatial.spawn(playerData.type, x, y, layer, playerProps);
 
-    // Then place in spatial system
-    const targetCell = targetScene.grid.cell(x, y);
-    if (!targetCell) {
-        // Rollback: restore player to original scene
-        const originalPos = currentScene.spatial.getEntityPosition(playerId);
-        if (originalPos) {
-            currentScene.spatial.spawn(playerData.type, originalPos.x, originalPos.y, originalPos.layer, playerProps);
-        }
-        return false;
-    }
-
-    // Check if layer is occupied
-    if (targetCell.getValue(layer) !== undefined) {
-        // Rollback: restore player to original scene
-        // Restore entity data in store
-        currentStore.data.set(playerId, playerData);
-        
-        // Restore in grid
-        const restoreCell = currentScene.grid.cell(currentPos.x, currentPos.y);
-        if (restoreCell) {
-            restoreCell.setValue(currentPos.layer, playerId);
-            const positions = (currentScene.spatial as any).positions;
-            positions.set(playerId, currentPos);
-        }
-        return false;
-    }
-
-    // Place player entity in target cell
-    targetCell.setValue(layer, playerId);
-
-    // Update position tracking
-    const positions = (targetScene.spatial as any).positions;
-    positions.set(playerId, { x, y, layer });
-
-    // Update active scene
-    this.sceneManager.setActiveScene(targetSceneId);
-
-    return true;
-} catch (error) {
-    // If anything fails, attempt to restore player to original scene
-    try {
-        // Restore entity data in store
-        currentStore.data.set(playerId, playerData);
-        
-        // Restore in grid
-        const restoreCell = currentScene.grid.cell(currentPos.x, currentPos.y);
-        if (restoreCell) {
-            restoreCell.setValue(currentPos.layer, playerId);
-            const positions = (currentScene.spatial as any).positions;
-            positions.set(playerId, currentPos);
-        }
-    } catch (e) {
-        // Player lost - this is bad but we can't recover
-        console.error('Failed to restore player after failed scene transition', e);
-    }
-    return false;
+// Manually set the entity ID to be the same, as spawn creates a new one
+const pendingOps = targetSpatial.getPendingOps() as any[];
+const spawnOp = pendingOps.find(op => op.type === 'spawn');
+if (spawnOp) {
+    // Clean up the new ID created by spawn()
+    targetScene.store.remove(spawnOp.entityId);
+    // Assign the correct player ID
+    spawnOp.entityId = playerId;
 }
 
+// Restore player data
+targetScene.store.createWithId(playerId, playerData.type, playerProps);
+
+// Attempt to commit the spawn
+try {
+    targetSpatial.commit();
+    
+    // Verify spawn was successful
+    if (targetSpatial.getEntityPosition(playerId)) {
+        this.sceneManager.setActiveScene(targetSceneId);
+        return true;
+    }
+} catch (e) {
+    // Commit failed, state is unchanged.
+}
+
+// If spawn failed, we must restore the player in the original scene
+currentScene.spatial.spawn(playerData.type, currentPos.x, currentPos.y, currentPos.layer, playerProps);
+const currentPendingOps = currentScene.spatial.getPendingOps() as any[];
+const restoreOp = currentPendingOps.find(op => op.type === 'spawn');
+if (restoreOp) {
+    currentScene.store.remove(restoreOp.entityId);
+    restoreOp.entityId = playerId;
+}
+currentScene.store.createWithId(playerId, playerData.type, playerProps);
+currentScene.spatial.commit();
+
+return false;
+
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: The suggestion correctly identifies a critical architectural flaw where the `_movePlayerToSceneImmediate` method bypasses the new transactional system, leading to complex, brittle, and bug-prone manual state manipulation and rollback logic.

</details></details></td><td align=center>High

</td></tr><tr><td>



<details><summary>Exclude pending removals from positions</summary>

___

**Update <code>getEntityPosition</code> to check <code>pendingRemovals</code> and return <code>null</code> for entities <br>that are staged for removal, even before <code>commit()</code> is called.**

[packages/spartan/spatial-system.ts [603-605]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-51ee831c19536e2e2d134182a19fa3996c4cbf5034c4b6b79e75dc6c23af3be0R603-R605)

```diff
 getEntityPosition(id: number): {x: number, y: number, layer: Layer} | null {
+    if (this.pendingRemovals.has(id)) return null;
     return this.positions.get(id) ?? null;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This is a critical fix for game logic consistency, ensuring that entities staged for removal are not considered to have a valid position, which prevents systems from targeting "zombie" entities.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Fix incorrect layer comparison bug</summary>

___

**Fix a bug in teleporter re-activation logic by removing the incorrect layer <br>comparison, which prevents instant bounce-back.**

[packages/spartan/teleporter-system.ts [107-113]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-2f10f54a2a95b5bf33995172b5101cf5ebdaa5060612460a6d03407d90165f5aR107-R113)

```diff
 // If player not on pad, re-enable
-if (!padPos || 
-    padPos.x !== playerPos.x || 
-    padPos.y !== playerPos.y ||
-    padPos.layer !== playerPos.layer) {
+if (!padPos || padPos.x !== playerPos.x || padPos.y !== playerPos.y) {
     this.states.set(teleporterId, 'ready');
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=2 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identifies and fixes a logic bug in the `TeleporterSystem` that would prevent the bounce-back prevention mechanism from working as intended.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Correctly check for entities in <code>items</code></summary>

___

**Correct the <code>isBlocked</code> function to check for actors and dynamic walls in the <br><code>cell.items</code> array instead of <code>cell.values</code>, aligning the example code with the <br>specification.**

[specs/spartan-layer-rules.md [121-130]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-7d0b85b0d8dd26763a442b9aed3916ba55476c8cf42d6313b7b96d363d1a7b52R121-R130)

```diff
 function isBlocked(cell: LinkedCell, emptyFloorsBlock = false): boolean {
   // Empty floor blocks (game setting)
   if (emptyFloorsBlock && cell.values[GameLayers.FLOOR] === undefined) {
     return true;
   }
   
-  // Check walls and actors
+  // Check walls (static terrain and dynamic entities) and actors
   return cell.values[GameLayers.WALLS] !== undefined ||
-         cell.values[GameLayers.ACTORS] !== undefined;
+         cell.items[GameLayers.WALLS] !== undefined ||
+         cell.items[GameLayers.ACTORS] !== undefined;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=3 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identifies a significant bug in the example code where `cell.values` is used instead of `cell.items` for checking actor and dynamic wall entities, which contradicts the specification defined in the same document.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=7>General</td>
<td>



<details><summary>Use deserialization methods for loading state</summary>

___

**Refactor the <code>load</code> method to use <code>GameState.deserialize</code> and <code>SceneManager</code>'s public <br>API for restoring state, instead of directly setting internal properties.**

[packages/spartan/game-manager.ts [361-388]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-99b97162ed56d2486f3746c9042e236f6cffc6710365dc6ac669ce3f73e61bf7R361-R388)

```diff
 static load(data: any): GameManager {
     const game = new GameManager();
 
-    // Restore game state
-    game.gameState.playerEntityId = data.gameState.playerEntityId || 0;
-    game.gameState.lives = data.gameState.lives || 3;
-    game.gameState.score = data.gameState.score || 0;
-    game.gameState.inventory = new Map(data.gameState.inventory || []);
-    game.gameState.buffs = new Map(data.gameState.buffs || []);
-    game.gameState.upgrades = new Set(data.gameState.upgrades || []);
-    game.gameState.flags = new Map(data.gameState.flags || []);
-    game.gameState.data = new Map(data.gameState.data || []);
-    game.gameState.connections = new Map(data.gameState.connections || []);
-    (game.gameState as any).nextEntityId = data.gameState.nextEntityId || 1;
+    // Restore game state using its own deserialization logic
+    if (data.gameState) {
+        const restoredGameState = GameState.deserialize(data.gameState);
+        // Replace the default gameState with the restored one
+        (game as any).gameState = restoredGameState;
+        // Connect the scene manager to the new game state instance
+        (game.sceneManager as any).gameState = restoredGameState;
+    }
 
     // Restore scenes
-    for (const sceneData of data.scenes || []) {
-        const scene = Scene.deserialize(sceneData, game.gameState);
-        (game.sceneManager as any).scenes.set(scene.id, scene);
+    if (data.scenes) {
+        for (const sceneData of data.scenes) {
+            const scene = Scene.deserialize(sceneData, game.gameState);
+            (game.sceneManager as any).scenes.set(scene.id, scene);
+        }
     }
 
     // Restore active scene
     if (data.activeSceneId) {
         game.sceneManager.setActiveScene(data.activeSceneId);
+    } else if (data.scenes?.length > 0) {
+        // Fallback to the first scene if activeId is missing
+        game.sceneManager.setActiveScene(data.scenes[0].id);
     }
 
     return game;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly points out that the `load` method breaks encapsulation by setting internal properties directly, and proposes a much cleaner, more maintainable approach using dedicated deserialization methods.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Clean up store on spawn cancellation</summary>

___

**In <code>cancelSpawn</code>, call <code>this.store.remove(entityId)</code> after removing the operation <br>from <code>pendingOps</code> to prevent leaving orphaned entity data in the store.**

[packages/spartan/spatial-system.ts [755-764]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-51ee831c19536e2e2d134182a19fa3996c4cbf5034c4b6b79e75dc6c23af3be0R755-R764)

```diff
 cancelSpawn(entityId: number): boolean {
     const index = this.pendingOps.findIndex(
         op => op.type === 'spawn' && op.entityId === entityId
     );
     
     if (index === -1) return false;
     
     this.pendingOps.splice(index, 1);
+    this.store.remove(entityId);
     return true;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies that canceling a spawn should also clean up the entity data from the store to prevent orphaned entities and potential memory leaks, which is a significant improvement.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Avoid creating a temporary initial scene</summary>

___

**Refactor the static <code>load</code> method to use a private constructor pattern, avoiding <br>the creation of a temporary, unused scene and aligning with the cleaner <br>architecture proposed in the document.**

[ai-temp/game-runtime-spec.md [367-394]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-0e9a28e673d5b892cf874299bb2fab5e9a798a3feb3a72b14e54b0a8e9405695R367-R394)

```diff
-static load(saveData: SaveData, systems: GameSystem[], tickRate = 10): GameRuntime {
-  // Create minimal config for construction
-  const config: GameRuntimeConfig = {
-    initialScene: {
-      id: 'temp', // Will be replaced
-      width: 10,
-      height: 10
-    },
-    systems,
-    tickRate
-  };
+static load(saveData: SaveData, systems: GameSystem[], tickRate?: number): GameRuntime {
+  const game = GameManager.load(saveData);
+  const effectiveTickRate = tickRate ?? saveData.tickRate ?? 10;
   
-  // Create instance
-  const runtime = new GameRuntime(config);
-  
-  // Replace game with loaded state
-  runtime.game = GameManager.load(saveData);
-  
-  // Restore tick count if present
-  if (saveData.tickCount !== undefined) {
-    runtime._tickCount = saveData.tickCount;
-  }
+  // Assumes a private constructor: 
+  // private constructor(game: GameManager, systems: GameSystem[], tickRate: number, initialTickCount = 0)
+  const runtime = new GameRuntime(
+    game, 
+    systems, 
+    effectiveTickRate, 
+    saveData.tickCount || 0
+  );
   
   // Initialize loop for loaded active scene
   runtime.initializeLoop();
   
   return runtime;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=6 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly points out an inefficiency in the `load` method's implementation and proposes adopting a cleaner pattern that is already mentioned as a better alternative within the same specification document.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Improve deserialization by adding a method</summary>

___

**Refactor deserialization to use a dedicated <code>rebuildPositionTracking</code> method on <br><code>SpatialSystem</code> instead of directly accessing its private <code>positions</code> map.**

[packages/spartan/scene.ts [208-218]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-489381b9e0cc87aee1e04080bae459d260221a021599fbe8d80b3c8e2b7e18f7R208-R218)

```diff
 // Rebuild position tracking in spatial system
-for (const cellData of data.cells || []) {
-    for (let layer = 0; layer < cellData.values.length; layer++) {
-        const entityId = cellData.values[layer];
-        if (entityId !== undefined) {
-            // Update position tracking directly
-            const positions = (scene.spatial as any).positions;
-            positions.set(entityId, { x: cellData.x, y: cellData.y, layer });
-        }
-    }
-}
+scene.spatial.rebuildPositionTracking();
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=7 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly identifies a violation of encapsulation and proposes a robust solution that improves code quality and maintainability.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Improve entity restoration with a method</summary>

___

**Refactor entity deserialization to use a dedicated <code>restoreEntity</code> method on <br><code>SparseEntityStore</code> instead of directly accessing its private <code>data</code> map.**

[packages/spartan/scene.ts [168-180]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-489381b9e0cc87aee1e04080bae459d260221a021599fbe8d80b3c8e2b7e18f7R168-R180)

```diff
 // Restore entities first
 for (const entityData of data.entities || []) {
-    // Manually create entity in store (bypass ID generation since we're restoring)
-    const id = entityData.id;
-    const type = entityData.type;
-    const props = { ...entityData };
-    delete props.id;
-    delete props.type;
-    
-    // Create entity with original ID by temporarily using a custom generator
-    const tempStore = scene.store as any;
-    tempStore.data.set(id, entityData);
+    if (entityData) {
+        scene.store.restoreEntity(entityData.id, entityData);
+    }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=8 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly identifies a violation of encapsulation and proposes a robust solution that improves code quality and maintainability.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Improve overlap detection performance by iterating cells</summary>

___

**Optimize the <code>detectOverlaps</code> function by iterating through the grid's cells <br>directly instead of all entity positions. This ensures each cell is checked only <br>once, improving performance.**

[ai-temp/game-loop-responsibilities-spec.md [272-291]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-5183f5433baab04a82f216423bca6373aafd52a7e30b4b29c520ce467752f66bR272-R291)

```diff
 detectOverlaps(): Overlap[] {
   const overlaps: Overlap[] = [];
-  const checked = new Set<string>();
   
-  for (const [_, pos] of this.getAllPositions()) {
-    const key = `${pos.x},${pos.y}`;
-    if (checked.has(key)) continue;
-    checked.add(key);
-    
-    const entities = this.getEntityIdsInCell(pos.x, pos.y);
+  for (const cell of this.grid.cells) {
+    const entities = this.getEntityIdsInCell(cell.x, cell.y);
     if (entities.length > 1) {
       overlaps.push({
-        position: { x: pos.x, y: pos.y },
+        position: { x: cell.x, y: cell.y },
         entityIds: entities
       });
     }
   }
   
   return overlaps;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=9 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion offers a valid performance optimization for the `detectOverlaps` function by iterating over grid cells instead of entity positions, which avoids redundant checks on the same cell.


</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Ensure consistent counting in debug output</summary>

___

**In the <code>debug</code> method, calculate the pending removals count by filtering <br><code>this.pendingOps</code> to ensure consistency with how pending moves and spawns are <br>counted.**

[packages/spartan/spatial-system.ts [824-851]](https://github.com/neurofuzzy/linkedgrid/pull/7/files#diff-51ee831c19536e2e2d134182a19fa3996c4cbf5034c4b6b79e75dc6c23af3be0R824-R851)

```diff
 debug(): string {
     const entityCount = Array.from(this.positions.keys()).length;
     const pendingMoves = this.pendingOps.filter(op => op.type === 'move').length;
-    const pendingRemovals = this.pendingRemovals.size;
+    const pendingRemovalsCount = this.pendingOps.filter(op => op.type === 'remove').length;
     const pendingSpawns = this.pendingOps.filter(op => op.type === 'spawn').length;
     
     let output = '=== SpatialSystem Debug ===\n';
     output += `Entities: ${entityCount}\n`;
     output += `Pending ops: ${this.pendingOps.length}\n`;
     output += `  - Moves: ${pendingMoves}\n`;
-    output += `  - Removals: ${pendingRemovals}\n`;
+    output += `  - Removals: ${pendingRemovalsCount}\n`;
     output += `  - Spawns: ${pendingSpawns}\n`;
     
     if (this.pendingOps.length > 0) {
         output += '\nPending operations:\n';
         for (const op of this.pendingOps) {
             if (op.type === 'move') {
                 output += `  MOVE: entity ${op.entityId} (${op.fromX},${op.fromY}) → (${op.toX},${op.toY}) layer ${op.layer}\n`;
             } else if (op.type === 'remove') {
                 output += `  REMOVE: entity ${op.entityId} at (${op.x},${op.y}) layer ${op.layer}\n`;
             } else if (op.type === 'spawn') {
                 output += `  SPAWN: entity ${op.entityId} (${op.typeStr}) at (${op.x},${op.y}) layer ${op.layer}\n`;
             }
         }
     }
     
     return output;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=10 -->


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: The suggestion correctly identifies a potential inconsistency in the `debug` output and proposes a fix that makes the counting logic more robust by using a single source of truth (`pendingOps`).

</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>

