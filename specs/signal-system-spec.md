# Signal System Specification

## Overview

The Signal System provides logic circuit simulation for puzzle mechanics. Signals propagate through conductive networks to control receivers like gates (barriers) and inverters (NOT gates).

**Key Design Principle**: Conductors propagate instantly. Active components introduce 1-tick delay.

---

## Timing Model

### Entity Classification

| Category | Entities | Timing | Mental Model |
|----------|----------|--------|--------------|
| **Conductor** | Conductive Floor | Instant | Wire (zero resistance) |
| **Source** | Oscillator, Pressure Switch | Instant emit | Signal generator |
| **Active Component** | Inverter, Transceiver | 1-tick delay | Logic gate (processing time) |
| **Receiver** | Gate | 1-tick delay | Actuator (mechanical delay) |

### Tick-by-Tick Behavior

```
Tick 0: Oscillator turns ON
        → Conductors light up instantly
        → Gate receives signal, becomes "pending"
        
Tick 1: Gate acts on pending signal
        → Opens (moves from WALLS to FLOOR layer)
```

**Result**: A chain of gates connected through conductors opens simultaneously. A chain connected through transceivers opens sequentially (cascading effect).

---

## Entity Types

### Signal Sources

#### Oscillator
Auto-toggles ON/OFF based on period.

| Property | Type | Description |
|----------|------|-------------|
| `signalType` | `'oscillator'` | Discriminator |
| `signalState` | `boolean` | Current output state |
| `oscillatorPeriod` | `number` | Full cycle in ticks (toggles at half-period) |

#### Pressure Switch
Toggles when an actor steps on it.

| Property | Type | Description |
|----------|------|-------------|
| `signalType` | `'pressure'` | Discriminator |
| `signalState` | `boolean` | Current output state |

### Wire / Conductive Elements

#### Conductive Floor
Carries signal between adjacent cells.

| Property | Type | Description |
|----------|------|-------------|
| `conductiveType` | `'floor'` | Discriminator |
| `receivedSignal` | `boolean` | Visual powered state |

### Active Components

#### Inverter (NOT Gate)
Emits opposite of input. Receives instantly, emits with 1-tick delay.

| Property | Type | Description |
|----------|------|-------------|
| `signalType` | `'inverter'` | Emitter discriminator |
| `receiverType` | `'inverter'` | Receiver discriminator |
| `signalState` | `boolean` | Output state (inverted) |
| `receivedSignal` | `boolean` | Input state |

#### Transceiver
Wireless signal relay. All transceivers on same channel share state.

| Property | Type | Description |
|----------|------|-------------|
| `signalType` | `'transceiver'` | Emitter discriminator |
| `receiverType` | `'transceiver'` | Receiver discriminator |
| `channel` | `string` | Channel identifier for wireless linking |
| `signalState` | `boolean` | Current broadcast state |
| `receivedSignal` | `boolean` | Input from wired network |

**Use Cases:**
- Remote pressure plate to distant door
- One oscillator powering multiple isolated areas
- Cross-room signaling without conductive path

### Receivers

#### Gate
Movable barrier. Opens when powered, closes when unpowered.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'gate' \| 'gate-open' \| 'gate-closed'` | State variants |
| `receiverType` | `'gate'` | Discriminator |
| `receivedSignal` | `boolean` | Current power state |

**Layer Behavior:**
- `gate-closed` → WALLS layer (blocks movement)
- `gate-open` → FLOOR layer (passable)

---

## System Phases

The SignalSystem executes in phases each tick:

```
1. processPendingSignals()    // Move lastTick pending → active
2. updateOscillators()        // Toggle oscillators at period
3. updatePressureSwitches()   // Detect actor step-on
4. resolveCircuit()           // Multi-pass flood-fill
   a. Pass 1: Propagate from primary sources
   b. Pass 2: Process inverters (NOT gates)
   c. Pass 3: Resolve transceiver channels
5. applyToReceivers()         // Update gates (with delay)
```

### Flood-Fill Algorithm

Signal propagation uses 4-directional flood-fill:
1. Start from active sources
2. Mark conductive cells as powered
3. Propagate to neighbors that are conductive
4. Stop at non-conductive cells

**Active components block pass-through**: Inverters and transceivers receive signal but don't pass it through. They act as circuit terminators.

---

## Layer Usage

| Entity | Layer | Notes |
|--------|-------|-------|
| Oscillator | COLLECTIBLES | On top of floor |
| Pressure Switch | COLLECTIBLES | On top of floor |
| Conductive Floor | FLOOR | Base layer |
| Inverter | COLLECTIBLES | On top of floor |
| Transceiver | COLLECTIBLES | On top of floor |
| Gate (closed) | WALLS | Blocks movement |
| Gate (open) | FLOOR | Passable terrain |

---

## API Reference

### Spawn Helpers

```typescript
spawnOscillator(spatial, x, y, layer, { oscillatorPeriod, signalState, color });
spawnPressureSwitch(spatial, x, y, layer, { signalState, color });
spawnConductiveFloor(spatial, x, y, { color });
spawnInverter(spatial, x, y, layer, { signalState, receivedSignal, color });
spawnTransceiver(spatial, x, y, layer, channel, { signalState, color });
spawnGate(spatial, x, y, layer, { receivedSignal, color });
```

### Type Guards

```typescript
hasSignalEmitter(entity)   // Oscillator, PressureSwitch, Inverter, Transceiver
hasSignalReceiver(entity)  // Gate, Inverter, ConductiveFloor, Transceiver
hasConductive(entity)      // ConductiveFloor
isTransceiver(entity)      // Transceiver
isGate(entity)          // Gate variants
```

---

## Future Work

### Sleep/Wake Cells for NPC Regions

**Concept**: Signal-controlled zones that activate/deactivate NPCs to optimize performance and create dramatic reveals.

```
[PRESSURE PLATE] → [CONDUCTOR] → [WAKE ZONE]
                                     ↓
                               [NPC becomes active]
```

**Proposed Entities:**
- `wake-zone`: Marker entity on AI layer that activates NPCs in radius
- `sleep-zone`: Puts NPCs back to sleep when powered

**Behavior:**
- Sleeping NPCs skip AI updates (performance)
- Wake signal cascades through transceivers for room reveals
- Allows scripted "ambush" triggers

### NPC Paths as Conductors

**Concept**: NPC patrol paths double as conductive wires, enabling AI-layer signal networks.

```
[OSC] → [NPC PATH] → [NPC PATH] → [BOLLARD ON AI LAYER]
```

**Benefits:**
- Reuse path data for circuit layout
- AI layer remains invisible to player
- Enables "behind the scenes" automation

**Implementation Notes:**
- Path nodes get `HasConductive` trait
- SignalSystem queries AI layer during flood-fill

### Pressure Switch Modes

**Concept**: Support multiple activation behaviors for pressure switches.

| Mode | Initial State | Behavior |
|------|---------------|----------|
| `toggle` | OFF | Toggles on each step (current) |
| `hold` | OFF | ON only while pressed |
| `latch` | OFF | Stays ON once triggered |
| `inverted-latch` | ON | Stays OFF once triggered |

**Proposed Properties:**
```typescript
interface PressureSwitchData {
  switchMode: 'toggle' | 'hold' | 'latch' | 'inverted-latch';
  initialState: boolean;  // Starting signalState
}
```

**Use Cases:**
- `hold`: Requires player to stand on switch (co-op puzzle)
- `latch`: One-way door, checkpoint triggers
- `inverted-latch`: Trap doors that close permanently

---

## Changelog

| Version | Changes |
|---------|---------|
| 2.0 | Added tick-delay model, transceiver entity, future work section |
| 1.0 | Initial spec with oscillators, pressure switches, inverters, gates |
