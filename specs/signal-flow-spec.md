# Signal Flow Specification

## Centralized Architecture (4-Phase Loop)

### Core Concept: "A Signal is a Signal"
The system creates a `SignalGrid` each tick that essentially acts as a boolean map: `Map<EntityId, boolean>`. It tracks which entities are "Powered" at specific coordinates.
- **Value Agnostic**: The flood-fill algorithm propagates "Power".
- **Source Agnostic**: Whether the source is a Generator (Oscillator/Plate), a Relay (Gate/Inverter), or a Transceiver, the propagation is identical.

### Data Flow Per Tick

```mermaid
sequenceDiagram
    participant P1 as Phase 1: Apply Pending
    participant P2 as Phase 2: Sources
    participant P3 as Phase 3: Propagate
    participant P4 as Phase 4: Calc Next

    Note over P1: Start of Tick
    P1->>Receivers: pendingSignal -> receivedSignal
    Receivers->>Receivers: Update State (Open/Close, Invert)

    Note over P2: Identify Active Sources
    P2->>SignalGrid: Mark Emitters (Osc, Switch)
    P2->>SignalGrid: Mark Active Relays (Open Gates, Valid Inverters)

    Note over P3: Flood-Fill
    SignalGrid->>SignalGrid: Propagate through Conductors
    Note right of SignalGrid: STOP at Active Components (Relays)

    Note over P4: End of Tick
    SignalGrid->>Receivers: Check if Powered
    Receivers->>Receivers: Set pendingSignal for Next Tick
```

### Relay Logic (The "Stop" Rule)
Active components (Gates, Inverters) act as **Relays**.
1. They **BLOCK** instant propagation during Phase 3.
2. They **RECEIVE** power if adjacent to a powered conductor.
3. They **STORE** this state in `pendingSignal`.
4. They **ACT** and **EMIT** in the *next* tick (Phase 1 & 2).

This inherent delay creates the cascading effect and prevents infinite loops (0-tick cycles).

---

## Component Behavior Reference

| Component | Phase 2 (Source?) | Phase 3 (Conductive?) | Phase 4 (Receiver?) |
|-----------|-------------------|-----------------------|---------------------|
| **Conductor** | No | **YES** | No |
| **Oscillator** | **YES** (if period=ON) | Yes (Implicit) | No |
| **Switch** | **YES** (if pressed) | Yes (Implicit) | No |
| **Gate** | **YES** (if received=TRUE) | **NO** (Blocks) | **YES** |
| **Inverter** | **YES** (if received=FALSE) | **NO** (Blocks) | **YES** |
| **Transceiver** | **YES** (if channel active) | **NO** (Blocks) | **YES** |

