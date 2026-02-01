## PR Code Suggestions ✨

<!-- 455ae1b -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=1>Possible issue</td>
<td>



<details><summary>Reintroduce input buffering for responsiveness</summary>

___

**Reintroduce an input buffer in <code>PlayerInputSystem</code> to prevent missed inputs and <br>ensure responsive controls, especially in low-frame-rate scenarios. This can be <br>done by extending <code>InputProvider</code> to support buffer draining.**

[packages/spartan/systems/player-input.system.ts [45-72]](https://github.com/neurofuzzy/linkedgrid/pull/20/files#diff-9d78b1dbf8f8122dfcb1dbcc39ee13d0c32d57545e5787c3931cd67acf3857aeR45-R72)

```diff
 update(context: GameContext): void {
   this.debugStats.movesThisTick = 0;
 
   const playerId = this.gameManager.gameState.playerEntityId;
   if (!playerId || playerId === 0) return;
 
   const pos = context.spatial.getEntityPosition(playerId);
   if (!pos) return;
 
-  const lastDirection = this.inputProvider.getDirection();
+  // Assumes inputProvider is extended to have a buffer
+  // e.g., `drainInputBuffer(): Direction[]`
+  const inputs = this.inputProvider.drainInputBuffer?.() ?? [this.inputProvider.getDirection()];
+  
+  let lastDirection = Direction.NONE;
+  for (const direction of inputs) {
+    if (direction !== Direction.NONE) {
+      lastDirection = direction;
+    }
+  }
 
   this.debugStats.lastDirection = lastDirection;
 
   if (lastDirection === Direction.NONE) return;
 
   const delta = this.directionToDelta(lastDirection);
   const newX = pos.x + delta.x;
   const newY = pos.y + delta.y;
 
   if (context.spatial.isOutOfBounds(newX, newY)) {
     this.debugStats.blockedMoves++;
     return;
   }
 
   context.spatial.move(playerId, newX, newY);
   this.debugStats.movesThisTick++;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: The suggestion correctly identifies a significant functional regression where removing the input buffer can lead to missed inputs and unresponsive controls, which is a critical issue for gameplay.

</details></details></td><td align=center>High

</td></tr><tr><td rowspan=3>General</td>
<td>



<details><summary>Use dependency injection for provider</summary>

___

**Refactor <code>WebInputProvider</code> to accept an <code>InputManager</code> via its constructor. Then, <br>in <code>SceneLoader</code>, instantiate <code>WebInputProvider</code> with the manager instead of <br>creating an ad-hoc adapter object to improve code reuse and maintainability.**

[dev/scene-loader.ts [189-202]](https://github.com/neurofuzzy/linkedgrid/pull/20/files#diff-950f0a4080831ca6034793672a2302efb2c0fe3af1f13faaa883e7fe9890b4b5R189-R202)

```diff
-// Let's create a simple adapter object that matches InputProvider interface
-// and delegates to our created manager.
-// This avoids refactoring WebInputProvider to accept an existing manager for now.
-const inputProvider = {
-  getDirection: () => manager.getState().direction,
-  getAction: () => manager.getState().action,
-  getSecondary: () => manager.getState().secondary,
-  getStart: () => manager.getState().start,
-  getRestart: () => manager.getState().restart,
-};
+// In `packages/spartan-web/input/web-input-provider.ts`, modify the constructor:
+// constructor(private manager: InputManager) {}
+// (and remove the internal `new InputManager` call)
+
+// Then, in `dev/scene-loader.ts`:
+const inputProvider = new WebInputProvider(manager);
 
 // Create and register PlayerInputSystem
 // Runs FIRST to stage movement intents before reactive systems
 const playerInputSystem = new PlayerInputSystem(runtime.game, inputProvider);
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: This suggestion correctly points out that using an ad-hoc adapter is a temporary fix and proposes a cleaner, more maintainable design using dependency injection with the `WebInputProvider`, improving code quality.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Add adapter destroy method</summary>

___

**Add a <code>destroy</code> method to the ad-hoc <code>inputProvider</code> adapter in <code>dev/scene-loader.ts</code> <br>that calls the <code>cleanup</code> function. This ensures proper teardown of event listeners <br>and prevents memory leaks.**

[dev/scene-loader.ts [192-198]](https://github.com/neurofuzzy/linkedgrid/pull/20/files#diff-950f0a4080831ca6034793672a2302efb2c0fe3af1f13faaa883e7fe9890b4b5R192-R198)

```diff
 const inputProvider = {
   getDirection: () => manager.getState().direction,
   getAction: () => manager.getState().action,
   getSecondary: () => manager.getState().secondary,
   getStart: () => manager.getState().start,
   getRestart: () => manager.getState().restart,
+  destroy: cleanup,
 };
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=2 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly identifies a potential memory leak by pointing out the missing `destroy` method on the ad-hoc adapter, which is necessary for cleaning up event listeners.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Initialize input listeners automatically</summary>

___

**Automatically enable keyboard, mouse, and gamepad listeners within the <br><code>WebInputProvider</code> constructor to ensure it starts capturing input by default upon <br>instantiation.**

[packages/spartan-web/input/web-input-provider.ts [8-10]](https://github.com/neurofuzzy/linkedgrid/pull/20/files#diff-83628b4828cb94c5fd8a4f4b60d2c53fca64475366bc3555efa13222898211c1R8-R10)

```diff
 constructor(container: HTMLElement | null, canvas: HTMLCanvasElement | null, config?: InputConfig) {
   this.manager = new InputManager(container, canvas, config);
+  this.manager.enableKeyboard().enableMouse().enableGamepad();
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=3 -->


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: The suggestion improves the usability of the new `WebInputProvider` by making it active by default, which simplifies its usage. However, this change might not be universally desirable if selective input enabling is needed.

</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>

