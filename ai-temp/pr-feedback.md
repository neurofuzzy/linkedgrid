## PR Code Suggestions ✨

<!-- b8eb76a -->

Explore these optional code suggestions:



<details><summary>Refactor system dependency injection mechanism</summary>

___

**The current dependency injection in <code>scene-loader.ts</code> is brittle. It should be <br>refactored to use a more robust, declarative pattern or a simple IoC container <br>for managing system dependencies.**


### Examples:



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/23/files#diff-950f0a4080831ca6034793672a2302efb2c0fe3af1f13faaa883e7fe9890b4b5R89-R136">dev/scene-loader.ts [89-136]</a>
</summary>



```typescript
type SystemFactory = (
  gameManager: GameManager,
  systems: Map<string, GameSystem>
) => GameSystem;

/**
 * System registry for mapping string names to system constructors.
 * Add new systems here as they're implemented.
 *
 * The systems map allows dependent systems to access already-created systems.

 ... (clipped 38 lines)
```
</details>




### Solution Walkthrough:



#### Before:
```typescript
// dev/scene-loader.ts
const SYSTEM_REGISTRY = {
  // ...
  TurretSystem: (_gameManager, systems) => {
    let healthSystem = systems.get('HealthSystem');
    if (!healthSystem) {
      healthSystem = new HealthSystem();
      systems.set('HealthSystem', healthSystem);
    }
    let projectileSystem = systems.get('ProjectileSystem');
    if (!projectileSystem) {
      projectileSystem = new ProjectileSystem(healthSystem);
      systems.set('ProjectileSystem', projectileSystem);
    }
    return new TurretSystem(healthSystem, projectileSystem);
  },
};

// ... in SceneLoader.load
const createdSystems = new Map();
for (const systemName of config.systems) {
  const factory = SYSTEM_REGISTRY[systemName];
  const system = factory(runtime.game, createdSystems);
  createdSystems.set(systemName, system);
  runtime.addSystem(system);
}

```



#### After:
```typescript
// A declarative dependency definition
const SYSTEM_DEFINITIONS = {
  HealthSystem: { create: () => new HealthSystem(), deps: [] },
  ProjectileSystem: { create: (health) => new ProjectileSystem(health), deps: ['HealthSystem'] },
  TurretSystem: { create: (health, proj) => new TurretSystem(health, proj), deps: ['HealthSystem', 'ProjectileSystem'] },
  // ... other systems
};

// A resolver function that builds the dependency graph
function resolveAndCreateSystems(systemNames: string[]) {
  const created = new Map();
  
  function createSystem(name) {
    if (created.has(name)) return created.get(name);
    
    const definition = SYSTEM_DEFINITIONS[name];
    const dependencies = definition.deps.map(depName => createSystem(depName));
    
    const system = definition.create(...dependencies);
    created.set(name, system);
    return system;
  }

  systemNames.forEach(name => createSystem(name));
  return created;
}

```




<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a significant architectural weakness in the new dependency injection mechanism, which is brittle and not scalable, making it a high-impact improvement for maintainability.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=2>Possible issue</td>
<td>



<details><summary>Add LOS check before firing</summary>

___

**Add a line-of-sight check to the <code>findNearestTarget</code> method to ensure turrets do <br>not target enemies through walls.**

[packages/spartan/systems/turret.system.ts [187-189]](https://github.com/neurofuzzy/linkedgrid/pull/23/files#diff-1bdd597f60fd1d12fe2b1d023eadc2fd4b1f501372262be04906ca1b102947deR187-R189)

```diff
 if (nearestId === null || nearestPos === null) return null;
+
+// Check line of sight
+const startCell = context.spatial.grid.cell(turretPos.x, turretPos.y);
+const targetCell = context.spatial.grid.cell(nearestPos.x, nearestPos.y);
+if (!startCell || !targetCell) return null;
+const line = LinkedCellUtils.getLine(startCell, targetCell);
+if (line.some(cell => context.spatial.isBlocked(cell))) return null;
 
 return { x: nearestPos.x, y: nearestPos.y, entityId: nearestId };
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This is a critical improvement to prevent turrets from firing at targets through walls, which fixes a significant flaw in the targeting logic.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Make game manager a required parameter</summary>

___

**Make the <code>gameManager</code> parameter required in the <code>GameLoop</code> constructor to enforce <br>its presence at compile time, as it is always provided and used without a null <br>check.**

[packages/spartan/core/game-loop.ts [30-33]](https://github.com/neurofuzzy/linkedgrid/pull/23/files#diff-3042bf78b8729c8df0b47cc175b03f7484b0289bcb4dc4f8f2ff1bf9a4b778dbR30-R33)

```diff
 constructor(
   private spatial: SpatialSystem,
-  private gameManager?: GameManager
+  private gameManager: GameManager
 ) { }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=2 -->


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: This suggestion correctly identifies that `gameManager` is always provided and improves type safety by making it a required parameter, preventing potential runtime errors and simplifying code.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=1>Security</td>
<td>



<details><summary>Prevent potential XSS in game description</summary>

___

**To prevent a potential Cross-Site Scripting (XSS) vulnerability, render the <br><code>gameDescription</code> by splitting it into lines and creating a separate element for <br>each, ensuring content is treated as text.**

[dev/playground.tsx [444-451]](https://github.com/neurofuzzy/linkedgrid/pull/23/files#diff-8b5cc67c6f801fec5a9635a2b22cd8721d47f6c6e0c7f3f09c8f0380783847f7R444-R451)

```diff
-<p style={{ 
-  whiteSpace: 'pre-line', 
+<div style={{ 
   color: '#b0b0b0', 
   lineHeight: '1.5',
   fontSize: '13px'
 }}>
-  {gameDescription}
-</p>
+  {gameDescription.split('\\n').map((line, index) => (
+    <div key={index}>{line}</div>
+  ))}
+</div>
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=3 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identifies a potential XSS vulnerability from rendering user-provided content as HTML and proposes a valid mitigation, which is a critical security improvement.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=1>General</td>
<td>



<details><summary>Allow armor to fully block damage</summary>

___

**Change the armor calculation to allow damage to be fully negated, by setting the <br>minimum damage to 0 instead of 1.**

[packages/spartan/systems/health.system.ts [190-193]](https://github.com/neurofuzzy/linkedgrid/pull/23/files#diff-7c3ff98821bcb4d02d1a5ad79c7109cda4acb787009ce81828a16f4c9e5dd01fR190-R193)

```diff
 // Apply armor (flat reduction)
 if ('armor' in entityData && typeof entityData.armor === 'number') {
-  damage = Math.max(1, damage - entityData.armor); // Minimum 1 damage
+  damage = Math.max(0, damage - entityData.armor);
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=4 -->


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: This is a valid suggestion for a gameplay logic change, allowing armor to fully negate damage, which could be a desirable behavior.

</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>

