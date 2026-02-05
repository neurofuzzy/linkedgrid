## PR Code Suggestions ✨
<!-- cb4f2d1 -->

Latest suggestions up to cb4f2d1
<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=5>Incremental <sup><a href='https://qodo-merge-docs.qodo.ai/core-abilities/incremental_update/'>[*]</a></sup></td>
<td>



<details><summary>Return an immutable state snapshot</summary>

___

**In <code>getState()</code>, create a deep copy of nested objects like <code>mouse</code>, <code>gamepad</code>, and <br><code>keys</code> when creating the <code>result</code> snapshot. This prevents subsequent internal state <br>clearing from mutating the returned object, ensuring the caller receives a <br>stable and accurate input state for the frame.**

[etc/input-manager-WORKING.ts [848-870]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-0d00e047876811da50cf46a1f7772f4c9edd32c75196396e677afecda3306ecbR848-R870)

```diff
 getState(): InputState {
   // First, ensure the current state is up-to-date before we copy it.
   // This is crucial for tap mode, which relies on `keysJustPressed`.
   // Pass true to consume from buffer (only getState() should drain buffer)
   this.updateStateFromEvents(true);
 
   // Create a copy of the fully updated state to return to the caller.
-  const result = { ...this.state };
+  // IMPORTANT: clone nested objects so subsequent internal clears do not
+  // mutate the returned snapshot.
+  const result: InputState = {
+    ...this.state,
+    mouse: { ...this.state.mouse },
+    gamepad: { ...this.state.gamepad },
+    keys: new Set(this.state.keys),
+  };
 
   // Now, clear the one-shot events from the internal state for the next frame.
   this.mouseClicked = false;
   this.mouseWheelDeltaX = 0;
   this.mouseWheelDeltaY = 0;
   this.keysJustPressed.clear();
   this.actionKeyPressed = false;
 
   // Update the internal state object to reflect these cleared values.
   this.state.mouse.clicked = false;
   this.state.mouse.wheelDeltaX = 0;
   this.state.mouse.wheelDeltaY = 0;
 
   return result;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: This suggestion correctly identifies a critical bug where the returned state snapshot is mutated after creation, potentially causing missed inputs like `mouse.clicked`, which undermines the purpose of the `getState` method.


</details></details></td><td align=center>High

</td></tr><tr><td>



<details><summary>Fix buffered action consumption</summary>

___

**In <code>updateStateFromEvents()</code>, only consume and clear <code>this.actionBuffer</code> when the <br><code>consumeBuffer</code> flag is true. This prevents buffered actions from being <br>prematurely cleared by event handlers before <code>getState()</code> can process them.**

[etc/input-manager-WORKING.ts [905-912]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-0d00e047876811da50cf46a1f7772f4c9edd32c75196396e677afecda3306ecbR905-R912)

```diff
 // Action from held keys or buffer
+const bufferedAction = consumeBuffer ? this.actionBuffer : false;
 this.state.action =
-  this.keysDown.has(' ') || this.actionKeyPressed || this.actionBuffer;
+  this.keysDown.has(' ') || this.actionKeyPressed || bufferedAction;
 
-// Clear consumed action buffer
-if (this.actionBuffer) {
+// Clear consumed action buffer only when explicitly consuming
+if (consumeBuffer && this.actionBuffer) {
   this.actionBuffer = false;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a bug where buffered actions could be lost before being processed by the game loop, making the buffering feature unreliable for actions. The fix correctly aligns action buffer consumption with direction buffer consumption.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Stabilize direction resolution order</summary>

___

**Replace the <code>for...of</code> loop over <code>keysJustPressed</code> with a series of <code>if</code> statements to <br>enforce a deterministic priority order for key checks.**

[packages/spartan-web/input/input-manager.ts [1001-1015]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-9c5bc7249675a0b6687156832c7c07437fc9f0786d0d8fb5615d152d0b45b61dR1001-R1015)

```diff
 private getWasdDirection(): Direction {
-  // Check keysJustPressed first (for quick taps)
-  for (const key of this.keysJustPressed) {
-    if (key === 'w' || key === 'W') return Direction.UP;
-    if (key === 's' || key === 'S') return Direction.DOWN;
-    if (key === 'a' || key === 'A') return Direction.LEFT;
-    if (key === 'd' || key === 'D') return Direction.RIGHT;
-  }
+  // Check keysJustPressed first (for quick taps) with deterministic priority
+  if (this.keysJustPressed.has('w') || this.keysJustPressed.has('W')) return Direction.UP;
+  if (this.keysJustPressed.has('s') || this.keysJustPressed.has('S')) return Direction.DOWN;
+  if (this.keysJustPressed.has('a') || this.keysJustPressed.has('A')) return Direction.LEFT;
+  if (this.keysJustPressed.has('d') || this.keysJustPressed.has('D')) return Direction.RIGHT;
+
   // Fall back to keysDown (for held keys)
   if (this.keysDown.has('w') || this.keysDown.has('W')) return Direction.UP;
   if (this.keysDown.has('s') || this.keysDown.has('S')) return Direction.DOWN;
   if (this.keysDown.has('a') || this.keysDown.has('A')) return Direction.LEFT;
   if (this.keysDown.has('d') || this.keysDown.has('D')) return Direction.RIGHT;
   return Direction.NONE;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=2 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies that iterating a `Set` can introduce non-deterministic behavior and proposes changing to explicit `if` checks, which improves the robustness and predictability of input handling.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Prevent invalid array length renders</summary>

___

**Ensure the <code>lives</code> variable is a non-negative integer before using it to create an <br>array for rendering. This prevents a potential <code>RangeError</code> that could crash the <br>HUD if <code>lives</code> is negative.**

[dev/grid-renderer.tsx [310-466]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-0851ee83f65c14beb434009ee588b260ce1b3078ab3858d1566bca1c9661a93fR310-R466)

```diff
 const lives = runtime.game.gameState.lives ?? 3;
+const safeLives = Math.max(0, Math.floor(lives));
 ...
 {isVerySmallGrid ? (
-  <span>{lives}</span>
+  <span>{safeLives}</span>
 ) : (
-  Array.from({ length: Math.min(lives, 5) }).map((_, i) => (
+  Array.from({ length: Math.min(safeLives, 5) }).map((_, i) => (
     <span key={i}>♥</span>
   ))
 )}
-{!isVerySmallGrid && lives > 5 && <span>+{lives - 5}</span>}
+{!isVerySmallGrid && safeLives > 5 && <span>+{safeLives - 5}</span>}
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: This suggestion correctly identifies a potential runtime crash if the `lives` value becomes negative, which would throw a `RangeError`. The proposed fix makes the HUD rendering more robust by sanitizing the `lives` value.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Prevent invalid ammo values</summary>

___

**Add validation to normalize the <code>ammoAmount</code> in <code>applyWeaponPickup</code> to ensure it is <br>a finite, non-negative integer before adding it to the player's ammo.**

[packages/spartan/systems/powerup.system.ts [299-320]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-fb4c4b470e779889ed9dde1c4ebcbd2a616c00235e06baf13cee3bca4f410804R299-R320)

```diff
 private applyWeaponPickup(collectorData: EntityData, weaponType: string, ammoAmount: number): boolean {
   // Initialize weapon trait if not present
   if (!hasWeapon(collectorData)) {
     (collectorData as any).equippedWeapon = weaponType;
     (collectorData as any).ammo = {};
   }
 
   const weaponData = collectorData as EntityData & { equippedWeapon: string; ammo: Record<string, number> };
 
   // Switch to the new weapon
   weaponData.equippedWeapon = weaponType;
 
   // Initialize ammo for weapon type if not present
   if (!(weaponData.ammo[weaponType] >= 0)) {
     weaponData.ammo[weaponType] = 0;
   }
 
-  // Add starting ammo
-  weaponData.ammo[weaponType] += ammoAmount;
+  // Add starting ammo (defensive)
+  const normalizedAmmo = Number.isFinite(ammoAmount) ? Math.max(0, Math.floor(ammoAmount)) : 0;
+  weaponData.ammo[weaponType] += normalizedAmmo;
 
   return true;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion adds defensive code to sanitize the `ammoAmount`, which improves the robustness of the system against malformed entity data, preventing potential bugs with ammo counts.


</details></details></td><td align=center>Low

</td></tr><tr><td rowspan=4>Possible issue</td>
<td>



<details><summary>Avoid resetting persisted lives</summary>

___

**In the <code>RespawnSystem</code> constructor, only initialize <code>GameState.lives</code> if it's not <br>already set, to avoid resetting lives during events like scene reloads.**

[packages/spartan/systems/respawn.system.ts [85-94]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-f8f0caef8303802cb67b57c52e95cf376032b9ed790ce06aa2d743c5213c9bc5R85-R94)

```diff
 constructor(
   private gameManager: GameManager,
   config: Partial<RespawnSystemConfig> = {}
 ) {
   super();
   this.config = { ...DEFAULT_CONFIG, ...config };
-  // Initialize GameState lives from config
-  this.gameManager.gameState.maxLives = this.config.maxLives;
-  this.gameManager.gameState.lives = this.config.maxLives;
+
+  // Initialize GameState lives from config without wiping an in-progress run
+  const gs = this.gameManager.gameState;
+  gs.maxLives = this.config.maxLives;
+
+  if (gs.lives === undefined || gs.lives === null) {
+    gs.lives = gs.maxLives;
+  } else if (gs.maxLives > 0) {
+    // Clamp if maxLives is reduced
+    gs.lives = Math.min(gs.lives, gs.maxLives);
+  }
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: This suggestion correctly points out that unconditionally resetting `lives` in the constructor can wipe persisted game state, improving the system's robustness against re-initialization.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Persist cone damage via store</summary>

___

**In <code>processConeAttack</code>, persist damage through the entity store instead of <br>directly mutating <code>entityData.hp</code> to ensure the change is correctly saved.**

[packages/spartan/systems/player-weapon.system.ts [346-352]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-0823fd508de342df38374d8e2dbeb395f8fe180d000d0f3c1568e797929ecd1eR346-R352)

```diff
 // Apply damage
 if (this.healthSystem) {
   this.healthSystem.damage(entityId, weaponConfig.damage, weaponConfig.name);
 } else {
-  // Direct damage if no health system
-  entityData.hp = Math.max(0, entityData.hp - weaponConfig.damage);
+  const newHp = Math.max(0, entityData.hp - weaponConfig.damage);
+  context.gameManager.gameState.entityStore.setData(entityId, { hp: newHp });
+
+  // Basic cleanup if the project doesn't have HealthSystem wired
+  if (newHp <= 0) {
+    context.spatial.remove(entityId);
+  }
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=6 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly identifies that direct mutation of `entityData.hp` is fragile and proposes a more robust solution using the entity store, improving data consistency.


</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Prevent options from overriding config</summary>

___

**Reorder the properties in the <code>inputConfig</code> object by spreading <br><code>gameConfig.input.options</code> first. This ensures that the explicitly set <code>type</code> and <br><code>preset</code> properties are not accidentally overridden.**

[packages/spartan-web/game-embed.ts [125-130]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-b5821aa655f579972805acc32fe61d514c01c7a2c66f7cb078319c0f30ac32e4R125-R130)

```diff
 const inputConfig: GameEmbedInputConfig = {
   ...this.embedConfig.input,
+  ...(gameConfig.input?.options as Record<string, unknown> ?? {}),
   type: gameConfig.input?.type ?? this.embedConfig.input?.type ?? 'keyboard',
   preset: gameConfig.input?.preset ?? this.embedConfig.input?.preset ?? 'classic',
-  ...(gameConfig.input?.options as Record<string, unknown> ?? {}),
 };
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: This is a valid suggestion that improves the robustness of configuration handling by preventing `options` from unintentionally overriding the `type` and `preset` values.


</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Keep projectile target coordinates consistent</summary>

___

**Update <code>projectile.targetX</code> and <code>projectile.targetY</code> with the clamped coordinate <br>values. This ensures that any subsequent logic uses the correct, in-bounds <br>target coordinates.**

[packages/spartan/systems/projectile.system.ts [112-117]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-fa7d17df78052e6c381688b9b446202dd6cb2fbd446ad1abb90d0afb6e04e15eR112-R117)

```diff
 // Clamp target coordinates to grid bounds to ensure valid path
 const grid = context.spatial.grid;
 const clampedTargetX = Math.max(0, Math.min(grid.width - 1, projectile.targetX));
 const clampedTargetY = Math.max(0, Math.min(grid.height - 1, projectile.targetY));
 
-const targetCell = grid.cell(clampedTargetX, clampedTargetY);
+projectile.targetX = clampedTargetX;
+projectile.targetY = clampedTargetY;
 
+const targetCell = grid.cell(projectile.targetX, projectile.targetY);
+
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=8 -->


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: The suggestion improves data consistency by updating the `projectile`'s target coordinates after clamping, which is good practice, though its current impact is minor as no other code seems to use these properties after this point.


</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>

___

#### Previous suggestions
<details><summary>Suggestions up to commit 7b7790c</summary>
<br><table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=1>Possible issue</td>
<td>



<details><summary>Always update damage timing</summary>

___

**Move the <code>state.lastDamageTime</code> update outside the <code>else</code> block in <code>applyDamage</code>. This <br>ensures the damage cadence is respected even when <code>HealthSystem</code> is used.**

[packages/spartan/systems/floor-effect.system.ts [382-397]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-8556afd01b3ae9943c19049bfb5e0f0cb9c4d67ec2a5a0dbc1b9c9f9c20aac2cR382-R397)

```diff
 if (this.healthSystem) {
   this.healthSystem.damage(entityData.id, effectiveDamage, 'floor-effect');
 } else {
   const newHp = Math.max(0, entityData.hp - effectiveDamage);
-  this.gameManager.gameState.entityStore.setData(entityData.id, {
-    hp: newHp,
-  });
-
-  // Update timing state
-  state.lastDamageTime = currentTick;
-
-  // Remove entity if dead
+  this.gameManager.gameState.entityStore.setData(entityData.id, { hp: newHp });
   if (newHp <= 0) {
     context.spatial.remove(entityData.id);
   }
 }
+// Always update timing state to enforce cadence
+state.lastDamageTime = currentTick;
```


 <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identifies a bug where the damage `cadence` is not respected when a `HealthSystem` is used, because `lastDamageTime` is only updated in the `else` block. Applying this fix is critical for correct floor damage behavior.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=1>General</td>
<td>



<details><summary>Fix missing game-over assertion</summary>

___

**In the 'game over when no lives remaining' visual test, add an assertion to <br>verify that the <code>gameOverCalled</code> flag is true. This ensures the test correctly <br>validates that the <code>onGameOver</code> callback was triggered.**

[packages/spartan/test/respawn-lives.visual.test.ts [182-184]](https://github.com/neurofuzzy/linkedgrid/pull/30/files#diff-c034efa2a5e1af4021b2f5a4208088682d0ed4bcee3f5c716479f7745356d899R182-R184)

```diff
 expect('Game over callback was called', () => {
-  // Access through the test context
+  const result = (spatial as any).__testResult;
+  if (!result.gameOverCalled) {
+    throw new Error('Expected onGameOver to be called');
+  }
 });
```


 <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly points out a missing assertion in a visual test, which currently passes regardless of whether the `onGameOver` callback is called. Adding the assertion makes the test meaningful and capable of catching regressions.


</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

 <!-- /improve_multi --more_suggestions=true -->

</td><td></td></tr></tbody></table>

</details>
