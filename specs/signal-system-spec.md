# Signal System Specification

## Core Concept

**Signals are ephemeral events that bubble through conductive networks, not persistent state.**

- **Events** bubble instantly through conductors in a single tick
- **State** (receivedSignal, pendingSignal) persists on entities between ticks
- **Generators** create new events when their state changes
- **Conductors** propagate events instantly (no delay)
- **Receivers** introduce 1-tick delay, then become new event sources

## Entity Types

### Generators (Signal Sources)
Create new signal events when their state changes:
- **Oscillators**: Auto-toggle every N ticks
- **Pressure Switches**: Toggle based on actor presence
- **Inverters**: Emit inverted input signal

### Conductors (Instant Propagation)
Allow signals to bubble through instantly:
- **Conductive Floors**: Pure conductors (no delay)
- **Conductive Receivers**: Floors with receiver trait (still instant)
- **Emitters on Floors**: Oscillators/switches act as conductors

### Receivers (1-Tick Delay)
Stop propagation, then re-emit next tick:
- **Gates**: Block/allow movement based on signal
- **Inverters**: Both receiver and emitter
- **Transceivers**: Wireless relay with 1-tick delay

## Signal Flow

### Single Tick Cycle

```
Phase 1: Apply Pending
  ├─ Receivers with pendingSignal become powered
  ├─ Inverters flip their output state
  └─ If state changed, create new event and propagate

Phase 2: Update Generators
  ├─ Oscillators: Increment counters, toggle if period elapsed
  └─ Pressure Switches: Check actor presence, update based on mode

Phase 3: Create Events
  └─ Generators that changed state create new SignalEvent objects

Phase 4: Bubble Events
  ├─ BFS from event source through conductive network
  ├─ Pure conductors: Update receivedSignal instantly
  ├─ Receivers: Set pendingSignal (applied next tick)
  └─ Stop at receivers (they don't propagate further)

Phase 5: Transceivers
  ├─ Check which wireless channels are active
  ├─ Create events for powered transceivers
  └─ Propagate like regular events
```

## Signal Event Object

```typescript
class SignalEvent {
  readonly id: string;              // `${sourceId}-${tick}`
  readonly sourceId: number;        // Entity that created this event
  readonly tick: number;            // Tick when event was created
  readonly value: boolean;          // ON (true) or OFF (false)
  readonly visitedCells: Set<string>; // Cells this event has touched
}
```

**Properties:**
- Immutable (readonly fields)
- Unique per source per tick
- Each cell visited only once (prevents loops)
- Garbage collected when propagation completes

## Propagation Rules

### Pure Conductors (Instant)
```
hasConductive && !hasSignalReceiver  →  receivedSignal updated instantly
hasConductive && hasSignalReceiver   →  receivedSignal updated instantly
hasSignalEmitter (oscillator/pressure) →  signal flows through instantly
```

### Receivers (1-Tick Delay)
```
Tick N:   Signal arrives → pendingSignal = true
Tick N+1: pendingSignal applied → receivedSignal = true → new event created
```

### Blocking (No Propagation)
```
Gates, Inverters, Transceivers → Stop event propagation
Signal must wait for next tick to continue
```

## Example: Pressure Switch → Conductive Floor → Gate → Gate

```
Tick 0: Player steps on switch
  └─ Switch: signalState: false → true
  └─ Event created: SignalEvent(switch, 0, true)
  └─ Bubbles instantly through conductive floor
  └─ Gate A: pendingSignal = true (stops here)

Tick 1: Gate A applies pending
  └─ Gate A: receivedSignal = true
  └─ Event created: SignalEvent(gateA, 1, true)
  └─ Gate B: pendingSignal = true (stops here)

Tick 2: Gate B applies pending
  └─ Gate B: receivedSignal = true
  └─ Event created: SignalEvent(gateB, 2, true)
  └─ (continues to next receiver...)
```

## Key Design Decisions

### ✅ Why Events Are Ephemeral
- Prevents memory leaks (auto-GC'd after propagation)
- Clear ownership (one event per source per tick)
- Simplifies debugging (trace event back to source)

### ✅ Why Receivers Create New Events
- Natural 1-tick delay without complex state tracking
- Allows signal to propagate through chains of receivers
- Each receiver acts as a repeater with delay

### ✅ Why visitedCells Uses Set
- O(1) lookup to prevent revisiting cells
- Prevents infinite loops in complex networks
- Works with any network topology

### ✅ Why Conductors Update Instantly
- Visual feedback is immediate
- Matches player expectation (wires light up instantly)
- Only active components (gates, inverters) have delay

## State Management

### Entity State Fields
```typescript
// Generators
signalState: boolean           // Current output state

// Receivers  
receivedSignal: boolean        // Current input state (visual)
pendingSignal?: boolean        // Next tick's state (1-tick delay)

// Oscillators
oscillatorPeriod?: number      // Ticks per full cycle

// Pressure Switches
switchMode?: 'toggle' | 'hold' | 'latch' | 'inverted-latch'

// Transceivers
channel: string                // Wireless channel identifier
```

### System State
```typescript
oscillatorTicks: Map<number, number>          // Tick counters
pressureSwitchStates: Map<number, boolean>    // Was pressed last tick?
previousGeneratorStates: Map<number, boolean> // For change detection
channelStates: Map<string, boolean>           // Wireless channels
tickCount: number                              // Current tick
```

## Requirements Met

✅ **Signal is unique by source + tick**: `id = ${sourceId}-${tick}`

✅ **Signal affects each cell once**: `visitedCells: Set<string>`

✅ **Natural garbage collection**: Events dereferenced after propagation

✅ **Simple ON/OFF values**: `value: boolean`

✅ **Conductors propagate instantly**: BFS completes in single tick

## Testing Checklist

- [ ] Oscillator toggles gate every N ticks
- [ ] Pressure switch (toggle mode) flips on each press
- [ ] Pressure switch (hold mode) stays ON while pressed
- [ ] Pressure switch (latch mode) stays ON after first press
- [ ] Pressure switch (inverted-latch) stays OFF after first press
- [ ] Signal propagates through 10+ conductive floors instantly
- [ ] Signal propagates through chain of 5 gates with 1-tick delay each
- [ ] Inverter outputs opposite of input with 1-tick delay
- [ ] Transceiver relays signal wirelessly with 1-tick delay
- [ ] Multiple oscillators on same network don't interfere
- [ ] Circular networks don't cause infinite loops
- [ ] Gate opens when receiving ON signal (WALLS → FLOOR)
- [ ] Gate closes when receiving OFF signal (FLOOR → WALLS)
