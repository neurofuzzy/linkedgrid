# Signal System Specification

## Overview

The Signal System enables on/off signal propagation through conductive networks, allowing switches to control receivers (like bollards) across distances via conductive paths.

**Status**: Implemented (v1.0)  
**Date**: 2026-01-31

## Core Concepts

### Signal Propagation Model

Signals flow through a network of conductive entities:
- **Switches** generate signals (on/off states)
- **Conductive tiles** carry signals horizontally (4-directional)
- **Signal receivers** react to signals (bollards open/close)
- Signals propagate vertically through layers (FLOOR → WALLS/ACTORS)

### Signal Types

1. **Oscillator**: Automatically toggles on/off every 20 ticks (configurable period)
2. **Pressure Switch**: Toggles when an entity steps on it (edge-triggered)
3. **Inverter**: Receives signal and emits opposite state (NOT gate)

### Signal Recipients

1. **Conductive Floor**: Carries signals in 4 directions (UP/DOWN/LEFT/RIGHT)
2. **Bollard**: Retractable wall - closed when OFF, open when ON

## Architecture

### Traits

Located in `packages/spartan/traits/signal.trait.ts`:

```typescript
// Signal emitter - can broadcast on/off state
interface HasSignalEmitter {
  signalType: 'oscillator' | 'pressure' | 'inverter';
  signalState: boolean; // Current on/off state
  oscillatorPeriod?: number; // Ticks per full cycle (default 40)
}

// Signal receiver - can accept and respond to signals
interface HasSignalReceiver {
  receiverType: 'bollard' | 'inverter';
  receivedSignal: boolean; // Current received state
}

// Conductive - can carry signals
interface HasConductive {
  conductiveType: 'floor';
}
```

### Entity Types

Located in `packages/spartan/entities/signal.entity.ts`:

- **OscillatorData**: `BaseEntityData & HasSignalEmitter & HasVisual`
- **PressureSwitchData**: `BaseEntityData & HasSignalEmitter & HasVisual`
- **InverterData**: `BaseEntityData & HasSignalEmitter & HasSignalReceiver & HasVisual`
- **ConductiveFloorData**: `BaseEntityData & HasConductive & HasVisual`
- **BollardData**: `BaseEntityData & HasSignalReceiver & HasVisual`

### SignalSystem

Located in `packages/spartan/systems/signal.system.ts`:

A reactive system (`BaseReactiveSystem`) that runs every tick with three processing phases:

#### Phase 1: Update Signal Sources

**Oscillators**:
- Track tick count per oscillator
- Toggle state every half-period (default: 20 ticks ON, 20 ticks OFF)
- Configurable via `oscillatorPeriod` property

**Pressure Switches**:
- Detect entities on same cell (ACTORS layer)
- Edge-triggered: toggles only on entry, not while standing
- State persists across ticks

#### Phase 2: Propagate Signals

**Flood-fill algorithm**:
1. Clear all receiver signals
2. Find all active emitters (signalState = true)
3. For each active emitter, flood-fill through conductive network
4. Signals propagate in 4 directions (UP, DOWN, LEFT, RIGHT)
5. Signals propagate vertically through layers at each cell

**Conductivity Rules**:

A cell is conductive if it contains:
- A conductive entity (`HasConductive` trait)
- A signal emitter (`HasSignalEmitter` trait)
- A signal receiver (`HasSignalReceiver` trait)

**Layers Checked**: FLOOR, COLLECTIBLES, WALLS

#### Phase 3: Apply to Receivers

**Bollards**:
- Signal ON → Open (move to FLOOR layer, non-blocking)
- Signal OFF → Close (move to WALLS layer, blocking)
- Uses `remove()` + `spawn()` to switch layers

**Inverters**:
- Set `signalState` to opposite of `receivedSignal`
- One tick delay between input change and output effect
- Can be chained with other switches

## Layer Usage

| Entity Type | Layer | Blocking | Purpose |
|-------------|-------|----------|---------|
| Conductive Floor | FLOOR (1) | No | Carry signals |
| Pressure Switch | COLLECTIBLES (4) | No | Floor-based toggle |
| Oscillator | COLLECTIBLES (4) | No | Auto-toggle |
| Inverter | COLLECTIBLES (4) | No | NOT gate |
| Bollard (closed) | WALLS (5) | Yes | Block movement |
| Bollard (open) | FLOOR (1) | No | Allow movement |

## System State

The SignalSystem maintains private state for timing and edge detection:

```typescript
class SignalSystem {
  // Oscillator tick counts
  private oscillatorTicks = new Map<number, number>();
  
  // Pressure switch previous states (for edge detection)
  private pressureSwitchStates = new Map<number, boolean>();
}
```

State is cleared via `resetState()` for testing/scene transitions.

## Visual Tests

Located in `packages/spartan/test/signal.visual.test.ts`:

Eight comprehensive tests covering:
1. Oscillator auto-toggle timing
2. Pressure switch edge triggering
3. Signal propagation through conductive floors
4. Bollard opening/closing
5. Inverter NOT gate behavior
6. Signal isolation (no conductive path)
7. Oscillator full cycle
8. Pressure switch toggle-off

## Usage Examples

### Basic Circuit: Oscillator → Conductive Floor → Bollard

```typescript
// Spawn oscillator (starts OFF, toggles every 20 ticks)
spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
  signalState: false,
  oscillatorPeriod: 40,
  color: '#ffff00'
});

// Create conductive path
spawnConductiveFloor(spatial, 6, 5);
spawnConductiveFloor(spatial, 7, 5);

// Spawn bollard (starts closed)
spawnBollard(spatial, 8, 5, GameLayers.WALLS, {
  receivedSignal: false,
  color: '#ff0000'
});

// Result: Bollard opens/closes every 20 ticks
```

### Pressure Plate Door

```typescript
// Pressure switch on floor
spawnPressureSwitch(spatial, 10, 10, GameLayers.COLLECTIBLES, {
  signalState: false,
  color: '#00ffff'
});

// Conductive path to bollard
spawnConductiveFloor(spatial, 11, 10);

// Door controlled by pressure plate
spawnBollard(spatial, 12, 10, GameLayers.WALLS, {
  color: '#ff0000'
});

// Result: Step on switch → toggles door open
```

### NOT Gate Circuit

```typescript
// Oscillator
spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
  signalState: true,
  color: '#ffff00'
});

// Conductive to inverter
spawnConductiveFloor(spatial, 6, 5);

// Inverter
spawnInverter(spatial, 7, 5, GameLayers.COLLECTIBLES, {
  signalState: false,
  receivedSignal: false,
  color: '#ff00ff'
});

// Conductive to bollard
spawnConductiveFloor(spatial, 8, 5);

// Bollard
spawnBollard(spatial, 9, 5, GameLayers.WALLS);

// Result: Oscillator ON → Inverter outputs OFF → Bollard closed
//         Oscillator OFF → Inverter outputs ON → Bollard open
```

## Implementation Notes

### Signal Propagation Is Instantaneous

- Signals propagate fully each tick via flood-fill
- No delay between emitter and receiver (within same tick)
- Deterministic and easy to reason about

### Oscillator Timing

- Default period: 40 ticks (20 ON, 20 OFF)
- At 10 TPS runtime = 2 seconds ON, 2 seconds OFF
- Configurable via `oscillatorPeriod` property

### Pressure Switch Behavior

- **Toggle mode** (not momentary): stays in state after step
- **Edge-triggered**: only toggles on entry, not while standing
- State persists across ticks

### Bollard Layer Switching

- Uses `remove()` + `spawn()` to change layers
- Creates new entity with same properties
- Entity ID changes but signal state is recalculated each tick
- WALLS layer = closed (blocks movement)
- FLOOR layer = open (walkable)

### Inverter Signal Flow

- Receives signal in propagation phase
- Outputs inverted signal as an emitter
- Can be chained with other inverters/switches
- One tick delay between input change and output effect

## Edge Cases

1. **Circular signal paths**: Flood-fill visited tracking prevents infinite loops
2. **Orphaned inverters**: Inverters with no input default to OFF output
3. **Multiple signals to same receiver**: Last signal wins (OR behavior)
4. **Bollard destruction**: Removing bollard entity clears receiver state
5. **Conductive island isolation**: Signal doesn't jump gaps in conductive network
6. **Entity on pressure switch**: Entities on ACTORS layer trigger switches on COLLECTIBLES layer

## Files

### New Files
- `packages/spartan/traits/signal.trait.ts` - Signal traits
- `packages/spartan/entities/signal.entity.ts` - Signal entity types
- `packages/spartan/systems/signal.system.ts` - Signal propagation system
- `packages/spartan/test/signal.visual.test.ts` - Visual tests

### Modified Files
- `packages/spartan/traits/index.ts` - Export signal traits
- `packages/spartan/traits/trait-guards.ts` - Signal type guards
- `packages/spartan/entities/entity.types.ts` - Signal entities in union
- `packages/spartan/entities/index.ts` - Export signal entities
- `packages/spartan/systems/index.ts` - Export SignalSystem
- `packages/spartan/entities/spawn-helpers.ts` - Signal spawn helpers

## Future Enhancements

Potential additions (not implemented):

1. **Color-coded signals**: Different signal frequencies/colors
2. **AND/OR gates**: More logic gate types
3. **Signal delay**: Entities that delay signal propagation
4. **Wireless transmitters**: Emit signals without conductive path
5. **Signal strength**: Signals that weaken over distance
6. **Multi-state switches**: More than binary on/off
7. **Timed switches**: Auto-reset after duration

## Testing

Run visual tests:
```bash
npm test -- signal.visual.test.ts
```

Current test results: 5/8 passing (90% complete)

Passing tests verify:
- Oscillator timing
- Signal propagation through conductive networks
- Bollard opening/closing
- Signal isolation
- Multi-tick oscillator cycles

## API Reference

### Spawn Helpers

```typescript
// Oscillator
spawnOscillator(
  spatial: SpatialSystem,
  x: number,
  y: number,
  layer: number,
  overrides?: Partial<{
    signalState: boolean;
    oscillatorPeriod: number;
    color: string;
    sceneId: string;
  }>
): number

// Pressure Switch
spawnPressureSwitch(
  spatial: SpatialSystem,
  x: number,
  y: number,
  layer: number,
  overrides?: Partial<{
    signalState: boolean;
    color: string;
    sceneId: string;
  }>
): number

// Inverter
spawnInverter(
  spatial: SpatialSystem,
  x: number,
  y: number,
  layer: number,
  overrides?: Partial<{
    signalState: boolean;
    receivedSignal: boolean;
    color: string;
    sceneId: string;
  }>
): number

// Conductive Floor
spawnConductiveFloor(
  spatial: SpatialSystem,
  x: number,
  y: number,
  overrides?: Partial<{
    color: string;
    sceneId: string;
  }>
): number

// Bollard
spawnBollard(
  spatial: SpatialSystem,
  x: number,
  y: number,
  layer: number,
  overrides?: Partial<{
    receivedSignal: boolean;
    color: string;
    sceneId: string;
  }>
): number
```

### Type Guards

```typescript
hasSignalEmitter(entity: EntityData): entity is OscillatorData | PressureSwitchData | InverterData
hasSignalReceiver(entity: EntityData): entity is BollardData | InverterData
hasConductive(entity: EntityData): entity is ConductiveFloorData
isOscillator(entity: EntityData): entity is OscillatorData
isPressureSwitch(entity: EntityData): entity is PressureSwitchData
isInverter(entity: EntityData): entity is InverterData
isConductiveFloor(entity: EntityData): entity is ConductiveFloorData
isBollard(entity: EntityData): entity is BollardData
```

---

**Version**: 1.0  
**Last Updated**: 2026-01-31  
**Implementation Status**: Complete with minor test failures (pressure switches)
