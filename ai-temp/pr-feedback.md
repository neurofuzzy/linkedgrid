## PR Code Suggestions ✨

<!-- 932d75e -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=1>High-level</td>
<td>



<details><summary>Adopt a reactive, event-driven approach</summary>

___

**Refactor the <code>ObjectiveSystem</code> to be event-driven instead of polling. Listen to <br>events like <code>deathEvents</code> to track objective progress, which is more performant <br>than iterating all entities every tick.**


### Examples:



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/32/files#diff-b52e4f5479ed5e7af3284ecf18d746c862d7a388d4721b90f82a303012bb35a2R147-R163">packages/spartan/systems/objective.system.ts [147-163]</a>
</summary>



```typescript
  private checkKillAll(context: GameContext, objective: ObjectiveDefinition): boolean {
    const activeSceneId = this.getActiveSceneId();
    if (activeSceneId !== objective.sceneId) return false;

    // Count remaining alive enemies
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData) continue;
      if (!context.spatial.isAlive(entityId)) continue;


 ... (clipped 7 lines)
```
</details>



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/32/files#diff-b52e4f5479ed5e7af3284ecf18d746c862d7a388d4721b90f82a303012bb35a2R120-R140">packages/spartan/systems/objective.system.ts [120-140]</a>
</summary>



```typescript
  private checkCollectFlag(context: GameContext, objective: ObjectiveDefinition): boolean {
    // Only check in the objective's scene
    const activeScene = this.gameManager.sceneManager.getActiveScene();
    if (!activeScene) return false;

    const activeSceneId = this.getActiveSceneId();
    if (activeSceneId !== objective.sceneId) return false;

    // Count remaining flags with matching objectiveId
    for (const [entityId] of context.spatial.getAllPositions()) {

 ... (clipped 11 lines)
```
</details>




### Solution Walkthrough:



#### Before:
```typescript
// packages/spartan/systems/objective.system.ts

class ObjectiveSystem {
  update(context: GameContext): void {
    for (const objective of objectives) {
      if (objective.type === 'kill-all' && !objective.completed) {
        objective.completed = this.checkKillAll(context, objective);
      }
      // ... similar logic for 'collect-flag'
    }
  }

  private checkKillAll(context: GameContext, objective: ObjectiveDefinition): boolean {
    // This loop runs every tick for each 'kill-all' objective.
    for (const [entityId] of context.spatial.getAllPositions()) {
      const entityData = context.spatial.getEntityData(entityId);
      if (isEnemy(entityData) && isEntityAlive(entityData)) {
        return false; // Found a living enemy, objective not complete.
      }
    }
    return true; // No living enemies found.
  }
}

```



#### After:
```typescript
// packages/spartan/systems/objective.system.ts

class ObjectiveSystem {
  // State to track remaining counts, initialized on scene load
  private killCounts: Map<string, number>; // sceneId -> count
  private flagCounts: Map<string, number>; // objectiveId -> count

  update(context: GameContext): void {
    // React to death events once per tick
    for (const event of this.healthSystem.getDeathEvents()) {
      // Decrement kill count for the relevant scene
    }

    // React to collection/removal events for flags
    // (e.g., by tracking removed entities)
    // ... decrement flag count

    // Check objectives by looking at the counters, not iterating entities
    for (const objective of objectives) {
      if (objective.type === 'kill-all' && (this.killCounts.get(objective.sceneId) ?? 0) <= 0) {
        objective.completed = true;
      }
      // ... similar logic for 'collect-flag'
    }
  }
}

```




<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: This is a critical architectural suggestion that correctly identifies a significant performance issue in the `ObjectiveSystem` and proposes a more scalable, event-driven solution that aligns with other new systems in the PR.


</details></details></td><td align=center>High

</td></tr><tr><td rowspan=2>Possible issue</td>
<td>



<details><summary>Fix bug where kill scores fail</summary>

___

**Fix a bug in <code>processKillScore</code> where scores are not awarded for kills. The <br><code>HealthSystem</code> should pass the entity's data in the <code>DeathEvent</code> since the entity is <br>removed before the <code>ScoreSystem</code> can access it.**

[packages/spartan/systems/score.system.ts [81-97]](https://github.com/neurofuzzy/linkedgrid/pull/32/files#diff-9e000ca0363e452fd9dbecff84229249c60843ad5e3cf142f4f92fd27a9a0ceaR81-R97)

```diff
 private processKillScore(context: GameContext): void {
   const playerId = this.gameManager.gameState.playerEntityId;
   if (!playerId) return;
 
   const deathEvents = this.healthSystem.getDeathEvents();
 
   for (const event of deathEvents) {
     // Only award points for player kills
     if (event.killerEntityId !== playerId) continue;
 
     // Check if the dead entity had a scoreValue
-    const entityData = context.spatial.getEntityData(event.entityId);
+    const entityData = event.entityData;
     if (entityData && hasScoreValue(entityData)) {
       this.gameManager.gameState.score += entityData.scoreValue;
     }
   }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: The suggestion correctly identifies a critical bug where kill scores are not awarded because the entity is removed before its data can be read, and it proposes the correct conceptual fix.

</details></details></td><td align=center>High

</td></tr><tr><td>



<details><summary>Ensure active scene exists before rendering</summary>

___

**In <code>GameStatusPanel</code>, add a check to ensure <code>runtime.activeScene</code> is not null before <br>rendering to prevent incorrect objective filtering during scene transitions.**

[dev/grid-renderer.tsx [623-638]](https://github.com/neurofuzzy/linkedgrid/pull/32/files#diff-0851ee83f65c14beb434009ee588b260ce1b3078ab3858d1566bca1c9661a93fR623-R638)

```diff
 export function GameStatusPanel({ runtime }: GameStatusPanelProps) {
   if (!runtime) return null;
 
   const objectives = runtime.game.gameState.objectives;
-  if (!objectives || objectives.length === 0) return null;
+  const activeScene = runtime.activeScene;
+
+  if (!objectives || objectives.length === 0 || !activeScene) return null;
 
   // Get active scene ID
-  const activeScene = runtime.activeScene;
-  const activeSceneId = activeScene?.id || '';
+  const activeSceneId = activeScene.id;
 
   // Filter objectives for active scene and other scenes
   const sceneObjectives = objectives.filter((o) => o.sceneId === activeSceneId);
   const otherObjectives = objectives.filter((o) => o.sceneId !== activeSceneId);
 
   const allComplete = objectives.every((o) => o.completed);
   const sceneComplete = sceneObjectives.length > 0 && sceneObjectives.every((o) => o.completed);
   ...
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly identifies a potential issue where `runtime.activeScene` could be null, leading to incorrect objective filtering, and proposes a valid guard clause to improve the component's robustness.


</details></details></td><td align=center>Low

</td></tr><tr><td rowspan=5>General</td>
<td>



<details><summary>Specify number of flags to collect</summary>

___

**In the <code>lobby-flags</code> objective, add <code>"targetCount": 3</code> to require collecting all <br>three flags for completion.**

[dev/games/multiscene-objectives-demo.json [10]](https://github.com/neurofuzzy/linkedgrid/pull/32/files#diff-178d1627e06ee21958dfe031744ee4dc02ca052203fe370f8e903591923f8cc3R10-R10)

```diff
-{ "id": "lobby-flags", "type": "collect-flag", "sceneId": "lobby", "targetId": "blue-flag" },
+{ "id": "lobby-flags", "type": "collect-flag", "sceneId": "lobby", "targetId": "blue-flag", "targetCount": 3 },
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=3 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion fixes a bug where the 'collect-flag' objective would complete after collecting just one flag, instead of all three present in the scene, by adding the necessary `targetCount` property.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Add targetCount for flag objective</summary>

___

**In the <code>collect-flags</code> objective, add <code>"targetCount": 2</code> to require collecting both <br>flags for completion.**

[dev/games/score-objectives-demo.json [10]](https://github.com/neurofuzzy/linkedgrid/pull/32/files#diff-4172191821b7a2abb923a335221346beeb2bf37b8ba3431038184c46e94efe36R10-R10)

```diff
-{ "id": "collect-flags", "type": "collect-flag", "sceneId": "arena", "targetId": "red-flag" },
+{ "id": "collect-flags", "type": "collect-flag", "sceneId": "arena", "targetId": "red-flag", "targetCount": 2 },
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion fixes a bug where the 'collect-flag' objective would complete after collecting just one flag, instead of both, by adding the necessary `targetCount` property.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Allow spawning different NPC types</summary>

___

**In <code>spawnNPCFromPersona</code>, allow the entity type to be specified via the persona or <br>overrides instead of being hardcoded as <code>'enemy'</code>, enabling the creation of other <br>NPC types like <code>'guard'</code>.**

[packages/spartan/entities/spawn-helpers.ts [764-765]](https://github.com/neurofuzzy/linkedgrid/pull/32/files#diff-fc5c6076aeeefad40690e961ba51ecefe6e997a42393bca0c04223d5283065daR764-R765)

```diff
-// Use 'enemy' type for entities with movement, 'enemy' for simpler ones
-return spatial.spawn('enemy', x, y, GameLayers.ACTORS, entityData);
+// Use 'enemy' as default type, but allow overrides via persona or explicit override.
+const entityType = overrides?.type ?? persona.type ?? 'enemy';
+return spatial.spawn(entityType as string, x, y, GameLayers.ACTORS, entityData);
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly points out that hardcoding the entity type to `'enemy'` limits the utility of the spawn helper and proposes a good enhancement for flexibility.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Simplify active scene lookup</summary>

___

**Refactor <code>getActiveSceneId</code> to get the active scene directly from the scene <br>manager and return its ID, avoiding an unnecessary and inefficient loop over all <br>scenes.**

[packages/spartan/systems/objective.system.ts [290-299]](https://github.com/neurofuzzy/linkedgrid/pull/32/files#diff-b52e4f5479ed5e7af3284ecf18d746c862d7a388d4721b90f82a303012bb35a2R290-R299)

```diff
 private getActiveSceneId(): string {
-  const allSceneIds = this.gameManager.sceneManager.getAllSceneIds();
-  for (const sceneId of allSceneIds) {
-    const scene = this.gameManager.sceneManager.getScene(sceneId);
-    if (scene === this.gameManager.sceneManager.getActiveScene()) {
-      return sceneId;
-    }
-  }
-  return '';
+  const activeScene = this.gameManager.sceneManager.getActiveScene();
+  return activeScene ? activeScene.id : '';
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=6 -->


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: The suggestion improves performance and simplifies the code by replacing an inefficient loop with a direct lookup of the active scene, assuming the `id` property exists on the scene object.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Initialize exit <code>activated</code> flag</summary>

___

**In <code>spawnExit</code>, explicitly initialize the <code>activated</code> property to <code>false</code> to ensure <br>data clarity and avoid reliance on <code>undefined</code>.**

[packages/spartan/entities/spawn-helpers.ts [857-867]](https://github.com/neurofuzzy/linkedgrid/pull/32/files#diff-fc5c6076aeeefad40690e961ba51ecefe6e997a42393bca0c04223d5283065daR857-R867)

```diff
 export function spawnExit(
   spatial: SpatialSystem,
   x: number,
   y: number,
   overrides?: Partial<{ color: string; sceneId: string }>
 ): number {
   return spatial.spawn('exit', x, y, GameLayers.FLOOR, {
+    activated: false,
     color: '#00ff00',
     ...overrides,
   });
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 4</summary>

__

Why: This is a good practice for data clarity and consistency, ensuring the `activated` property is always explicitly a boolean and preventing potential issues with `undefined` checks.

</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>
