import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SignalSystem } from '../systems/signal.system';
import { GameContext } from '../core/types';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameManager } from '../core/game-manager';
import {
    spawnOscillator,
    spawnConductiveFloor,
    spawnInverter,
    spawnGate
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
            spatial: spatial as unknown as GameContext['spatial'],
            gameManager: {
                gameState: {
                    entityStore,
                    systems: {}
                }
            } as unknown as GameManager
        };

        signalSystem = new SignalSystem(context.gameManager as unknown as GameManager);
    });

    it('O-C-I-C-B chain: Inverter should not back-feed input wire when Oscillator is OFF', () => {
        // Layout: O(0,0) - C(1,0) - I(2,0) - C(3,0) - B(4,0)
        // 
        // TIMING with 1-tick delay for inverters:
        // Tick 1: Osc ON → event(true) → WireIn=true, Inverter pending=true
        // Tick 2: Osc OFF, Inverter applies pending(true) → emits !true=false → WireOut=false
        //         Osc creates event(false) → WireIn=false, Inverter pending=false
        // Tick 3: Inverter applies pending(false) → emits !false=true → WireOut=true
        //
        // The key test: WireIn should NOT receive the inverter's signal (no backfeed)

        // 1. Spawn Oscillator (Starts ON)
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

        // 5. Gate
        const gateId = spawnGate(spatial, 4, 0, 5, {
            receivedSignal: false
        });

        spatial.commit();

        // --- Tick 1 ---
        signalSystem.update(context);

        // After tick 1:
        // - Oscillator is ON, creates event(true)
        // - WireIn receives true (instant)
        // - Inverter has pendingSignal = true (1-tick delay)
        const invData1 = spatial.getEntityData(invId) as unknown as { receivedSignal?: boolean; pendingSignal?: boolean; signalState?: boolean };
        const wireIn1 = spatial.getEntityData(wireInId) as unknown as { receivedSignal?: boolean; pendingSignal?: boolean; signalState?: boolean };

        expect(wireIn1.receivedSignal).toBe(true); // WireIn receives oscillator's ON
        expect(invData1.pendingSignal).toBe(true); // Inverter pending (not applied yet)
        expect(invData1.signalState).toBe(false); // Inverter hasn't applied pending yet

        // --- Tick 2 ---
        // Toggle Oscillator OFF before update
        context.gameManager!.gameState.entityStore.setData(oscId, { signalState: false });

        signalSystem.update(context);

        // After tick 2:
        // - applyPending: Inverter applies pending(true) → emits !true = false
        // - createEvents: Oscillator changed to false → emits false
        // - WireIn = false (from oscillator's OFF event)
        // - WireOut = false (from inverter's FALSE emission)
        // - Inverter now has pendingSignal = false (from oscillator's OFF)
        //
        // CRITICAL: WireIn should NOT receive the inverter's signal (no backfeed)

        const wireIn2 = spatial.getEntityData(wireInId) as unknown as { receivedSignal?: boolean; pendingSignal?: boolean; signalState?: boolean };
        const wireOut2 = spatial.getEntityData(wireOutId) as unknown as { receivedSignal?: boolean; pendingSignal?: boolean; signalState?: boolean };
        const invData2 = spatial.getEntityData(invId) as unknown as { receivedSignal?: boolean; pendingSignal?: boolean; signalState?: boolean };
        const gate2 = spatial.getEntityData(gateId) as unknown as { receivedSignal?: boolean; pendingSignal?: boolean; signalState?: boolean };

        // NO BACKFEED: WireIn should be false (from oscillator OFF), not affected by inverter
        expect(wireIn2.receivedSignal).toBe(false);

        // Inverter emits FALSE (inverted from receiving TRUE in tick 1)
        expect(invData2.receivedSignal).toBe(true);  // Applied the pending TRUE
        expect(invData2.signalState).toBe(false);    // Output is inverted: !true = false
        expect(wireOut2.receivedSignal).toBe(false); // Receives inverter's FALSE
        expect(gate2.pendingSignal).toBe(false);     // Gate receives FALSE too

        // --- Tick 3 ---
        signalSystem.update(context);

        // After tick 3:
        // - applyPending: Inverter applies pending(false) → emits !false = true
        // - WireOut = true (from inverter's TRUE emission)
        // - WireIn should still be false (no backfeed)

        const wireIn3 = spatial.getEntityData(wireInId) as unknown as { receivedSignal?: boolean; pendingSignal?: boolean; signalState?: boolean };
        const wireOut3 = spatial.getEntityData(wireOutId) as unknown as { receivedSignal?: boolean; pendingSignal?: boolean; signalState?: boolean };
        const invData3 = spatial.getEntityData(invId) as unknown as { receivedSignal?: boolean; pendingSignal?: boolean; signalState?: boolean };
        const gate3 = spatial.getEntityData(gateId) as unknown as { receivedSignal?: boolean; pendingSignal?: boolean; signalState?: boolean };

        // NO BACKFEED: WireIn should still be false
        expect(wireIn3.receivedSignal).toBe(false);

        // Now inverter emits TRUE (inverted from receiving FALSE in tick 2)
        expect(invData3.receivedSignal).toBe(false); // Applied pending FALSE
        expect(invData3.signalState).toBe(true);     // Output is inverted: !false = true
        expect(wireOut3.receivedSignal).toBe(true);  // Receives inverter's TRUE
        expect(gate3.pendingSignal).toBe(true);      // Gate receives TRUE
    });
});
