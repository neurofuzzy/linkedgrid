## PR Code Suggestions ✨

<!-- 62c7b52 -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=5>Possible issue</td>
<td>



<details><summary>Avoid copying the source entity's ID</summary>

___

**When spawning a new chain link, avoid copying the source entity's <code>id</code> by <br>destructuring <code>sourceData</code> to exclude instance-specific properties before <br>spreading it into the new entity's data.**

[packages/spartan/systems/chain-reaction.system.ts [98-107]](https://github.com/neurofuzzy/linkedgrid/pull/17/files#diff-e32994d83480a9c5fb492db4114074f10369952975344200715a0ec7acc31353R98-R107)

```diff
+// eslint-disable-next-line @typescript-eslint/no-unused-vars
+const { id, type, ...propagationProps } = sourceData;
 const newId = context.spatial.spawn(
   sourceData.spreadType,
   neighbor.x,
   neighbor.y,
   sourceData.spreadLayer,
   {
-    ...sourceData, // Copy config
-    // Ensure we copy 'chain' specific props if we add them later
+    ...propagationProps, // Copy only config props
   }
 );
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 9</summary>

__

Why: This suggestion correctly identifies a critical bug where an existing entity's `id` is copied to a new entity, which would cause ID collisions and corrupt the entity store.

</details></details></td><td align=center>High

</td></tr><tr><td>



<details><summary>Fix order-dependent gas spread behavior</summary>

___

**Refactor <code>distributeDensity</code> to use a two-phase update pattern (calculate then <br>apply) to prevent order-dependent behavior in poison gas spreading.**

[packages/spartan/systems/poison.system.ts [411-517]](https://github.com/neurofuzzy/linkedgrid/pull/17/files#diff-f97c4cf7ddb6b7585867d07b5d808cc94b7d582b34680d1794b0ef5b0561d32fR411-R517)

```diff
     private distributeDensity(
       context: GameContext,
       sources: Map<number, Position>
     ): void {
+      const densityDeltas = new Map<number, number>();
+      const pendingSpawns = new Map<string, {
+        config: PoisonConfig;
+        density: number;
+        rootSourceId: number;
+        originX: number;
+        originY: number;
+      }>();
+    
       for (const [sourceId, pos] of sources) {
-        const sourceData = context.spatial.getEntityData(sourceId);
-...
-        // Apply changes
-  
-        // 1. Update source density
-        sourceData.density = newDensity;
-  
-        // 2. Spawn neighbors
+        const sourceData = context.spatial.getEntityData(sourceId) as PoisonConfig;
+        if (!sourceData || !hasPropagation(sourceData) || !hasDensity(sourceData)) continue;
+    
+        const state = this.spreadState.get(sourceId);
+        if (!state) continue;
+    
+        const ticksElapsed = this.currentTick - state.lastSpreadTick;
+        if (ticksElapsed < sourceData.spreadRate) continue;
+    
+        const cell = context.spatial.grid.cell(pos.x, pos.y);
+        if (!cell) continue;
+    
+        const availableNeighbors: LinkedCell[] = [];
+        // ... (find available neighbors as before)
+    
+        if (availableNeighbors.length === 0) continue;
+    
+        const totalParts = 1 + availableNeighbors.length;
+        const newDensity = sourceData.density / totalParts;
+    
+        if (newDensity < sourceData.minDensity) continue;
+    
+        // Phase 1: Calculate and store changes
+        const densityChange = newDensity - sourceData.density;
+        densityDeltas.set(sourceId, (densityDeltas.get(sourceId) || 0) + densityChange);
+    
         const rootSourceId = this.propagatedEntities.get(sourceId)?.sourceId ?? sourceId;
-  
+    
         for (const neighbor of availableNeighbors) {
-          const newEntityId = context.spatial.spawn(
-            sourceData.spreadType,
-            neighbor.x,
-            neighbor.y,
-            sourceData.spreadLayer,
-            {
-...
-            }
-          );
-...
+          const key = `${neighbor.x},${neighbor.y}`;
+          pendingSpawns.set(key, {
+            config: sourceData,
+            density: newDensity,
+            rootSourceId,
+            originX: state.originX,
+            originY: state.originY,
+          });
         }
-  
-        // Update timing
+    
         state.lastSpreadTick = this.currentTick;
+      }
+    
+      // Phase 2: Apply changes
+    
+      // Apply density changes to existing sources
+      for (const [id, delta] of densityDeltas) {
+        const data = context.spatial.getEntityData(id);
+        if (data && hasDensity(data)) {
+          data.density += delta;
+        }
+      }
+    
+      // Create new entities from pending spawns
+      for (const [key, spawn] of pendingSpawns) {
+        const [x, y] = key.split(',').map(Number);
+        if (context.spatial.getEntityIdAt(x, y, spawn.config.spreadLayer) !== undefined) continue;
+    
+        const newEntityId = context.spatial.spawn(
+          spawn.config.spreadType,
+          x, y,
+          spawn.config.spreadLayer,
+          {
+            // ... (copy properties from spawn.config)
+            density: spawn.density,
+            // ...
+          }
+        );
+    
+        const dist = this.manhattanDistance(spawn.originX, spawn.originY, x, y);
+        this.propagatedEntities.set(newEntityId, {
+          sourceId: spawn.rootSourceId,
+          distance: dist,
+          spawnTick: this.currentTick,
+        });
       }
     }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a potential order-dependency bug in the new `PoisonSystem` and proposes a robust two-phase update pattern, which is already used in the new `LiquidSystem`, to ensure deterministic behavior.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Fix order-dependent fire spread calculation</summary>

___

**Refactor <code>spreadFire</code> to use a two-phase update pattern, calculating all <br>temperature changes before applying them, to fix order-dependent behavior.**

[packages/spartan/systems/fire.system.ts [84-120]](https://github.com/neurofuzzy/linkedgrid/pull/17/files#diff-ef6e493bced29e6d1f784f7cc2911e51d0b6b745e2c397c2cc5f7c09aa92f540R84-R120)

```diff
     private spreadFire(context: GameContext): void {
-      const posMap = new Map<number, { x: number; y: number; layer: number }>();
-      for (const [entityId, pos] of context.spatial.getAllPositions()) {
-        if (this.burningEntities.has(entityId)) {
-          posMap.set(entityId, pos);
-        }
-      }
+      const temperatureDeltas = new Map<number, number>();
     
       for (const entityId of this.burningEntities.keys()) {
         if (!context.spatial.isAlive(entityId)) continue;
     
-        const pos = posMap.get(entityId);
-...
+        const pos = context.spatial.getPosition(entityId);
+        if (!pos) continue;
+    
+        const cell = context.spatial.grid.cell(pos.x, pos.y);
+        if (!cell) continue;
+    
         for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
           const neighbor = cell.neighbor(dir);
           if (!neighbor) continue;
     
           const layers = [GameLayers.FLOOR, GameLayers.COLLECTIBLES, GameLayers.WALLS, GameLayers.ACTORS];
           for (const layer of layers) {
             const neighborId = context.spatial.getEntityIdAt(neighbor.x, neighbor.y, layer);
             if (neighborId === undefined) continue;
     
             const neighborData = context.spatial.getEntityData(neighborId);
             if (!neighborData || !hasTemperature(neighborData)) continue;
     
-            neighborData.temperature = Math.min(
-              neighborData.temperature + this.TEMPERATURE_INCREASE,
-              neighborData.flamePoint + 100
-            );
+            // Store the intended temperature increase in a temporary map
+            const currentDelta = temperatureDeltas.get(neighborId) || 0;
+            temperatureDeltas.set(neighborId, currentDelta + this.TEMPERATURE_INCREASE);
           }
+        }
+      }
+    
+      // Apply all calculated temperature changes at once
+      for (const [entityId, delta] of temperatureDeltas.entries()) {
+        const entityData = context.spatial.getEntityData(entityId);
+        if (entityData && hasTemperature(entityData)) {
+          entityData.temperature = Math.min(
+            entityData.temperature + delta,
+            entityData.flamePoint + 100
+          );
         }
       }
     }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a potential order-dependency bug in the new `FireSystem`'s `spreadFire` method and proposes a two-phase update to ensure heat transfer is calculated deterministically.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Prevent overwriting liquid properties during spread</summary>

___

**Fix a bug in <code>LiquidSystem</code> where <code>pendingSpawns</code> overwrites liquid properties by <br>only setting the template on the first contribution and accumulating the amount <br>for subsequent ones.**

[packages/spartan/systems/liquid.system.ts [161-172]](https://github.com/neurofuzzy/linkedgrid/pull/17/files#diff-65be78f11d127e30fcddf29ef5acc67a8f82b85fbc6c8c5c65133594575f88edR161-R172)

```diff
     // Track new spawns: Map<"x,y", { amount: number, template: LiquidConfig, originX: number, originY: number }>
     const pendingSpawns = new Map<string, {
       amount: number;
       template: LiquidConfig;
       originX: number;
       originY: number;
     }>();
 ...
           if (recipient.entityId !== undefined) {
             const theirDelta = depthDeltas.get(recipient.entityId) || 0;
             depthDeltas.set(recipient.entityId, theirDelta + transfer);
           } else {
             // Spawn new
             const key = `${recipient.cell.x},${recipient.cell.y}`;
-            const pending = pendingSpawns.get(key) || {
-              amount: 0,
-              template: entityData as unknown as LiquidConfig,
-              originX: state.originX,
-              originY: state.originY
-            };
-            pending.amount += transfer;
-            pending.template = entityData as unknown as LiquidConfig;
-            pendingSpawns.set(key, pending);
+            const pending = pendingSpawns.get(key);
+            if (pending) {
+              // If a spawn is already pending, just add to its amount
+              pending.amount += transfer;
+            } else {
+              // Otherwise, create a new pending spawn
+              pendingSpawns.set(key, {
+                amount: transfer,
+                template: entityData as unknown as LiquidConfig,
+                originX: state.originX,
+                originY: state.originY
+              });
+            }
           }
 ...
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies a bug where liquid properties could be overwritten when multiple sources flow into the same cell, leading to incorrect simulation behavior. The fix ensures the properties of the first liquid are preserved.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Return a copy of the buffer</summary>

___

**Modify the <code>directionBuffer</code> getter to return a shallow copy of the <br><code>directionBufferInternal</code> array, preventing external code from directly mutating <br>the internal state.**

[packages/spartan/input/input-manager.ts [1087-1089]](https://github.com/neurofuzzy/linkedgrid/pull/17/files#diff-a9fe8e6be6e1d0bfe0b5436d8869e8e41545aab9945ea4373d918ff31d5941cdR1087-R1089)

```diff
-get directionBuffer(): Direction[] {
-  return this.directionBufferInternal;
+get directionBuffer(): readonly Direction[] {
+  return [...this.directionBufferInternal];
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly identifies a break in encapsulation by returning a direct reference to an internal array, which could lead to hard-to-trace bugs.

</details></details></td><td align=center>Low

</td></tr><tr><td rowspan=5>General</td>
<td>



<details><summary>Remove broad index signature for typesafety</summary>

___

**Remove the broad index signature from the <code>BaseEntityData</code> interface to enforce <br>strict type-checking for entities, aligning with the new architecture.**

[packages/spartan/entities/base.entity.ts [1-7]](https://github.com/neurofuzzy/linkedgrid/pull/17/files#diff-9580ed0a80a459107328a5ee8c93f9f322d57303bda12d2b6675f1e40ff3368aR1-R7)

```diff
 export interface BaseEntityData {
   id: number;
   type: string;
   sceneId: string;
-  // Allow primitives, arrays, and objects for flexible entity data
-  [key: string]: string | number | boolean | undefined | unknown[] | Record<string, unknown>;
+  // Allow flexible entity data through extension, not index signatures.
+  // [key: string]: string | number | boolean | undefined | unknown[] | Record<string, unknown>;
 }
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=5 -->


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identifies that the index signature in `BaseEntityData` undermines the new type-safe entity system proposed in `adr-entity-type-safety.md`, and removing it is crucial for enforcing the new architecture.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Iterate over scene entities for efficiency</summary>

___

**Refactor <code>updateTeleporterStates</code> to iterate over entities in the current scene <br>using <code>spatial.getAllPositions()</code> instead of all game entities for better <br>performance.**

[packages/spartan/systems/teleporter.system.ts [126-144]](https://github.com/neurofuzzy/linkedgrid/pull/17/files#diff-164c077ec0d64d7e1f5fd9e145f9ef17c1dfe54f1b0b70adc6fe17c1935a122eR126-R144)

```diff
-const allEntityIds = this.gameManager.gameState.entityStore.getAllIds();
-for (const entityId of allEntityIds) {
+for (const [entityId, padPos] of spatial.getAllPositions()) {
   const entity = this.gameManager.gameState.entityStore.getData(entityId);
 
-  if (!entity || !isTeleporter(entity)) continue;
+  if (!entity || !isTeleporter(entity) || entity.teleporterState !== 'inactive') {
+    continue;
+  }
 
-  if (entity.teleporterState !== 'inactive') continue;
-
-  if (entity.sceneId === playerSceneId) {
-    const padPos = spatial.getEntityPosition(entityId);
-    if (padPos) {
-      if (padPos.x !== playerPos.x || padPos.y !== playerPos.y) {
-        this.gameManager.gameState.entityStore.setData(entityId, {
-          teleporterState: 'ready',
-        });
-      }
-    }
+  // Since we are iterating entities in the current scene, we don't need to check sceneId.
+  // We just need to check if the player is not on top of this teleporter.
+  if (padPos.x !== playerPos.x || padPos.y !== playerPos.y) {
+    this.gameManager.gameState.entityStore.setData(entityId, {
+      teleporterState: 'ready',
+    });
   }
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion provides a significant performance improvement by iterating over entities in the current scene instead of all entities in the game, which is a more efficient approach.

</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>Remove internal timing from entity data</summary>

___

**Remove the <code>lastSpreadTick</code> property from the data payload when spawning new <br>liquid entities, as it is internal system state.**

[packages/spartan/systems/liquid.system.ts [204-219]](https://github.com/neurofuzzy/linkedgrid/pull/17/files#diff-65be78f11d127e30fcddf29ef5acc67a8f82b85fbc6c8c5c65133594575f88edR204-R219)

```diff
 // Spawn new entities
 for (const [key, spawn] of pendingSpawns.entries()) {
   const [x, y] = key.split(',').map(Number);
   // ...
   const id = context.spatial.spawn(
     spawn.template.spreadType,
     x, y,
     spawn.template.spreadLayer,
     {
       ...spawn.template,
       // Copy flammability if present
       ...(spawn.template.flammable !== undefined && {
         flammable: spawn.template.flammable,
         flamePoint: spawn.template.flamePoint,
         temperature: spawn.template.temperature
       }),
       depth: spawn.amount,
-      lastSpreadTick: this.currentTick,
     }
   );
   // ...
 }
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: The suggestion correctly points out that `lastSpreadTick` is internal system state and should not be part of the entity's data payload, improving data separation and system encapsulation.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Allow extra deserialize fields</summary>

___

**Add an index signature to the <code>deserialize</code> method's data parameter to allow for <br>extra fields, improving forward compatibility.**

[packages/spartan/core/game-state.ts [200-212]](https://github.com/neurofuzzy/linkedgrid/pull/17/files#diff-cf64b1ff403ff4c31e68ce7bd531deffb009c63e0cd69afd9664eabe62ac3974R200-R212)

```diff
 static deserialize(data: {
   playerEntityId?: number;
   lives?: number;
   score?: number;
   inventory?: Array<[string, number]>;
   buffs?: Array<[string, number]>;
   upgrades?: string[];
   flags?: Array<[string, boolean]>;
   data?: Array<[string, unknown]>;
   connections?: Array<[string, Array<{ sceneId: string; x: number; y: number; layer: number }>]>;
   nextEntityId?: number;
   entities?: Array<{ id: number; type: string; [key: string]: unknown }>;
+  [key: string]: unknown;
 }): GameState {
```


- [ ] **Apply / Chat** <!-- /improve --apply_suggestion=8 -->


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: The suggestion correctly points out that adding an index signature to the `deserialize` method's data parameter improves forward compatibility, which is a valid design consideration for a data serialization boundary.

</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>Simplify entity properties construction logic</summary>

___

**Refactor the <code>entityProps</code> creation to use a more concise object spread syntax for <br>conditionally adding the <code>sceneId</code>.**

[packages/spartan/test/test-fixtures.ts [50-53]](https://github.com/neurofuzzy/linkedgrid/pull/17/files#diff-a0f44117c2cae4076c69a369fefa3e219b727c1ee57ea056911de5c0f051f0c8R50-R53)

```diff
-const entityProps = this.sceneId
-  ? { ...props, sceneId: this.sceneId }
-  : props ?? undefined;
-const id = this.spatial.spawn(type, x, y, layer, entityProps as Record<string, unknown> | undefined);
+const entityProps = { ...props, ...(this.sceneId && { sceneId: this.sceneId }) };
+const id = this.spatial.spawn(type, x, y, layer, entityProps as Record<string, unknown>);
```



`[To ensure code accuracy, apply this suggestion manually]`


<details><summary>Suggestion importance[1-10]: 4</summary>

__

Why: The suggestion provides a more concise and idiomatic way to construct the `entityProps` object by using object spreading with a conditional expression.

</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

- [ ] Update <!-- /improve_multi --more_suggestions=true -->

</td><td></td></tr></tbody></table>
