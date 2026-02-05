## PR Code Suggestions

<!-- 695e6b9 -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=1>High-level</td>
<td>



<details><summary>Decouple system creation from core</summary>

___

**The <code>system-registry.ts</code> file hardcodes the creation of all systems, reducing <br>modularity. It is suggested to adopt a plugin-based architecture, allowing <br>developers to include only necessary systems, which would enhance flexibility <br>and reduce final bundle size.**


### Examples:



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/29/files#diff-56171b0797855c9e6ae4bc2ca6dca047a438b11dd7b041e3f2d8867548e3893cR57-R127">packages/spartan/core/system-registry.ts [57-127]</a>
</summary>



```typescript
export function createAllSystems(
  gameManager: GameManager,
  inputProvider?: InputProvider
): GameSystem[] {
  const systems: GameSystem[] = [];

  // === CORE SYSTEMS (no dependencies) ===
  const pushSystem = new PushSystem();
  const explosionSystem = new ExplosionSystem();
  const fireSystem = new FireSystem();

 ... (clipped 61 lines)
```
</details>



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/29/files#diff-123def48edf8f2ab6f411a7d5ed24078f0d29442c09713258829d302ade4b4d3R195-R200">packages/spartan/core/game-runtime.ts [195-200]</a>
</summary>



```typescript
  static fromConfig(
    config: GameConfig,
    inputProvider?: InputProvider
  ): GameRuntime {
    const game = new GameManager();

```
</details>




### Solution Walkthrough:



#### Before:
```typescript
// packages/spartan/core/system-registry.ts
export function createAllSystems(gameManager, inputProvider) {
  const systems = [];
  // ... hardcoded instantiation of 22 systems ...
  systems.push(new HealthSystem());
  systems.push(new MeleeSystem(gameManager, ...));
  systems.push(new PowerupSystem({ healthSystem }));
  systems.push(new RespawnSystem(gameManager));
  // ... and 18 more
  return systems;
}

// packages/spartan/core/game-runtime.ts
class GameRuntime {
  static fromConfig(config, inputProvider) {
    // ...
    const systems = createAllSystems(game, inputProvider);
    const runtime = new GameRuntime(game, systems);
    // ...
  }
}

```



#### After:
```typescript
// A potential plugin-based approach
class GameBuilder {
  private systems: GameSystem[] = [];
  
  public use(plugin: (builder: this) => void): this {
    plugin(this);
    return this;
  }

  public addSystem(system: GameSystem): void {
    this.systems.push(system);
  }
  
  public build(config: GameConfig): GameRuntime {
    // ... logic to create runtime with registered systems
  }
}

// Example usage by a consumer
const runtime = new GameBuilder()
  .use(CoreSystemsPlugin)
  .use(CombatPlugin) // Adds MeleeSystem, PlayerWeaponSystem
  .use(PowerupsPlugin) // Adds PowerupSystem
  .build(gameConfig);

```




<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: This is a critical architectural suggestion that correctly identifies a loss of modularity by replacing the flexible `SystemFactory` with the hardcoded `createAllSystems`, which has significant implications for the engine's extensibility and bundle size.

**ENGINEER'S RESPONSE:**

This system is part of a game creator/editor and we want to enable all systems by default. In the future we may be able to detect which systems are needed based on the traits of the entities in the game, but for now this is not the case.


</details></details></td><td align=center>High

</td></tr><tr><td rowspan=6>Possible issue</td>
<td>



<details><summary>Implement buff expiration cleanup logic</summary>

___

**Implement the <code>onBuffExpired</code> method to correctly remove shield points and max <br>shield when a temporary shield buff expires.**

[packages/spartan/systems/powerup.system.ts [350-358]](https://github.com/neurofuzzy/linkedgrid/pull/29/files#diff-fb4c4b470e779889ed9dde1c4ebcbd2a616c00235e06baf13cee3bca4f410804R350-R358)

```diff
-private onBuffExpired(_entity: EntityData, _buff: Buff): void {
-  // Shield buffs: Could reduce maxShield back to base
-  // Speed buffs: Movement system checks active buffs each tick
-  // Damage buffs: Combat systems check active buffs each tick
-  // Invincibility: HealthSystem checks for invincibility buff before applying damage
-
-  // For now, just removing the buff is sufficient.
-  // The other systems check for active buffs each tick.
+private onBuffExpired(entity: EntityData, buff: Buff): void {
+  if (buff.type === 'shield') {
+    if (hasShield(entity)) {
+      // Reduce shield and maxShield by the buff's magnitude
+      entity.shield = Math.max(0, entity.shield - buff.magnitude);
+      entity.maxShield = Math.max(0, entity.maxShield - buff.magnitude);
+    }
+  }
+  // Other buff types like speed, damage, and invincibility are handled by
+  // other systems checking for active buffs each tick, so no specific
+  // cleanup is needed here for them.
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a critical bug where temporary shield buffs effectively become permanent because their effects are not reversed upon expiration. Implementing this logic is essential for the powerup system to function as intended.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Correct system execution order for projectiles</summary>

___

**Reorder the system execution in <code>createAllSystems</code> to run <code>TurretSystem</code> before <br><code>ProjectileSystem</code>. This ensures projectiles fired by turrets move in the same <br>tick they are created, eliminating a one-tick delay.**

[packages/spartan/core/system-registry.ts [103-112]](https://github.com/neurofuzzy/linkedgrid/pull/29/files#diff-56171b0797855c9e6ae4bc2ca6dca047a438b11dd7b041e3f2d8867548e3893cR103-R112)

```diff
 // === SYSTEMS NEEDING HEALTHSYSTEM ===
 const projectileSystem = new ProjectileSystem(healthSystem);
 const powerupSystem = new PowerupSystem({ healthSystem });
-
-systems.push(projectileSystem);
-systems.push(powerupSystem);
 
 // === SYSTEMS NEEDING PROJECTILESYSTEM ===
 const turretSystem = new TurretSystem(healthSystem, projectileSystem);
 systems.push(turretSystem);
 
+systems.push(projectileSystem);
+systems.push(powerupSystem);
+
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=2 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identifies a subtle but important logic bug in the system execution order that would cause a one-tick delay for projectiles fired from turrets. Fixing this improves the game's real-time responsiveness and corrects a gameplay flaw.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Remove player entity on game over</summary>

___

**In <code>checkPlayerDeath</code>, remove the player entity from the game using <br><code>context.spatial.remove()</code> when the game is over.**

[packages/spartan/systems/respawn.system.ts [174-180]](https://github.com/neurofuzzy/linkedgrid/pull/29/files#diff-f8f0caef8303802cb67b57c52e95cf376032b9ed790ce06aa2d743c5213c9bc5R174-R180)

```diff
-if (this.debugStats.currentLives <= 0) {
+if (this.debugStats.currentLives < 0) { // Check for < 0 since we decrement first
   // Game over
   if (this.config.onGameOver) {
     this.config.onGameOver(context);
   }
+  // Remove the player entity from the game
+  context.spatial.remove(playerId);
   return;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=3 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly points out that the player entity is not removed on game over, which is a valid bug. However, the `HealthSystem` is responsible for removing dead entities, so this change might conflict with existing logic or be redundant.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Fix inconsistent type guard predicate</summary>

___

**Update the <code>hasCheckpoint</code> type predicate to include the optional <code>lastCheckpointId</code> <br>property, aligning it with the function's implementation and improving type <br>safety.**

[packages/spartan/traits/trait-guards.ts [1146-1156]](https://github.com/neurofuzzy/linkedgrid/pull/29/files#diff-e6fe0a27a19016994f4da0c6ee5948e9656ec928c82808ef97ff98ac52d8f5d8R1146-R1156)

```diff
 export function hasCheckpoint(
   entity: EntityData
-): entity is EntityData & { lastCheckpointSceneId?: string; lastCheckpointX?: number; lastCheckpointY?: number } {
+): entity is EntityData & { lastCheckpointId?: number; lastCheckpointSceneId?: string; lastCheckpointX?: number; lastCheckpointY?: number } {
   // The trait is optional properties, so we check if ANY checkpoint property exists
   return (
     'lastCheckpointId' in entity ||
     'lastCheckpointSceneId' in entity ||
     'lastCheckpointX' in entity ||
     'lastCheckpointY' in entity
   );
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: This suggestion correctly identifies that the type predicate for `hasCheckpoint` is inconsistent with its implementation, as it omits the `lastCheckpointId` property while the function body checks for it. Applying this change improves type safety and correctness.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Initialize missing ammo map</summary>

___

**In <code>applyAmmoPack</code>, add a check to initialize the <code>collectorData.ammo</code> object if it <br>is missing before attempting to access its properties.**

[packages/spartan/systems/powerup.system.ts [277-287]](https://github.com/neurofuzzy/linkedgrid/pull/29/files#diff-fb4c4b470e779889ed9dde1c4ebcbd2a616c00235e06baf13cee3bca4f410804R277-R287)

```diff
 private applyAmmoPack(collectorData: EntityData, weaponType: string, ammoAmount: number): boolean {
   if (!hasWeapon(collectorData)) return false;
 
+  // Ensure ammo map exists
+  if (!collectorData.ammo) {
+    (collectorData as any).ammo = {};
+  }
   // Initialize ammo for weapon type if not present
-  if (!collectorData.ammo[weaponType]) {
+  if (!(collectorData.ammo[weaponType] >= 0)) {
     collectorData.ammo[weaponType] = 0;
   }
 
   collectorData.ammo[weaponType] += ammoAmount;
   return true;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly identifies that `collectorData.ammo` might be undefined, which could cause a runtime error. Adding a check to initialize it improves the robustness of the `applyAmmoPack` method.


</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Use explicit undefined check</summary>

___

**Change the shield duration check from <code>!duration</code> to <code>duration === undefined</code> to <br>handle a potential duration of <code>0</code> correctly.**

[packages/spartan/systems/powerup.system.ts [204-205]](https://github.com/neurofuzzy/linkedgrid/pull/29/files#diff-fb4c4b470e779889ed9dde1c4ebcbd2a616c00235e06baf13cee3bca4f410804R204-R205)

```diff
-// Skip if already at max shield and no duration (permanent)
-if (!duration && shieldData.shield >= shieldData.maxShield) return false;
+// Skip if already at max shield and no explicit duration (permanent)
+if (duration === undefined && shieldData.shield >= shieldData.maxShield) return false;
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=6 -->


<details><summary>Suggestion importance[1-10]: 4</summary>

__

Why: The suggestion improves code clarity and robustness by using an explicit `duration === undefined` check. This prevents potential issues if a `duration` of `0` is ever used, which would be falsy and incorrectly treated as a permanent shield.


</details></details></td><td align=center>Low

</td></tr><tr><td rowspan=1>General</td>
<td>



<details><summary>Simplify temperature guard type</summary>

___

**Simplify the <code>hasTemperature</code> type guard by using the <code>HasTemperature</code> trait <br>directly instead of listing all specific entity types that implement it.**

[packages/spartan/traits/trait-guards.ts [295-297]](https://github.com/neurofuzzy/linkedgrid/pull/29/files#diff-e6fe0a27a19016994f4da0c6ee5948e9656ec928c82808ef97ff98ac52d8f5d8R295-R297)

```diff
 export function hasTemperature(
   entity: EntityData
-): entity is GrassData | GasolineData | FuseData | BarrelData | (DestructibleWallData & HasTemperature) {
+): entity is EntityData & HasTemperature {
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=7 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly proposes simplifying the type guard to `entity is EntityData & HasTemperature`, which is more generic and maintainable than listing every specific entity type that has temperature.


</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>

