## PR Code Suggestions ✨

<!-- 24ac109 -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=1>High-level</td>
<td>



<details><summary>Validate entity data during scene loading</summary>

___

**In <code>SceneLoader</code>, use the new type guards to perform runtime validation on entity <br>data loaded from JSON files. This ensures that dynamically created entities <br>conform to their archetypes, preventing errors from malformed scene data.**


### Examples:



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/11/files#diff-950f0a4080831ca6034793672a2302efb2c0fe3af1f13faaa883e7fe9890b4b5R148-R189">dev/scene-loader.ts [148-189]</a>
</summary>



```typescript
  private populateScene(runtime: GameRuntime, sceneDef: SceneDefinition): void {
    const scene = runtime.game.sceneManager.getScene(sceneDef.id);
    if (!scene) {
      throw new Error(`Scene ${sceneDef.id} not found`);
    }

    const entities = sceneDef.entities || [];
    let playerId: number | null = null;

    // Spawn all entities

 ... (clipped 32 lines)
```
</details>




### Solution Walkthrough:



#### Before:
```typescript
// file: dev/scene-loader.ts

private populateScene(runtime: GameRuntime, sceneDef: SceneDefinition): void {
  // ...
  const entities = sceneDef.entities || [];
  
  for (const entityDef of entities) {
    const entityData = {
      ...(entityDef.data || {}),
      sceneId: scene.id,
    };
    
    // No validation is performed on entityData.
    // Malformed data from JSON can lead to runtime errors.
    const id = scene.spatial.spawn(
      entityDef.type,
      entityDef.x,
      entityDef.y,
      entityDef.layer,
      entityData
    );
    // ...
  }
  // ...
}

```



#### After:
```typescript
// file: dev/scene-loader.ts
import { isPlayer, hasHealth, isEnemy, hasAI } from '../packages/spartan/entities/trait-guards';

private populateScene(runtime: GameRuntime, sceneDef: SceneDefinition): void {
  // ...
  const entities = sceneDef.entities || [];
  
  for (const entityDef of entities) {
    const tempEntityForValidation = { id: 0, type: entityDef.type, ...entityDef.data };

    // Validate data using the new type guards
    if (isPlayer(tempEntityForValidation) && !hasHealth(tempEntityForValidation)) {
      console.warn(`Player in scene '${sceneDef.id}' is missing health properties.`);
    }
    if (isEnemy(tempEntityForValidation) && !hasAI(tempEntityForValidation)) {
      console.warn(`Enemy in scene '${sceneDef.id}' is missing AI properties.`);
    }
    // ... other validations

    const entityData = { ...(entityDef.data || {}), sceneId: scene.id };
    const id = scene.spatial.spawn(entityDef.type, entityDef.x, entityDef.y, entityDef.layer, entityData);
    // ...
  }
  // ...
}

```




<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: This suggestion correctly identifies a critical gap where entities loaded from scenes bypass the new trait system's safety checks, potentially causing runtime errors from malformed data.


</details></details></td><td align=center>High

</td></tr><tr><td rowspan=1>General</td>
<td>



<details><summary>Define teleporter destination and state</summary>

___

**Update the <code>TeleporterData</code> type to include the <code>destination</code> and optional <br><code>teleporterState</code> properties to match its usage in the teleporter system.**

[packages/spartan/entities/entity-types.ts [130-132]](https://github.com/neurofuzzy/linkedgrid/pull/11/files#diff-4a4e25575c5e16129b9a0b4dbd3bb2829ca535f10a38dbbf96535a136c2ebbefR130-R132)

```diff
 export type TeleporterData = EntityData & {
     type: 'teleporter';
+    destination: {
+        sceneId: string;
+        x: number;
+        y: number;
+        layer: GameLayer;
+    };
+    teleporterState?: 'ready' | 'inactive';
 } & HasTeleportTarget & HasSceneLocation;
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identifies that the `TeleporterData` type is missing the `destination` and `teleporterState` properties, which are essential for the `TeleporterSystem`'s logic, thus improving type safety and code correctness.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=2>Possible issue</td>
<td>



<details><summary>Persist teleporter state correctly</summary>

___

**Use <code>spatial.setEntityData</code> to update the teleporter state to ensure the change is <br>correctly persisted, instead of directly mutating the object from <code>getEntityData</code>.**

[packages/spartan/systems/teleporter-system.ts [105-108]](https://github.com/neurofuzzy/linkedgrid/pull/11/files#diff-287d06a4aff1aa552d746e14b38259b9911243c0dbdb552ec63774576a0c0fd8R105-R108)

```diff
-const updatedTeleporter = spatial.getEntityData(teleporterId);
-if (updatedTeleporter) {
-    updatedTeleporter.teleporterState = 'inactive';
-}
+spatial.setEntityData(teleporterId, { teleporterState: 'inactive' });
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=2 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies a potential bug where direct mutation might not persist and proposes using `setEntityData`, which aligns with the new design patterns introduced in the PR and improves code robustness.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Use setEntityData for destination pad</summary>

___

**Replace the direct mutation of the destination teleporter's state with a call to <br><code>spatial.setEntityData</code> to ensure the update is reliably saved.**

[packages/spartan/systems/teleporter-system.ts [130-133]](https://github.com/neurofuzzy/linkedgrid/pull/11/files#diff-287d06a4aff1aa552d746e14b38259b9911243c0dbdb552ec63774576a0c0fd8R130-R133)

```diff
 if (entityData && isTeleporter(entityData)) {
-    entityData.teleporterState = 'inactive';
+    spatial.setEntityData(entityId, { teleporterState: 'inactive' });
     break;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=3 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: This suggestion correctly points out that direct mutation of entity data is risky and proposes using `setEntityData`, which aligns with the new design patterns and ensures the state update is persisted reliably.


</details></details></td><td align=center>Medium

</td></tr>
<tr><td align="center" colspan="2">

- [ ] Update <!-- /improve_multi --more_suggestions=true -->

</td><td></td></tr></tbody></table>
