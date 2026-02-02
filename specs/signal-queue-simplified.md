
# Signal Queue Simplified

## Signals

1. A signal is an event that originates from a signal generator.
2. A signal is uniquely identified by the signal generator entity ID + the tick time in which it originated.
3. A signal propagates from cell-to-cell based on rules. It can only act on a single cell once in its lifecycle.
4. Once a signal can no longer propagate any further, it is dereferenced.
5. An signal value can be either true or false, both values propagate in the same way

## Propagation

1. A signal propagates outwards along 4-cardinal neighbors of a cell.
2. A signal may propagate multiple times in the same tick. It may propagate in multiple directions at once.
3. A signal cannot propagate to a cell it has already propagated to.
4. A signal may only propagate through cells that contain certain entities.

## Entities

1. Signal Generators: Create events that propagate outward to adjacent cells (4-cardinal) - see LinkedGrid and LinkedCell and Spatial System.
2. Conductors: Propagate events instantly *IN THE SAME TICK*.
3. Signal Trait Entities (STE): Receive signals, react to them, then propagate them *ON THE NEXT TICK*.
4. Transformer Entities: Similar to Signal Generators, but do not generate signals on their own. They _transform_ a signal that is received, then pass it along *ON THE NEXT TICK*.

## Special Cases

1. Transformer Entities: These entities _transform_ a signal after reacting but before putting into the queue for the next tick. This is accomplished by cloning the originating signal and changing its value. The cloned signal shall retain the originating signal's ID and tick counter value, as well as the list of cells it has already acted upon. This will prevent the transformed signal from acting on cells that the original signal already acted upon.

## System Phases:

1. Process Signal Generators: For every signal generator, process it and generate new signals if applicable. Push them onto the queue for next tick.
2. Process current tick signals: Process current tick propagation. Conductors should propagate until they no longer find any adjacent conductors (INSTANTLY) or adjacent STEs. When STEs receive a signal, they are queued to be processed *ON THE NEXT TICK*
  a. STEs should _react_ to received signals
  b. If STEs are not destroyed/removed as a result of their reaction then
  c. Queue propagation for next tick.
3. Clean up: Any events that can no longer processed should be dereferenced.
