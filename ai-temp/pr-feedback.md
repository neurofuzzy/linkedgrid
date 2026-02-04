## PR Code Suggestions ✨

<!-- bb729c6 -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=1>High-level</td>
<td>



<details><summary>Re-evaluate spawner grouping logic performance</summary>

___

**The current spawner grouping logic runs an O(N^2) operation every tick, which is <br>inefficient. This calculation should be moved out of the main game loop and only <br>be triggered when spawner entities are created or destroyed.**


### Examples:



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/25/files#diff-fca9143263971bfbe1d67252465712c68c39ece8c103eaaea1ec3e3ab7c4391eR97-R111">packages/spartan/systems/spawning.system.ts [97-111]</a>
</summary>



```typescript
  protected onTick(context: GameContext): void {
    const currentTick = context.tick ?? 0;
    this.spawnsThisTick.clear();

    // Phase 1: Build/update spawner groups
    this.buildGroups(context);

    // Phase 2: Clean up dead spawned entities from groups
    this.cleanupDeadSpawns(context);


 ... (clipped 5 lines)
```
</details>



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/25/files#diff-fca9143263971bfbe1d67252465712c68c39ece8c103eaaea1ec3e3ab7c4391eR117-R153">packages/spartan/systems/spawning.system.ts [117-153]</a>
</summary>



```typescript
  private buildGroups(context: GameContext): void {
    // Collect all spawner positions
    const spawners: Array<{ id: number; x: number; y: number; data: HasSpawner }> = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasSpawner(entityData)) continue;


 ... (clipped 27 lines)
```
</details>




### Solution Walkthrough:



#### Before:
```typescript
class SpawningSystem extends BaseTickedSystem {
  protected onTick(context: GameContext): void {
    // Phase 1: Build/update spawner groups on every tick
    this.buildGroups(context);

    // ... other phases
  }

  private buildGroups(context: GameContext): void {
    const spawners = []; // Collect all spawners
    // ...

    // O(N^2) adjacency check where N is number of spawners
    for (let i = 0; i < spawners.length; i++) {
      for (let j = i + 1; j < spawners.length; j++) {
        // check adjacency and build graph
      }
    }
    // ... find connected components and create groups
  }
}

```



#### After:
```typescript
class SpawningSystem extends BaseTickedSystem {
  // System now needs to be aware of entity lifecycle events
  // This is a conceptual change, as the event system is not shown.

  public onSpawnerAdded(spawnerId: number): void {
    // Incrementally update groups, e.g., by checking neighbors
    // of the new spawner and merging/creating groups.
    this.recalculateGroups();
  }

  public onSpawnerRemoved(spawnerId: number): void {
    // Incrementally update groups, e.g., by removing the spawner
    // and checking if its group needs to be split.
    this.recalculateGroups();
  }

  protected onTick(context: GameContext): void {
    // Group building is no longer called every tick.
    // It's handled by lifecycle events.

    this.cleanupDeadSpawns(context);
    this.processAllGroups(context);
  }
}

```




<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: This suggestion correctly identifies a significant performance issue (an O(N^2) operation in `buildGroups`) that runs on every tick, which is a critical flaw for a real-time game system's scalability.


</details></details></td><td align=center>High

</td></tr><tr><td rowspan=2>General</td>
<td>



<details><summary>Default <code>spawnProps</code> to <code>{}</code></summary>

___

**In the <code>spawnSpawner</code> helper, provide a default empty object for <code>spawnProps</code> to <br>prevent it from being <code>undefined</code>.**

[packages/spartan/entities/spawn-helpers.ts [648-659]](https://github.com/neurofuzzy/linkedgrid/pull/25/files#diff-fc5c6076aeeefad40690e961ba51ecefe6e997a42393bca0c04223d5283065daR648-R659)

```diff
   export function spawnSpawner(
     spatial: SpatialSystem,
     x: number,
     y: number,
     layer: number,
     props: Omit<SpawnerData, 'id' | 'type'>
   ): number {
+    const { spawnProps = {}, ...rest } = props;
     return spatial.spawn('spawner', x, y, layer, {
-      requiresLineOfSight: true,  // Default to requiring LOS
-      ...props,
+      requiresLineOfSight: true,
+      ...rest,
+      spawnProps,
     });
   }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: This suggestion improves robustness by ensuring `spawnProps` is always an object, preventing potential `undefined` values from propagating. While the `spawn` method might handle this, explicitly setting a default in the helper function is a good practice.


</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Default spawn props to empty object</summary>

___

**In <code>executeSpawn</code>, default <code>intent.props</code> to an empty object to ensure <br><code>context.spatial.spawn</code> always receives a valid props object.**

[packages/spartan/systems/spawning.system.ts [493-499]](https://github.com/neurofuzzy/linkedgrid/pull/25/files#diff-fca9143263971bfbe1d67252465712c68c39ece8c103eaaea1ec3e3ab7c4391eR493-R499)

```diff
     private executeSpawn(
       context: GameContext,
       intent: SpawnIntent
     ): number | null {
       // ...
       const spawnedId = context.spatial.spawn(
         intent.entityType,
         cell.x,
         cell.y,
         intent.layer,
-        intent.props
+        intent.props ?? {}
       );
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 4</summary>

__

Why: The suggestion correctly identifies that `intent.props` can be `undefined` and proposes providing a default empty object, which is a good defensive programming practice to prevent potential issues in the `context.spatial.spawn` method.


</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>

