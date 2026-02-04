# Push-Signal Integration Specification

This document defines the interaction between the `PushSystem` (handling entity movement) and the `SignalSystem` (handling signal propagation), specifically focusing on dynamic signal topology where conductive entities can be moved to bridge or break circuits.

## Core Integration Concept

**Pushable entities act as dynamic conductors.**

- When a conductive entity (e.g., `metal-crate`) is pushed, it changes the connectivity of the signal network.
- The `SignalSystem` must detect these topology changes and re-evaluate signal propagation.
- **Strict Separation**: `PushSystem` handles the *movement*. `SignalSystem` handles the *consequences* of that movement on the signal graph.

## Traits

### 1. `HasPushable`
- Defines an entity as movable by a pusher.
- Properties: `weight` (resistance to push).

### 2. `HasConductive` (Updated)
- Defines an entity as capable of conducting signals.
- **Update**: Must support generic conductors (like crates) that are simply `isConductive: true` without requiring a specific `conductiveType` string if not needed, or defaulting to 'generic'.
- **Trait Guard**: `hasConductive(entity)` must return true for any entity with `{ isConductive: true }` OR valid `{ conductiveType: ... }`.

## Dynamic Topology Handling

The `SignalSystem` assumes a static grid by default for performance. To support moving conductors, it needs to react to meaningful spatial changes.

### Triggering Re-evaluation

When a push occurs, the `SignalSystem` needs to know that the grid topology has changed.

1.  **Reactive Update (Current Plan)**:
    - `SignalSystem` runs every tick.
    - It iterates over *active generators* (Oscillators, Pressure Switches).
    - If a generator is ON, it attempts to propagate a signal BFS.
    - **Crucial**: If the topology changes (a crate moves into the path), the *next* tick's propagation from the generator will simply find the new path.
    - **No special "Topology Changed" event is strictly needed** if the generators re-emit or re-verify their path continuously.
    - *However*, purely event-based signals (only emit on state change) will fail if the topology changes while the state remains constant (e.g., constant ON signal).

### The "Constant Signal" Problem

If an oscillator is ON and stable, it might not emit a new signal event to save performance. If a crate is moved into the gap, the signal won't cross until the oscillator toggles.

**Solution: Continuous Propagation or Topology Versioning**

A. **Continuous Propagation for Constant Sources**: 
   - Generators that are ON must emit a signal pulse every tick, OR
   - Generators emit only on change, BUT `SignalSystem` monitors `SpatialSystem` moves.

B. **Topology Dirty Flag (Recommended)**:
   - `SignalSystem` listens to `SpatialSystem.onMove()`.
   - If a moving entity is `hasConductive`, mark the signal graph as "Dirty".
   - If "Dirty", force all active generators to re-emit their current state, even if it hasn't changed.

## Implementation Strategy

1.  **registerLifecycleHandlers()**:
    - existing: `onSpawn`, `onRemove`.
    - **NEW**: Listen to `onMove` (if available in `SpatialSystem` or derived from `GameContext`).
    - *Alternative*: In `update()`, check if any conductive entity has moved (via tracking positions or dirty flags).

2.  **Dirty Propagation**:
    - If a conductive entity moved, set `forceReemission = true`.
    - In `propagateFromGenerators`:
      ```typescript
      if (previousState !== currentState || this.forceReemission) {
          // Emit signal
      }
      ```

## Edge Cases

1.  **Pushing into a Powered Circuit**:
    - Crate moves into gap.
    - Next tick: Generator re-emits (due to dirty flag).
    - Signal traverses crate.
    - Gate receives signal.

2.  **Pushing out of a Powered Circuit**:
    - Crate moves out of gap.
    - Next tick: Generator re-emits.
    - BFS fails to cross gap.
    - Gate does *not* receive signal.
    - **Important**: Gate must auto-reset to OFF if no signal received? 
    - *Current Logic*: Receivers flip state only when receiving a NEW signal. If the signal stops coming, do they latch?
    - **Correction**: `SignalSystem` typically clears `receivedSignal` for pure conductors, but STEs (Gates) might latch. 
    - **Rule**: If a receiver does NOT receive a signal in a tick, does it default to OFF? 
    - *Spec Refinement*: `SignalSystem` needs a "decay" or "clear" phase for unpowered receivers, OR generators must emit "OFF" signals when they stop reaching a target.
    - *Actually*: The BFS marks visited cells. If a node is NOT visited by an ON signal, it effectively receives nothing.
    - *Fix*: If `forceReemission` sends an ON signal and it *fails* to reach the Gate, the Gate still holds its old `receivedSignal: true` state unless explicitly cleared.
    - **Requirement**: Receivers must degrade to `false` if not refreshed? Or do we rely on the generator sending an explicit `OFF` when it turns off?
    - If the path breaks, the generator is still ON. It sends an ON signal that dies at the gap. The Gate never hears "OFF".
    - **Solution**: Network "Activity" tracking.
      - Receivers reset to `false` at the start of tick? No, that causes flickering.
      - **Better**: Generators emit. If path blocked, event dies.
      - We need a mechanism to detecting "Loss of Signal".
      - **Proposed**: `SignalSystem` tracks which receivers were powered this tick. Any receiver that was powered *last* tick but *not this* tick (and has no pending signal) should transition to OFF?
      - Or simpler: Just rely on logical updates. If you break a wire, you must turn the generator OFF and ON again to "reset" the logic? No, that's bad UX.
      - **Refined Plan**: When the graph is dirty (move occurred), we effectively "reset" the conductive state of the affected region?
      - **Robust Solution**: 
        - Iterate all Receivers that are currently `receivedSignal: true`.
        - If they are NOT visited by an active HIGH signal this tick, they toggle to `false`.
        - *Constraint*: This requires continuous emission from ON generators.

## Summary of Changes

1.  **Update `SignalSystem`**:
    - Detect `onMove` of conductive entities.
    - If moved, force re-emission from all ON generators.
    - Implement "Signal Loss" logic: If a receiver expects power (was ON) but isn't visited by a HIGH signal `Activity Scan`, turned it OFF.

2.  **Update `hasConductive` Trait Guard**:
    - Already done. Allows `isConductive: true`.

3.  **Tests**:
    - Verify crate moving *into* path connects power.
    - Verify crate moving *out of* path disconnects power (auto-shutoff).
