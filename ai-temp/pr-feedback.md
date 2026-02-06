## PR Code Suggestions ✨

<!-- 3f8c9f1 -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=4>Possible issue</td>
<td>



<details><summary>Update melee cooldown timestamp</summary>

___

**Update the <code>lastMeleeAttackTick</code> for an entity after a melee attack to ensure the <br>cooldown is correctly applied.**

[packages/spartan/systems/npc-brain.system.ts [266-280]](https://github.com/neurofuzzy/linkedgrid/pull/34/files#diff-90ba23cc987b2a1564c41881f7e237b59b26af581f4b9819584b15bbc02cf75eR266-R280)

```diff
-private fireMeleeAttack(
-  entityData: EntityData & HasMelee,
-  pos: { x: number; y: number },
-  target: { x: number; y: number },
-  currentTick: number
-): void {
-  // Respect melee cooldown
-  const lastAttack = entityData.lastMeleeAttackTick ?? -Infinity;
-  if (currentTick - lastAttack < entityData.meleeCooldown) return;
-
-  const dir = this.directionToTarget(pos.x, pos.y, target.x, target.y);
-  if (dir !== Direction.NONE) {
-    entityData.meleeDirection = dir;
-  }
+if (dir !== Direction.NONE) {
+  entityData.meleeDirection = dir;
+  entityData.lastMeleeAttackTick = currentTick;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=0 -->


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: This is a critical bug fix; without updating `lastMeleeAttackTick`, the melee cooldown is not enforced, allowing NPCs to attack on every tick.

</details></details></td><td align=center>High

</td></tr><tr><td>



<details><summary>Fix incorrect wave completion logic</summary>

___

**Modify <code>areAllWavesCleared</code> to return <code>true</code> when no wave-mode spawner groups are <br>present, as this correctly reflects that there are no pending waves to clear.**

[packages/spartan/systems/spawning.system.ts [691-706]](https://github.com/neurofuzzy/linkedgrid/pull/34/files#diff-fca9143263971bfbe1d67252465712c68c39ece8c103eaaea1ec3e3ab7c4391eR691-R706)

```diff
 areAllWavesCleared(): boolean {
-  let hasWaveGroups = false;
+  const waveGroups = [...this.groups.values()].filter(g => g.waveMode);
 
-  for (const group of this.groups.values()) {
-    if (!group.waveMode) continue;
-    hasWaveGroups = true;
+  if (waveGroups.length === 0) {
+    return true; // No wave groups, so waves are considered cleared.
+  }
 
+  for (const group of waveGroups) {
     // All waves must be spawned
     if (!group.wavesComplete) return false;
 
     // All spawned entities must be dead/removed
     if (group.spawnedEntityIds.length > 0) return false;
   }
 
-  return hasWaveGroups;
+  return true;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=1 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a logic bug where `areAllWavesCleared` returns `false` if no wave groups exist, which would incorrectly block wave-clear objectives from completing.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Fix item to grant health</summary>

___

**Change the <code>coin</code> entity in the boss room to a <code>health-pack</code> entity to match its <br>intended function as a health pickup.**

[dev/games/npc-dungeon-demo.json [307-308]](https://github.com/neurofuzzy/linkedgrid/pull/34/files#diff-a638030483460c52f0842faac34a4deaea95dbfb5fefee58c30915d5ffb9da8eR307-R308)

```diff
 { "_comment": "=== Health pickup ===" },
-{ "type": "coin", "x": 7, "y": 7, "layer": 4, "data": { "scoreValue": 50, "collectibleId": "coin", "color": "#ffd700" } }
+{ "type": "health-pack", "x": 7, "y": 7, "layer": 4, "data": { "healAmount": 50, "collectibleId": "health", "color": "#00ff00" } }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies a functional bug in the new demo file where an entity commented as a "Health pickup" is implemented as a `coin`, which does not match the intended gameplay.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Rename spawner LOS property</summary>

___

**Rename the spawner's <code>requiresLineOfSight</code> property to <code>requiresLOS</code> to be <br>consistent with the <code>range-sensor</code> entity.**

[dev/games/range-sensor-demo.json [148-173]](https://github.com/neurofuzzy/linkedgrid/pull/34/files#diff-2137aa80fe2408fc62ac5d07248548f0a09ae4b42192da33df120d1128dfda15R148-R173)

```diff
 {
   "type": "spawner",
   "x": 8,
   "y": 10,
   "layer": 5,
   "data": {
     "spawnType": "enemy",
     "spawnLimit": 2,
     "cooldown": 15,
     "activationRange": 10,
     "spawnLayer": 6,
-    "requiresLineOfSight": false,
+    "requiresLOS": false,
     …
   }
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: This suggestion correctly identifies an inconsistency between the `requiresLineOfSight` property in spawners and the `requiresLOS` property in sensors, and improving this would enhance code maintainability.


</details></details></td><td align=center>Low

</td></tr><tr><td rowspan=1>High-level</td>
<td>



<details><summary>Formalize the new AI system hierarchy</summary>

___

**The new <code>NPCBrainSystem</code> introduces a "controller/executor" architectural pattern <br>by dictating behavior for other systems like <code>NPCMovementSystem</code>. This implicit <br>hierarchy should be explicitly documented to ensure future AI systems follow <br>this design for consistency.**


### Examples:



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/34/files#diff-90ba23cc987b2a1564c41881f7e237b59b26af581f4b9819584b15bbc02cf75eR185-R232">packages/spartan/systems/npc-brain.system.ts [185-232]</a>
</summary>



```typescript
  private applyPostureToMovement(
    entityData: EntityData & HasNPCBrain,
    posture: NPCPosture,
    target: { entityId: number; distance: number } | null
  ): void {
    if (!hasNPCMovement(entityData)) return;
    const movData = entityData as EntityData & HasNPCMovement & HasNPCBrain;

    // Save original movement mode on first brain engagement
    if (posture !== 'idle' && !movData.baseMovementModeBeforeBrain) {

 ... (clipped 38 lines)
```
</details>



<details>
<summary>
<a href="https://github.com/neurofuzzy/linkedgrid/pull/34/files#diff-56171b0797855c9e6ae4bc2ca6dca047a438b11dd7b041e3f2d8867548e3893cR120-R123">packages/spartan/core/system-registry.ts [120-123]</a>
</summary>



```typescript
  // Insert NPCBrainSystem before NPCMovementSystem so brain decisions
  // are available for movement in the same tick.
  const npcMovementIndex = systems.indexOf(npcMovementSystem);
  systems.splice(npcMovementIndex, 0, npcBrainSystem);
```
</details>




### Solution Walkthrough:



#### Before:
```typescript
// In NPCBrainSystem.ts
// The brain system decides the posture and sets movement intent.
class NPCBrainSystem {
  processNPC(entityData, target) {
    // ... logic to decide posture ...
    const posture = this.evaluatePosture(entityData, target);
    
    // Overrides movement properties that NPCMovementSystem will use
    if (posture === 'aggressive') {
      entityData.movementMode = 'pursue';
      entityData.targetEntityId = target.entityId;
    }
    // ... other postures
  }
}

// In NPCMovementSystem (implied)
// The movement system blindly executes the intent set by the brain.

```



#### After:
```typescript
/**
 * @architecture AI Controller/Executor Pattern
 * 
 * The AI architecture follows a Controller/Executor pattern.
 * High-level "Brain" systems (e.g., NPCBrainSystem) act as controllers.
 * They are responsible for decision-making and setting "intent" properties
 * on an entity's data component (e.g., `movementMode`, `meleeDirection`).
 * 
 * Low-level "Executor" systems (e.g., NPCMovementSystem, MeleeSystem)
 * are responsible for acting on these intents without making decisions
 * themselves. They are "dumb" executors of the brain's commands.
 * 
 * This separation ensures complex AI logic is centralized.
 */
class NPCBrainSystem {
  // ... same as before
}

```




<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identifies a significant new architectural pattern and proposes documenting it, which improves long-term maintainability and design consistency.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=2>General</td>
<td>



<details><summary>Include posture in NPC detection</summary>

___

**Expand the <code>hasNPCBrain</code> type guard to include checks for <code>posture</code> and other <br>configuration fields to ensure all relevant entities are correctly identified.**

[packages/spartan/traits/trait-guards.ts [1384-1386]](https://github.com/neurofuzzy/linkedgrid/pull/34/files#diff-e6fe0a27a19016994f4da0c6ee5948e9656ec928c82808ef97ff98ac52d8f5d8R1384-R1386)

```diff
 export function hasNPCBrain(entity: EntityData): entity is EntityData & HasNPCBrain {
-  return 'threatRange' in entity || 'brainState' in entity || 'attackRange' in entity;
+  return 'posture' in entity || 'threatRange' in entity || 'attackRange' in entity || 'retreatHealthPct' in entity;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly points out that the `hasNPCBrain` guard is incomplete and could fail to identify entities with an NPC brain, improving the robustness of the type guard.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Increase NPC threat range for ranged</summary>

___

**Increase the NPC's <code>threatRange</code> to be greater than its <code>attackRange</code> to allow it to <br>effectively use its ranged preference.**

[dev/games/npc-paths.json [64-68]](https://github.com/neurofuzzy/linkedgrid/pull/34/files#diff-31f7645d7bd84caa8256e6599a96c8394b8056b58bf5c33a2af5080fc6609068R64-R68)

```diff
-"threatRange": 6,
+"threatRange": 10,
 "attackRange": 6,
 "posture": "aggressive",
 "preferRanged": true,
 "retreatHealthPct": 0.2,
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=6 -->


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly points out that for a ranged-preferring NPC, the `threatRange` should be greater than the `attackRange` to enable more intelligent AI behavior, improving the quality of the demo.


</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] More <!-- /improve --more_suggestions=true -->

</td><td></td></tr></tbody></table>
