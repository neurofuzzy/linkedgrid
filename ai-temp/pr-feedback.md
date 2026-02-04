## PR Code Suggestions ✨

<!-- 94641d0 -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=5>Possible issue</td>
<td>



<details><summary>Fix broken dependency injection logic</summary>

___

**Move the <code>systemCache</code> declaration outside the <code>createSystemByName</code> function to <br>ensure it persists across calls and correctly caches system instances.**

[specs/migration-guide-scene-loader.md [83-170]](https://github.com/neurofuzzy/linkedgrid/pull/27/files#diff-292999cec9ee1a4dc253593a58cc12aba512e8736d36905b1a1290d811c519c8R83-R170)

```diff
+// Track created systems for dependency injection
+const systemCache = new Map<string, GameSystem>();
+
 export function createSystemByName(
   name: string,
   gameManager: GameManager
 ): GameSystem | null {
-  // Track created systems for dependency injection
-  const systemCache = new Map<string, GameSystem>();
-
   switch (name) {
     case 'HealthSystem':
       if (!systemCache.has('HealthSystem')) {
         systemCache.set('HealthSystem', new HealthSystem());
       }
       return systemCache.get('HealthSystem')!;
 
     case 'ProjectileSystem': {
+      // The cache check for ProjectileSystem itself is missing.
+      // This suggestion focuses only on the critical systemCache scope issue.
       let healthSystem = systemCache.get('HealthSystem') as HealthSystem | undefined;
       if (!healthSystem) {
         healthSystem = new HealthSystem();
         systemCache.set('HealthSystem', healthSystem);
       }
       const projectileSystem = new ProjectileSystem(healthSystem);
       systemCache.set('ProjectileSystem', projectileSystem);
       return projectileSystem;
     }
 ...
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: This suggestion correctly identifies a critical flaw in the migration guide's example code where the `systemCache` is re-initialized on every call, which would lead to buggy behavior if implemented as shown.


</details></details></td><td align=center>High

</td></tr><tr><td>



<details><summary>Prevent duplicate system instance creation</summary>

___

**Add a cache check at the beginning of each system creation case in <br><code>createSystemByName</code> to prevent creating duplicate system instances.**

[specs/migration-guide-scene-loader.md [136-161]](https://github.com/neurofuzzy/linkedgrid/pull/27/files#diff-292999cec9ee1a4dc253593a58cc12aba512e8736d36905b1a1290d811c519c8R136-R161)

```diff
 case 'ProjectileSystem': {
+  if (systemCache.has('ProjectileSystem')) {
+    return systemCache.get('ProjectileSystem')!;
+  }
   let healthSystem = systemCache.get('HealthSystem') as HealthSystem | undefined;
   if (!healthSystem) {
     healthSystem = new HealthSystem();
     systemCache.set('HealthSystem', healthSystem);
   }
   const projectileSystem = new ProjectileSystem(healthSystem);
   systemCache.set('ProjectileSystem', projectileSystem);
   return projectileSystem;
 }
 
 case 'TurretSystem': {
+  if (systemCache.has('TurretSystem')) {
+    return systemCache.get('TurretSystem')!;
+  }
   let healthSystem = systemCache.get('HealthSystem') as HealthSystem | undefined;
   if (!healthSystem) {
     healthSystem = new HealthSystem();
     systemCache.set('HealthSystem', healthSystem);
   }
 
   let projectileSystem = systemCache.get('ProjectileSystem') as ProjectileSystem | undefined;
   if (!projectileSystem) {
-    projectileSystem = new ProjectileSystem(healthSystem);
-    systemCache.set('ProjectileSystem', projectileSystem);
+    // This recursively calls the factory to ensure single instance.
+    projectileSystem = createSystemByName('ProjectileSystem', gameManager) as ProjectileSystem;
   }
 
-  return new TurretSystem(healthSystem, projectileSystem);
+  const turretSystem = new TurretSystem(healthSystem, projectileSystem);
+  systemCache.set('TurretSystem', turretSystem);
+  return turretSystem;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: This suggestion correctly identifies a critical bug in the example code's dependency injection logic, where duplicate system instances would be created because the cache is not checked before instantiation.


</details></details></td><td align=center>High

</td></tr><tr><td>



<details><summary>Throw if missing player spawn</summary>

___

**Throw an error if no player entity is found in the initial scene to prevent the <br>game from starting in an invalid state with a <code>playerEntityId</code> of 0.**

[packages/spartan/core/game-runtime.ts [274-277]](https://github.com/neurofuzzy/linkedgrid/pull/27/files#diff-123def48edf8f2ab6f411a7d5ed24078f0d29442c09713258829d302ade4b4d3R274-R277)

```diff
-// Set player entity ID
-if (playerId !== null) {
-  game.gameState.playerEntityId = playerId;
+// Set player entity ID, error if missing
+if (playerId === null) {
+  throw new Error(`No player entity found in initial scene "${initialSceneId}"`);
 }
+game.gameState.playerEntityId = playerId;
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=2 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identifies a critical issue where a missing player in the initial scene would cause silent failure, and proposes a fail-fast approach by throwing an error, which is much better for debugging.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Initialize spatial masks for all scenes</summary>

___

**Iterate through all scenes and call <code>syncMasks()</code> on each to ensure all spatial <br>data is correctly initialized at load time, not just for the active scene.**

[packages/spartan/core/game-runtime.ts [361-365]](https://github.com/neurofuzzy/linkedgrid/pull/27/files#diff-123def48edf8f2ab6f411a7d5ed24078f0d29442c09713258829d302ade4b4d3R361-R365)

```diff
-// Initialize cell masks for all pre-spawned entities
-const activeScene = game.sceneManager.getActiveScene();
-if (activeScene) {
-  activeScene.spatial.syncMasks();
+// Initialize cell masks for all pre-spawned entities in all scenes
+for (const sceneDef of config.scenes) {
+  const scene = game.sceneManager.getScene(sceneDef.id);
+  if (scene) {
+    scene.spatial.syncMasks();
+  }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=3 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies that `syncMasks()` should be called for all scenes, not just the active one, to ensure the spatial data for non-active scenes is correctly initialized.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Use player's current layer for teleportation</summary>

___

**Instead of hardcoding the teleport destination layer to <code>GameLayers.ACTORS</code>, <br>dynamically use the player's current layer to make the logic more robust.**

[packages/spartan/systems/teleporter.system.ts [112-122]](https://github.com/neurofuzzy/linkedgrid/pull/27/files#diff-164c077ec0d64d7e1f5fd9e145f9ef17c1dfe54f1b0b70adc6fe17c1935a122eR112-R122)

```diff
-// When using connectionKey, spawn player at ACTORS layer (not teleporter's layer)
-// The connection stores the teleporter's position/layer, but player needs ACTORS layer
-const targetLayer = GameLayers.ACTORS;
+// When using connectionKey, spawn player at its current layer, not the teleporter's layer.
+const playerEntity = this.gameManager.game.getPlayerEntity();
+const targetLayer = playerEntity?.layer ?? GameLayers.ACTORS;
 
 // Execute teleport
 this.gameManager.movePlayerToScene(
   destination.sceneId,
   destination.x,
   destination.y,
   targetLayer
 );
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly points out that hardcoding the player's teleport destination layer is brittle and proposes a more robust solution by using the player's actual layer.

</details></details></td><td align=center>Low

</td></tr><tr><td rowspan=1>General</td>
<td>



<details><summary>Skip entries missing position data</summary>

___

**In the scene validator, expand the check to skip entities that are missing <code>x</code>, <code>y</code>, <br>or <code>layer</code> properties, in addition to <code>type</code>, to handle malformed entries <br>gracefully.**

[dev/scene-loader.ts [324-327]](https://github.com/neurofuzzy/linkedgrid/pull/27/files#diff-950f0a4080831ca6034793672a2302efb2c0fe3af1f13faaa883e7fe9890b4b5R324-R327)

```diff
 for (let i = 0; i < scene.entities.length; i++) {
   const entity = scene.entities[i];
-  // Skip comment/section objects
-  if (!entity.type) continue;
+  // Skip comment/section objects or entries missing positioning
+  if (
+    !entity.type ||
+    entity.x === undefined ||
+    entity.y === undefined ||
+    entity.layer === undefined
+  ) {
+    continue;
+  }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion improves the robustness of the validation logic by checking for all required position properties (`x`, `y`, `layer`) before processing an entity, preventing potential runtime errors.

</details></details></td><td align=center>Medium

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>
