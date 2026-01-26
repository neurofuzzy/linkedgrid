## PR Code Suggestions ✨

<!-- 68b0c1a -->

Explore these optional code suggestions:


<details><summary>Merge entity and terrain layers</summary>

___

**Enforce a strict separation between terrain layers and entity layers to resolve <br>ambiguity. For example, use a <code>WALLS</code> layer for terrain and a new <code>WALL_ENTITIES</code> <br>layer for dynamic objects like doors.**


### Examples:



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/5/files#diff-9c566eaaaaefffb477d9935a83df50bd17779277d411695bab7d06146ba79f37R91-R133">packages/spartan/test/layers.visual.test.ts [91-133]</a>
</summary>



```typescript
visual('Wall blocking - both terrain and entities block', {
    arrange: ({ spatial, grid }) => {
        // Create walls using values (terrain)
        const cell1 = grid.cell(3, 3);
        if (cell1) cell1.values[GameLayers.WALLS] = 1; // Wall terrain
        
        // Create wall entity (door)
        spatial.spawn('door', 4, 3, GameLayers.WALLS);
        
        // Place player to move

 ... (clipped 33 lines)
```
</details>



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/5/files#diff-a0d6dedd0483b488ea6b6e59802708e62baa72fd87bb2603ded7811967b19ff0R24-R43">packages/spartan/layer-helpers.ts [24-43]</a>
</summary>



```typescript
export function isBlocked(
    cell: LinkedCell | null,
    emptyFloorsBlock = false
): boolean {
    if (!cell) return true;

    if (emptyFloorsBlock && cell.getValue(GameLayers.FLOOR) === undefined) {
        return true;
    }


 ... (clipped 10 lines)
```
</details>




### Solution Walkthrough:



#### Before:
```typescript
// packages/spartan/layer-helpers.ts
export function isBlocked(cell: LinkedCell | null): boolean {
    if (!cell) return true;

    // A single WALLS layer holds both terrain walls and entity walls (e.g., doors)
    if (cell.getValue(GameLayers.WALLS) !== undefined) {
        return true;
    }

    if (cell.getValue(GameLayers.ACTORS) !== undefined) {
        return true;
    }

    return false;
}

```



#### After:
```typescript
// packages/spartan/layer-helpers.ts
export function isBlocked(cell: LinkedCell | null): boolean {
    if (!cell) return true;

    // WALLS layer is for terrain only.
    if (cell.getValue(GameLayers.WALLS) !== undefined) {
        return true;
    }

    // A new WALL_ENTITIES layer is for dynamic wall-like entities.
    if (cell.getValue(GameLayers.WALL_ENTITIES) !== undefined) {
        return true;
    }

    if (cell.getValue(GameLayers.ACTORS) !== undefined) {
        return true;
    }

    return false;
}

```




<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identifies a significant design ambiguity where `cell.values` now holds both terrain and entity data, which could lead to complex logic and bugs, proposing a cleaner separation of concerns.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=3>Possible issue</td>
<td>



<details><summary>Fix BFS logic in find method</summary>

___

**Refactor the <code>find</code> method to use a standard queue-based BFS algorithm. This fixes <br>a bug where the starting cell was not added to the <code>visited</code> set and simplifies <br>the implementation.**

[packages/grid/linked-cell-utils.ts [263-303]](https://github.com/neurofuzzy/linkedgrid/pull/5/files#diff-97806adee125093fcc002fe826d2abb0e6b9781b32f6cfbd2fe956b339bf8d1aR263-R303)

```diff
 static find(
     cell: LinkedCell,
     passFn: (lc: LinkedCell | null) => boolean,
     matchFn: (lc: LinkedCell | null) => boolean,
     maxRange = 10,
     findLimit = 1
 ): { cell: LinkedCell, dist: number }[] {
     const visited = new WeakSet<LinkedCell>();
-    const lcs: { cell: LinkedCell, dist: number }[] = [{ cell, dist: 0 }];
-
-    let ns = cell.neighbors();
-    let nns: (LinkedCell | null)[] = [];
-    let d = 0;
+    const queue: { cell: LinkedCell, dist: number }[] = [{ cell, dist: 0 }];
+    visited.add(cell);
 
     const matches: { cell: LinkedCell, dist: number }[] = [];
-    let findLimitReached = false;
+    let head = 0;
 
-    while (ns.length) {
-        d++;
-        for (const n of ns) {
-            if (n && matchFn(n)) {
-                matches.push({ cell: n, dist: d });
-                if (findLimit > 0 && matches.length === findLimit) {
-                    findLimitReached = true;
-                    break;
+    while (head < queue.length) {
+        const { cell: current, dist } = queue[head++];
+
+        if (dist >= maxRange) continue;
+
+        for (const neighbor of current.neighbors()) {
+            if (neighbor && !visited.has(neighbor)) {
+                visited.add(neighbor);
+
+                if (matchFn(neighbor)) {
+                    matches.push({ cell: neighbor, dist: dist + 1 });
+                    if (findLimit > 0 && matches.length >= findLimit) {
+                        return matches;
+                    }
+                }
+
+                if (passFn(neighbor)) {
+                    queue.push({ cell: neighbor, dist: dist + 1 });
                 }
             }
-            if (n && n !== cell && !visited.has(n) && passFn(n)) {
-                nns.push(...n.neighbors());
-                visited.add(n);
-                lcs.push({ cell: n, dist: d });
-            }
         }
-        ns = nns.filter(n => !!n);
-        nns = [];
-        if (d == maxRange) break;
-        if (findLimitReached) break;
     }
 
     return matches;
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identifies a bug in the BFS implementation where the starting cell is not added to the `visited` set, potentially causing it to be processed multiple times. The proposed refactoring to a standard queue-based BFS is a significant improvement for both correctness and code clarity.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Fix Dijkstra map generation logic</summary>

___

**Rewrite the <code>setDistance</code> method using a standard BFS with a queue to correctly <br>calculate and propagate distances from the source cell. This fixes a bug in the <br>current distance calculation logic.**

[packages/grid/linked-cell-utils.ts [393-424]](https://github.com/neurofuzzy/linkedgrid/pull/5/files#diff-97806adee125093fcc002fe826d2abb0e6b9781b32f6cfbd2fe956b339bf8d1aR393-R424)

```diff
 static setDistance(
     cell: LinkedCell,
     passFn: (lc: LinkedCell | null) => boolean,
     distLayer = 0,
     dist = 1,
     doAdd = false,
     maxRange = 50
 ) {
     const visited = new WeakSet<LinkedCell>();
+    const queue: { cell: LinkedCell, dist: number }[] = [];
+
+    if (!doAdd) {
+        // This is likely a bug in the original logic.
+        // If not adding, we should probably clear all distances, not just the start cell.
+        // For now, we set start to 0.
+        cell.distances[distLayer] = 0;
+    }
     
-    if (!doAdd) cell.distances[distLayer] = 0;
-    const currentDist = cell.distances[distLayer] ?? 0;
-    cell.distances[distLayer] = currentDist + dist;
+    const startDist = cell.distances[distLayer] ?? 0;
+    queue.push({ cell, dist: startDist });
+    visited.add(cell);
 
-    let ns = cell.neighbors();
-    let nns: (LinkedCell | null)[] = [];
-    let d = dist;
+    let head = 0;
+    while (head < queue.length) {
+        const { cell: current, dist: currentDist } = queue[head++];
 
-    while (ns.length) {
-        d++;
-        ns.forEach(n => {
-            if (n && n !== cell && !visited.has(n) && passFn(n)) {
-                nns.push(...n.neighbors());
-                n.distances[distLayer] = d;
-                visited.add(n);
+        if (currentDist >= maxRange) continue;
+
+        for (const neighbor of current.neighbors()) {
+            if (neighbor && !visited.has(neighbor) && passFn(neighbor)) {
+                visited.add(neighbor);
+                const newDist = currentDist + dist;
+                neighbor.distances[distLayer] = newDist;
+                queue.push({ cell: neighbor, dist: newDist });
             }
-        });
-        ns = nns.filter(n => !!n);
-        nns = [];
-        if (d == maxRange) break;
+        }
     }
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identifies a significant bug in the `setDistance` method's distance calculation logic, where all cells at the same depth were assigned the same incorrect distance. The proposed fix using a proper BFS with a queue correctly calculates path distances, fixing the core functionality of this utility method.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Fix redundant check in documentation example</summary>

___

**In the <code>specs/spartan-layer-rules.md</code> file, remove the redundant condition in the <br><code>blocksVision</code> code example.**

[specs/spartan-layer-rules.md [547-552]](https://github.com/neurofuzzy/linkedgrid/pull/5/files#diff-7d0b85b0d8dd26763a442b9aed3916ba55476c8cf42d6313b7b96d363d1a7b52R547-R552)

```diff
 export function blocksVision(cell: LinkedCell | null): boolean {
   if (!cell) return true;
   return VISION_BLOCKING_LAYERS.some(layer => 
-    cell.values[layer] !== undefined || cell.values[layer] !== undefined
+    cell.values[layer] !== undefined
   );
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=3 -->


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: This suggestion correctly identifies and fixes a copy-paste error in a code example within a markdown documentation file. While it doesn't affect the running code, correcting documentation is important for maintainability and preventing future confusion.


</details></details></td><td align=center>Low

</td></tr><tr><td rowspan=2>General</td>
<td>



<details><summary>Validate layer index bounds</summary>

___

**Add validation to the <code>getValue</code> and <code>setValue</code> methods in <code>LinkedCell</code> to throw an <br>error if the provided <code>layer</code> index is outside the valid range of 0-7.**

[packages/grid/linked-cell.ts [115-136]](https://github.com/neurofuzzy/linkedgrid/pull/5/files#diff-504d30ddc0c752608c657deb406ddddcfccdf347996afda3ce035d6975130b64R115-R136)

```diff
-getValue(layer: number): (number | undefined) {
-    return this.values[layer];
+private static readonly MAX_LAYERS = 8;
+
+getValue(layer: number): number | undefined {
+    if (layer < 0 || layer >= LinkedCell.MAX_LAYERS) {
+        throw new RangeError(`Layer index ${layer} out of bounds (0-${LinkedCell.MAX_LAYERS - 1})`);
+    }
+    return this._values[layer];
 }
 
-setValue(layer: number, val: (number | undefined)) {
+setValue(layer: number, val: number | undefined) {
+    if (layer < 0 || layer >= LinkedCell.MAX_LAYERS) {
+        throw new RangeError(`Layer index ${layer} out of bounds (0-${LinkedCell.MAX_LAYERS - 1})`);
+    }
     this._values[layer] = val;
     return this;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly proposes adding boundary checks for layer access in `getValue` and `setValue`. This improves the robustness of the `LinkedCell` class by providing fail-fast behavior for invalid layer indices, which is a valuable addition for error handling.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Simplify boolean logic in helper function</summary>

___

**Refactor the <code>isBlocked</code> function to use a single boolean expression instead of <br>multiple <code>if</code> statements for conciseness.**

[packages/spartan/layer-helpers.ts [24-43]](https://github.com/neurofuzzy/linkedgrid/pull/5/files#diff-a0d6dedd0483b488ea6b6e59802708e62baa72fd87bb2603ded7811967b19ff0R24-R43)

```diff
 export function isBlocked(
     cell: LinkedCell | null,
     emptyFloorsBlock = false
 ): boolean {
-    if (!cell) return true;
-
-    if (emptyFloorsBlock && cell.getValue(GameLayers.FLOOR) === undefined) {
+    if (!cell) {
         return true;
     }
 
-    if (cell.getValue(GameLayers.WALLS) !== undefined) {
-        return true;
-    }
-
-    if (cell.getValue(GameLayers.ACTORS) !== undefined) {
-        return true;
-    }
-
-    return false;
+    return (
+        (emptyFloorsBlock && cell.getValue(GameLayers.FLOOR) === undefined) ||
+        cell.getValue(GameLayers.WALLS) !== undefined ||
+        cell.getValue(GameLayers.ACTORS) !== undefined
+    );
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 3</summary>

__

Why: The suggestion proposes a minor refactoring to combine multiple `if` statements into a single boolean expression. While this improves conciseness, the performance impact is negligible and it's primarily a stylistic improvement.


</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>

