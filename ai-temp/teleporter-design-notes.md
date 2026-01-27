# Teleporter Design Notes

## Current Implementation (Scene Tests)

Teleporters in the current scene transition tests are **instant** - they trigger the scene transition immediately when the player position overlaps with the teleporter pad.

## Desired Behavior

For a polished game feel, teleporters should have more nuanced behavior:

### 1. Delayed Activation (1-tick delay)

**Problem**: Instant teleportation feels jarring and can be confusing for the player.

**Solution**: When player overlaps with a teleporter pad, wait 1 tick (one frame/turn) before triggering the teleport.

**Implementation Requirements**:
- Requires a **timed action system** or **event bus**
- On overlap detection:
  1. Set a flag: `teleporter.primed = true`
  2. Schedule teleport action for next tick
  3. If player moves off before next tick, cancel the teleport

**Benefits**:
- Gives visual feedback time (animation, particle effects)
- Allows player to back out if they changed their mind
- Feels more intentional and less accidental

### 2. Two-Way with Reset Mechanism

**Behavior**:
- Teleporters work in both directions (A ↔ B)
- After teleporting, the teleporter is **inactive** until the player steps off the destination pad
- This prevents immediate bounce-back

**Implementation Requirements**:
- Track teleporter state per scene: `inactive | ready | primed`
- On successful teleport:
  1. Mark destination teleporter as `inactive`
  2. When player moves away from destination pad: `inactive → ready`
  3. When player overlaps ready pad: `ready → primed`
  4. After 1-tick delay: trigger teleport

**State Diagram**:
```
ready → (player overlaps) → primed → (1 tick) → TELEPORT
  ↑                                                  ↓
  └─────── (player steps off) ←─── inactive ←───────┘
```

## Implementation Path

### Phase 1: Event Bus Foundation
Create a lightweight event system for spatial operations:
- `EventBus` class with `on()`, `emit()`, `off()`
- Events: `entity.moved`, `entity.spawned`, `entity.removed`, `overlap.detected`
- SpatialSystem emits events during commit phase

### Phase 2: Timed Action System
Add action scheduling to GameManager:
- `GameManager.scheduleAction(ticksDelay, callback)`
- Tick counter increments on player actions
- Execute scheduled actions at appropriate tick

### Phase 3: Teleporter State Machine
- Teleporter component with state tracking
- Listen for overlap events
- Schedule delayed teleport
- Track cooldown state

## Current Workaround (Scene Tests)

For now, scene transition tests use **instant teleportation** via `GameManager.movePlayerToScene()`. This is fine for testing but wouldn't be used in actual gameplay. In a real game, the movement system would detect overlap with the teleporter entity, and a teleporter system would handle the delayed activation.

## Example Pseudocode (Future Implementation)

```typescript
class TeleporterSystem {
  private state = new Map<string, TeleporterState>();
  
  onOverlap(entity: Entity, teleporter: Entity) {
    const state = this.state.get(teleporter.id);
    if (state === 'ready') {
      this.state.set(teleporter.id, 'primed');
      this.gameManager.scheduleAction(1, () => {
        this.teleport(entity, teleporter);
      });
    }
  }
  
  onLeave(entity: Entity, teleporter: Entity) {
    const state = this.state.get(teleporter.id);
    if (state === 'primed') {
      // Cancel scheduled teleport
    } else if (state === 'inactive' && entity.type === 'player') {
      this.state.set(teleporter.id, 'ready'); // Re-enable
    }
  }
  
  private teleport(entity: Entity, teleporter: Entity) {
    const destination = teleporter.data.destination;
    this.gameManager.movePlayerToScene(
      destination.sceneId,
      destination.x,
      destination.y,
      destination.layer
    );
    // Mark destination pad as inactive
    const destTeleporter = this.findTeleporterAt(destination);
    this.state.set(destTeleporter.id, 'inactive');
  }
}
```

## Related Systems to Consider

- **Animation system**: Show teleport particles/effects during 1-tick delay
- **Sound system**: Play teleporter activation sound
- **UI system**: Show teleport prompt ("Press Up to enter")
- **Save system**: Persist teleporter states in save data
