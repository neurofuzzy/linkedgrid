## PR Code Suggestions ✨

<!-- 75c76e8 -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=5>Possible issue</td>
<td>



<details><summary>Prevent projectile tunneling with accurate sub-stepping</summary>

___

**To prevent projectile tunneling, calculate the number of movement sub-steps <br>based on the maximum displacement along either the x or y axis, rather than the <br>total speed.**

[packages/spartan/systems/projectile.system.ts [293-300]](https://github.com/neurofuzzy/linkedgrid/pull/36/files#diff-fa7d17df78052e6c381688b9b446202dd6cb2fbd446ad1abb90d0afb6e04e15eR293-R300)

```diff
 // Total displacement this tick
 const totalDx = vx;
 const totalDy = vy;
 
-// Sub-steps of at most 0.5 cells so geometric checks don't skip actors
-const steps = Math.max(1, Math.ceil(speed * 2));
+// Sub-steps of at most 0.5 cells so geometric checks don't skip actors.
+// Base steps on the largest axis displacement to prevent tunneling.
+const maxAxisMovement = Math.max(Math.abs(totalDx), Math.abs(totalDy));
+const steps = Math.max(1, Math.ceil(maxAxisMovement * 2));
 const stepDx = totalDx / steps;
 const stepDy = totalDy / steps;
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a potential tunneling bug where sub-step calculations based on total `speed` can be insufficient for sharp-angle movements, and proposes a more robust calculation based on the maximum axial displacement (`vx` or `vy`) to prevent this.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Improve wall bounce reflection logic</summary>

___

**Refactor the <code>bounceVelocity</code> method to use parametric intersection calculations <br>to determine which wall face was hit first, providing a more reliable and direct <br>way to handle bounces compared to the current cell-checking logic.**

[packages/spartan/systems/projectile.system.ts [461-502]](https://github.com/neurofuzzy/linkedgrid/pull/36/files#diff-fa7d17df78052e6c381688b9b446202dd6cb2fbd446ad1abb90d0afb6e04e15eR461-R502)

```diff
 private bounceVelocity(
   context: GameContext,
   projectile: HasProjectile,
   hitFloatX: number,
   hitFloatY: number,
   stepDx: number,
   stepDy: number
 ): void {
-  // Determine wall orientation by testing adjacent cells
-  const prevCellX = Math.floor(hitFloatX - stepDx);
-  const prevCellY = Math.floor(hitFloatY - stepDy);
-  const hitCellX = Math.floor(hitFloatX);
-  const hitCellY = Math.floor(hitFloatY);
+  const prevFloatX = hitFloatX - stepDx;
+  const prevFloatY = hitFloatY - stepDy;
+  const wallCellX = Math.floor(hitFloatX);
+  const wallCellY = Math.floor(hitFloatY);
 
-  const dx = hitCellX - prevCellX;
-  const dy = hitCellY - prevCellY;
+  let tx = Infinity;
+  let ty = Infinity;
 
-  // Try reflecting each axis to find valid bounce direction
-  if (dx !== 0 && dy !== 0) {
-    // Diagonal approach: try reflecting X first
-    const cellAfterReflectX = context.spatial.grid.cell(prevCellX, hitCellY);
-    const cellAfterReflectY = context.spatial.grid.cell(hitCellX, prevCellY);
+  if (stepDx !== 0) {
+    const edgeX = stepDx > 0 ? wallCellX : wallCellX + 1;
+    tx = (edgeX - prevFloatX) / stepDx;
+  }
+  if (stepDy !== 0) {
+    const edgeY = stepDy > 0 ? wallCellY : wallCellY + 1;
+    ty = (edgeY - prevFloatY) / stepDy;
+  }
 
-    if (cellAfterReflectX && !context.spatial.isBlocked(cellAfterReflectX)) {
-      // Reflect X axis (bounce off vertical wall)
-      projectile.vx = -(projectile.vx ?? 0);
-    } else if (cellAfterReflectY && !context.spatial.isBlocked(cellAfterReflectY)) {
-      // Reflect Y axis (bounce off horizontal wall)
-      projectile.vy = -(projectile.vy ?? 0);
-    } else {
-      // Corner: reflect both axes
-      projectile.vx = -(projectile.vx ?? 0);
-      projectile.vy = -(projectile.vy ?? 0);
-    }
-  } else if (dx !== 0) {
-    // Approaching from X: reflect X
+  // Compare t values to see which wall was hit first
+  if (tx < ty) {
+    // Hit a vertical wall
     projectile.vx = -(projectile.vx ?? 0);
+  } else if (ty < tx) {
+    // Hit a horizontal wall
+    projectile.vy = -(projectile.vy ?? 0);
   } else {
-    // Approaching from Y: reflect Y
+    // Hit a corner exactly (or parallel movement)
+    projectile.vx = -(projectile.vx ?? 0);
     projectile.vy = -(projectile.vy ?? 0);
   }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion proposes a more robust and mathematically precise method for handling projectile bounces by calculating parametric intersection times, which simplifies the logic and improves reliability over the existing cell-checking approach.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Fix ray-circle intersection from within</summary>

___

**Correct the ray-circle intersection algorithm to handle cases where the ray <br>originates inside the target circle.**

[specs/projectile-positioning-bug-analysis.md [247-254]](https://github.com/neurofuzzy/linkedgrid/pull/36/files#diff-9483786caa0ada625bf6c7774efa5423f8e45db3c9fee9b50875e1c205f7a22cR247-R254)

```diff
 // Check if ray gets close enough to circle
 if (distSq > circleRadius * circleRadius) return null;
 
 // Calculate intersection distance along ray
 const halfChord = Math.sqrt(circleRadius * circleRadius - distSq);
-const intersectionDist = projection - halfChord;
+let intersectionDist = projection - halfChord;
+
+// If the ray starts inside the circle, the first intersection is behind
+// the start point. Use the second intersection point instead.
+if (intersectionDist < 0) {
+  intersectionDist = projection + halfChord;
+}
 
 // Check if intersection is within ray segment
-if (intersectionDist < 0 || intersectionDist > rayLength) return null;
+if (intersectionDist > rayLength) return null;
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies and fixes a significant edge case in the proposed `rayCircleIntersection` algorithm where a ray starting inside the circle would fail to register a collision.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Prevent division-by-zero in collision check</summary>

___

**Add a guard to the <code>rayAABBIntersection</code> algorithm to prevent division-by-zero <br>errors when handling axis-aligned rays.**

[specs/projectile-positioning-bug-analysis.md [300-303]](https://github.com/neurofuzzy/linkedgrid/pull/36/files#diff-9483786caa0ada625bf6c7774efa5423f8e45db3c9fee9b50875e1c205f7a22cR300-R303)

```diff
+// Handle axis-aligned rays to avoid division by zero
+if (dirX === 0 && (rayStart.x < boxMin.x || rayStart.x > boxMax.x)) {
+  return null;
+}
+if (dirY === 0 && (rayStart.y < boxMin.y || rayStart.y > boxMax.y)) {
+  return null;
+}
+
 // Compute intersection distances for each axis
 const tMinX = (boxMin.x - rayStart.x) / dirX;
 const tMaxX = (boxMax.x - rayStart.x) / dirX;
 const tMinY = (boxMin.y - rayStart.y) / dirY;
 const tMaxY = (boxMax.y - rayStart.y) / dirY;
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies and prevents a division-by-zero error in the `rayAABBIntersection` algorithm for axis-aligned rays, which is a critical edge case for collision detection.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Fix incorrect logic in lookahead</summary>

___

**In the depth-2 lookahead, replace an incorrect self-check with a check to <br>prevent the path from immediately returning to the candidate cell.**

[packages/spartan/systems/npc-movement.system.ts [463-474]](https://github.com/neurofuzzy/linkedgrid/pull/36/files#diff-f252990c88405e3357f3d35b86e4a425e79449afd0824e502bd4c0000a9bcf01R463-R474)

```diff
 // Depth 2: check one more step
 for (const dir3 of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
   const next2 = next.neighbor(dir3);
   if (!next2) continue;
   if (context.spatial.isBlocked(next2)) continue;
+
+  // Don't count paths that return to the candidate cell
+  if (next2.x === c.cell.x && next2.y === c.cell.y) continue;
+
   const next2Key = `${next2.x},${next2.y}`;
-  if (next2Key === nextKey) continue; // don't count self
   if (next2Key === currentKey) continue;
   if (bodyPositions.has(next2Key)) continue;
   openCount++;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly identifies a line of dead code and proposes a logical fix that improves the correctness of the new chain-head wandering algorithm.

</details></details></td><td align=center>Low

</td></tr><tr><td rowspan=1>General</td>
<td>



<details><summary>Add meaningful assertions to test</summary>

___

**Strengthen the test for a homing projectile with a dead target by adding <br>assertions to verify the target's death and that the projectile stops homing.**

[packages/spartan/test/homing-projectile.test.ts [152-158]](https://github.com/neurofuzzy/linkedgrid/pull/36/files#diff-8c78e5cc54df8803f8f7c63075d236f17ca69b4f42290acf5af33bb0ce0e1b51R152-R158)

```diff
 // Act: advance until projectile kills the target and passes through
-for (let i = 0; i < 12; i++) {
+// With speed 1, it takes 5 ticks to reach the target at (5,5) from (0,5)
+for (let i = 0; i < 6; i++) {
   gameLoop.tick();
 }
 
-// Assert: no error was thrown and the system handled dead target gracefully.
-expect(true).toBe(true);
+// Assert: target should be dead and projectile should no longer be homing.
+const targetData = store.getData(targetId);
+expect(targetData?.healthState).toBe('dying');
 
+const projData = store.getData(projId);
+expect(projData?.homingTargetId).toBeUndefined();
+
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly points out a weak assertion in a new test and proposes adding meaningful checks that validate the core behavior being tested.

</details></details></td><td align=center>Medium

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>
