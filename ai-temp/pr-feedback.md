## PR Code Suggestions ✨

<!-- 60898bd -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=2>Possible issue</td>
<td>



<details><summary>Fix NPC getting stuck at junctions</summary>

___

**Update the backtracking logic to prevent NPCs from getting stuck at junctions. <br>The NPC should only avoid its <code>lastPathCell</code> if other unblocked paths are <br>available; otherwise, it should be allowed to reverse.**

[packages/spartan/systems/npc-movement.system.ts [416-422]](https://github.com/neurofuzzy/linkedgrid/pull/24/files#diff-f252990c88405e3357f3d35b86e4a425e79449afd0824e502bd4c0000a9bcf01R416-R422)

```diff
-// Filter out lastPathCell to prevent backtracking (unless dead-end)
+// Filter out lastPathCell to prevent backtracking, but check for blockages.
 let validNeighbors = pathNeighbors;
 if (entityData.lastPathCell && pathNeighbors.length > 1) {
-  validNeighbors = pathNeighbors.filter(
+  const potentialNeighbors = pathNeighbors.filter(
     (n) => n.x !== entityData.lastPathCell!.x || n.y !== entityData.lastPathCell!.y
   );
+  
+  const unblockedNeighbors = potentialNeighbors.filter(n => {
+    const cell = context.spatial.grid.cell(n.x, n.y);
+    return cell && !context.spatial.isBlocked(cell);
+  });
+
+  if (unblockedNeighbors.length > 0) {
+    validNeighbors = unblockedNeighbors;
+  }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion addresses a valid edge case where an NPC could become stuck at a junction if its only non-backtracking path is blocked. The proposed change makes the movement logic more resilient by allowing the NPC to reverse if no other options are available.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Prevent NPC from immediately backtracking</summary>

___

**To prevent an NPC from immediately backtracking after returning to a path, set <br><code>lastPathCell</code> to the NPC's current position instead of <code>undefined</code>.**

[packages/spartan/systems/npc-movement.system.ts [200-211]](https://github.com/neurofuzzy/linkedgrid/pull/24/files#diff-f252990c88405e3357f3d35b86e4a425e79449afd0824e502bd4c0000a9bcf01R200-R211)

```diff
 // Check if we've reached any path node (not just home)
 const pathNodeId = context.spatial.getEntityIdAt(npcPos.x, npcPos.y, GameLayers.LOGIC);
 if (pathNodeId !== undefined) {
   const pathNodeData = context.spatial.getEntityData(pathNodeId);
   if (pathNodeData && isPathNode(pathNodeData)) {
     // Reached a path node, switch to patrol mode
     entityData.movementMode = 'patrol';
     entityData.aiMovementState = 'idle';
-    entityData.lastPathCell = undefined; // Reset to allow any direction
+    // Set lastPathCell to current pos to prevent immediate backtracking
+    entityData.lastPathCell = { x: npcPos.x, y: npcPos.y };
     return false;
   }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: This suggestion correctly identifies a potential issue where an NPC could unnaturally backtrack after returning to a path. Setting `lastPathCell` improves the patrol logic's robustness and leads to more predictable movement.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=1>High-level</td>
<td>



<details><summary>Decouple pathfinding from entity-based nodes</summary>

___

**The patrol logic is tightly coupled to <code>path-node</code> entities on the <code>LOGIC</code> layer. It <br>should be refactored to use an abstract path data structure in the scene <br>configuration, separating path data from game entities.**


### Examples:



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/24/files#diff-f252990c88405e3357f3d35b86e4a425e79449afd0824e502bd4c0000a9bcf01R456-R480">packages/spartan/systems/npc-movement.system.ts [456-480]</a>
</summary>



```typescript
  private getPathNeighbors(
    context: GameContext,
    x: number,
    y: number
  ): Array<{ x: number; y: number }> {
    const cell = context.spatial.grid.cell(x, y);
    if (!cell) return [];

    const neighbors: Array<{ x: number; y: number }> = [];
    for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {

 ... (clipped 15 lines)
```
</details>



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/24/files#diff-31f7645d7bd84caa8256e6599a96c8394b8056b58bf5c33a2af5080fc6609068R73-R106">dev/games/npc-paths.json [73-106]</a>
</summary>



```json
        { "type": "path-node", "x": 2, "y": 3, "layer": 3, "data": { "conductiveType": "path", "receiverType": "path", "receivedSignal": false, "color": "#666666" } },
        { "type": "path-node", "x": 3, "y": 3, "layer": 3, "data": { "conductiveType": "path", "receiverType": "path", "receivedSignal": false, "color": "#666666" } },
        { "type": "path-node", "x": 4, "y": 3, "layer": 3, "data": { "conductiveType": "path", "receiverType": "path", "receivedSignal": false, "color": "#666666" } },
        { "type": "path-node", "x": 5, "y": 3, "layer": 3, "data": { "conductiveType": "path", "receiverType": "path", "receivedSignal": false, "color": "#666666" } },
        { "type": "path-node", "x": 6, "y": 3, "layer": 3, "data": { "conductiveType": "path", "receiverType": "path", "receivedSignal": false, "color": "#666666" } },
        { "type": "path-node", "x": 7, "y": 3, "layer": 3, "data": { "conductiveType": "path", "receiverType": "path", "receivedSignal": false, "color": "#666666" } },
        { "type": "path-node", "x": 8, "y": 3, "layer": 3, "data": { "conductiveType": "path", "receiverType": "path", "receivedSignal": false, "color": "#666666" } },
        { "type": "path-node", "x": 9, "y": 3, "layer": 3, "data": { "conductiveType": "path", "receiverType": "path", "receivedSignal": false, "color": "#666666" } },
        { "type": "path-node", "x": 10, "y": 3, "layer": 3, "data": { "conductiveType": "path", "receiverType": "path", "receivedSignal": false, "color": "#666666" } },


 ... (clipped 24 lines)
```
</details>




### Solution Walkthrough:



#### Before:
```json
// packages/spartan/systems/npc-movement.system.ts
class NPCMovementSystem {
  processPatrol(context, entityId, entityData) {
    const npcPos = context.spatial.getEntityPosition(entityId);
    // Path logic is derived from querying for neighbor entities
    const pathNeighbors = this.getPathNeighbors(context, npcPos.x, npcPos.y);
    // ... move based on neighbors
  }

  getPathNeighbors(context, x, y) {
    const neighbors = [];
    for (const dir of [UP, DOWN, LEFT, RIGHT]) {
      // Checks for a specific entity type on a specific layer
      const pathNodeId = context.spatial.getEntityIdAt(neighbor.x, neighbor.y, GameLayers.LOGIC);
      if (pathNodeId && isPathNode(context.spatial.getEntityData(pathNodeId))) {
        neighbors.push(neighbor);
      }
    }
    return neighbors;
  }
}

```



#### After:
```json
// dev/games/npc-paths.json (hypothetical change)
{
  "scenes": [{
    "id": "paths-demo",
    "entities": [ ... ],
    "paths": {
      "cyan-path": [{x: 2, y: 3}, {x: 3, y: 3}, ...],
      "red-path": [{x: 20, y: 3}, {x: 20, y: 4}, ...]
    }
  }]
}

// packages/spartan/systems/npc-movement.system.ts (hypothetical change)
class NPCMovementSystem {
  processPatrol(context, entityId, entityData) {
    const npcPos = context.spatial.getEntityPosition(entityId);
    const scene = context.sceneManager.getActiveScene();
    // Path is retrieved from a scene-level data structure
    const path = scene.paths[entityData.pathId];

    // Find next node from the abstract path data, not from entities
    const nextNode = findNextNodeInPath(path, npcPos);
    context.spatial.move(entityId, nextNode.x, nextNode.y);
  }
}

```




<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies a tight coupling between patrol logic and `path-node` entities, proposing a valid and more flexible architectural alternative that would improve scalability and separation of concerns.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=2>General</td>
<td>



<details><summary>Simplify dead-end reversal logic</summary>

___

**Simplify dead-end handling by removing the unused <code>patrolDirection</code> property, as <br>backtracking is already managed by <code>lastPathCell</code>.**

[packages/spartan/systems/npc-movement.system.ts [426-429]](https://github.com/neurofuzzy/linkedgrid/pull/24/files#diff-f252990c88405e3357f3d35b86e4a425e79449afd0824e502bd4c0000a9bcf01R426-R429)

```diff
-// Dead-end: only one neighbor (which is lastPathCell), reverse direction
+// Dead-end: only one neighbor (which is lastPathCell), reverse by allowing backtrack
 if (validNeighbors.length === 0) {
   validNeighbors = pathNeighbors;
-  entityData.patrolDirection = entityData.patrolDirection === 1 ? -1 : 1;
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: This suggestion correctly identifies that `patrolDirection` is an unused property. Removing it and its related logic simplifies the code and improves maintainability by eliminating dead code.


</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Eliminate unused guard function</summary>

___

**Remove the unused `hasPathFollowing` type guard to eliminate dead code.**

[packages/spartan/traits/trait-guards.ts [828-838]](https://github.com/neurofuzzy/linkedgrid/pull/24/files#diff-e6fe0a27a19016994f4da0c6ee5948e9656ec928c82808ef97ff98ac52d8f5d8R828-R838)

```diff
-export function hasPathFollowing(
-  entity: EntityData
-): entity is EntityData & HasNPCMovement & { homePathCell: { x: number; y: number } } {
-  if (!hasNPCMovement(entity)) return false;
-  return (
-    'homePathCell' in entity &&
-    entity.homePathCell !== undefined &&
-    typeof (entity.homePathCell as { x: number; y: number }).x === 'number' &&
-    typeof (entity.homePathCell as { x: number; y: number }).y === 'number'
-  );
-}
+// removed unused hasPathFollowing guard
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 4</summary>

__

Why: The suggestion correctly identifies that the `hasPathFollowing` function is not used anywhere in the codebase. Removing this dead code improves maintainability and reduces clutter.


</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>
