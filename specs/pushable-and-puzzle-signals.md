USER PROMPT:
> examine legacy `etc/legacy-code/systems/level-mechanics/push-system.ts` and `etc/legacy-code/components/level-mechanics/pushable.ts` and come up with a plan to port this to Spartan. This will work in tandem with the Signal System to allow us puzzle mechanics. For instance, being able to push pushable items like crates onto pressure plates or to push signal-compatible objects like power cells onto gaps into conductors 
<

---
ORIGINAL PLAN: 
# Port Push System to Spartan (Intent-Based, Single Block, Pure Decoupled)

This plan implements a single-block push mechanic using Spartan's pending operation inspection pattern. This achieves pure decoupling: `PlayerInputSystem` remains unaware of pushing instructions.

## User Review Required

> [!NOTE]
> **Pure Decoupling Strategy**
> 
> - **PlayerInputSystem** will NOT be modified. It simply stages a move to the `SpatialSystem`.
> - **PushSystem** will inspect these pending move operations.
> - If a entity with `HasPusher` moves into a `HasPushable` entity, the system reactively stages a move for the `HasPushable` entity.
> - **SpatialSystem**'s commit logic handles the atomic resolution of both moves.

## Proposed Changes

### Spartan Package

#### [NEW] `pushable.trait.ts`
- **HasPushable**: 
  - `isPushable` (boolean)
  - `weight` (number)
- **HasPusher**: 
  - `pushStrength` (number)

#### [MODIFY] `entity.types.ts`
- Update `EntityData` union to include `HasPushable` and `HasPusher`.

#### [MODIFY] `trait-guards.ts`
- Add type guards: `hasPushable(entity)`, `hasPusher(entity)`.

#### [NEW] `push.system.ts`
Create `PushSystem` extending `BaseTickedSystem` (or `BaseReactiveSystem`).
- **Phase**: `main` (configured in `systems.config.ts` to run *after* Input but *before* Spatial/Movement commit).
- **Execution Logic**:
  1. Inspect `context.spatial.getPendingOps()`.
  2. Filter for operations with `type === 'move'`.
  3. For each move operation:
     - Check if the moving entity has `HasPusher` trait.
     - Check if the destination cell contains an entity with `HasPushable` trait.
     - Check if the cell *behind* the pushable entity is valid and empty (no collision).
  4. If valid:
     - `context.spatial.move(pushableId, behindX, behindY)` (Stage the crate's move).
  5. `SpatialSystem.commit()` will subsequently process both the Player's move (into the crate's old spot) and the Crate's move (into the empty spot) atomically.

#### [MODIFY] `signal.system.ts`
- Implement `onEntitySpawn` and `onEntityRemove` lifecycle hooks.
- Maintain a private set of tracked entities: `signalEntities: Set<number>`.
- Update `getSignalEntitiesAtCell` to check `GameLayers.ACTORS`.
  - This is now safe and efficient because we check against the `signalEntities` set first, avoiding iteration over all generic actors.
- Update propagation logic (BFS) to iterate mainly through known signal entities or valid grid neighbors.

#### [MODIFY] `systems.config.ts`
- Register `PushSystem` with `executionPhase: 'main'`.

## Verification Plan

### Automated Tests
1.  **Push Mechanics**: 
    - Setup: Player at (0,0), Crate at (1,0), Empty at (2,0).
    - Action: Player moves East.
    - Expect: Player at (1,0), Crate at (2,0).
2.  **Blocked Push**: 
    - Setup: Player at (0,0), Crate at (1,0), Wall at (2,0).
    - Action: Player moves East.
    - Expect: Player stays at (0,0), Crate stays at (1,0). (Move failed).
3.  **Signal Integration**: 
    - Setup: Circuit with gap. Crate (Conductive) pushable.
    - Action: Push Crate into gap.
    - Expect: Signal propagates through crate.

### Manual Verification
- Test in visual playground or game demo to ensure smooth movement and correct interaction.
