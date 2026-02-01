import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SignalSystem } from '../systems/signal.system';
import { GameContext } from '../core/types';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import {
    spawnOscillator,
    spawnConductiveFloor,
    spawnInverter,
    spawnBollard
} from '../entities/spawn-helpers';

describe('Signal Back-feed Investigation', () => {
    let spatial: SpatialSystem;
    let signalSystem: SignalSystem;
    let context: GameContext;

    beforeEach(() => {
        const entityStore = new SparseEntityStore();
        const grid = new LinkedGrid(20, 20);
        spatial = new SpatialSystem(grid, entityStore);

        // Initialize mock game context
        context = {
            overlaps: [],
            spatial: spatial as any,
            gameManager: {
                gameState: {
                    entityStore,
                    systems: {} as any
                }
            } as any
        };

        signalSystem = new SignalSystem(context.gameManager as any);
    });

    it('O-C-I-C-B chain: Inverter should not back-feed input wire when Oscillator is OFF', () => {
        // Layout: O(0,0) - C(1,0) - I(2,0) - C(3,0) - B(4,0)

        // 1. Spawn Oscillator (Starts ON to prime latch)
        const oscId = spawnOscillator(spatial, 0, 0, 4, {
            signalState: true,
            oscillatorPeriod: 40
        });

        // 2. Input Wire
        const wireInId = spawnConductiveFloor(spatial, 1, 0, {
            sceneId: 'test'
        });

        // 3. Inverter
        const invId = spawnInverter(spatial, 2, 0, 4, {
            signalState: false,
            receivedSignal: false
        });

        // 4. Output Wire
        const wireOutId = spawnConductiveFloor(spatial, 3, 0, {
            sceneId: 'test'
        });

        // 5. Bollard
        const bollardId = spawnBollard(spatial, 4, 0, 5, {
            receivedSignal: false
        });

        spatial.commit(); // Ensure entities are on the grid!

        // --- Tick 1 ---
        // Update Signal System
        signalSystem.update(context);

        // Expectations:
        // Oscillator is OFF.
        // Inverter receives NO signal (wireIn is OFF).
        // Inverter should logically be ON (NOT OFF).
        // Inverter emits ON.

        // Check Inverter State
        const invData = spatial.getEntityData(invId) as any;
        // Inverter state updates at END of tick based on received signal. 
        // Initial receivedSignal was false, so it should flip to true?
        // Wait, update sequence: 
        // 1. updateOscillators (Oscillator -> OFF)
        // 2. propagateSignals (Oscillator OFF, Inverter OFF -> No signal)
        // 3. applyToReceivers (Inverter sees False -> sets signalState True for NEXT tick)

        // So after tick 1:
        // Inverter signalState should be true (prepared for next tick emission)
        expect(invData.signalState).toBe(false);

        // Initial Latch Check: The Inverter should have received signal in Pass 1.
        // We can't access internal map, but we trust the logic.

        // --- Tick 2 ---
        // Toggle Oscillator OFF manually.
        // This simulates the Oscillator turning off after a period.
        context.gameManager!.gameState.entityStore.setData(oscId, { signalState: false });

        // Inverter should now detect NO signal.
        // Inverter signalState becomes true (ON) in this tick?
        // Wait, 'signalState' updates in Pass 2 of Tick 2.
        signalSystem.update(context);

        // Propagation:
        // Inverter (ON) floods neighbors.
        // Expectation: 
        // wireOut should be ON.
        // wireIn should be... OFF? (If preventing back-feed) or ON (If bidirectional)?

        const wireIn = spatial.getEntityData(wireInId) as any;
        const wireOut = spatial.getEntityData(wireOutId) as any;
        const bollard = spatial.getEntityData(bollardId) as any;

        console.log('WireIn Signal:', wireIn.receivedSignal);
        console.log('WireOut Signal:', wireOut.receivedSignal);
        console.log('Bollard Signal:', bollard.receivedSignal);

        expect(wireOut.receivedSignal).toBe(true); // Output should definitely be ON
        expect(bollard.receivedSignal).toBe(true); // Bollard should be ON

        // The "Bug": WireIn is ON because of back-feed
        expect(wireIn.receivedSignal).toBe(false); // This will FAIL if back-feed exists
    });
});
