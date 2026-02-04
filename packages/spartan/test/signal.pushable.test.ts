import { describe, test, expect, beforeEach } from 'vitest';
import { GameState } from '../core/game-state';
import { Scene } from '../core/scene';
import { GameManager } from '../core/game-manager';
import { GameLoop } from '../core/game-loop';
import { SignalSystem } from '../systems/signal.system';
import { GameLayers } from '../config/layers.config';
import { hasSignalReceiver } from '../traits/trait-guards';

describe('SignalSystem + Pushable Integration', () => {
    let gameManager: GameManager;
    let scene: Scene;
    let gameLoop: GameLoop;
    let signalSystem: SignalSystem;
    let gateId: number;
    let oscillatorId: number;

    const runTick = () => {
        gameLoop.tick();
    };

    beforeEach(() => {
        gameManager = new GameManager();
        scene = gameManager.sceneManager.createScene('test-scene', 10, 10);
        signalSystem = new SignalSystem(gameManager);

        // Register SignalSystem manual loop setup
        gameLoop = new GameLoop(scene.spatial, gameManager);
        gameLoop.addSystem(signalSystem);

        // Initialize system (register lifecycle handlers) before spawning entities
        runTick();
        // Setup a simple circuit: Oscillator -> Wire -> (Gap for Pushable) -> Gate
        // 1. Oscillator at (0,0)
        oscillatorId = scene.spatial.spawn('oscillator', 0, 0, GameLayers.LOGIC, {
            signalType: 'oscillator',
            signalState: false, // Start OFF
            oscillatorPeriod: 1000, // High period to prevent auto-toggle during test
        });

        // 2. Wire at (1,0)
        scene.spatial.spawn('wire', 1, 0, GameLayers.LOGIC, {
            type: 'wire', // wires are conductive
            isConductive: true,
            conductiveType: 'floor' // generic conductive
        });

        // 3. Gate at (3,0)
        gateId = scene.spatial.spawn('gate-closed', 3, 0, GameLayers.LOGIC, {
            type: 'gate-closed',
            receiverType: 'gate',
            receivedSignal: false,
        });

        scene.spatial.commit();
    });

    test('conducts signal through a pushable block on ACTORS layer', () => {
        // Initial state: Oscillator OFF.
        runTick();
        let gateData = scene.spatial.getEntityData(gateId);
        if (!gateData || !hasSignalReceiver(gateData)) throw new Error('Invalid gate');
        expect(gateData.receivedSignal).toBe(false);

        // Act: Spawn a conductive pushable block at (2,0) on ACTORS layer
        const crateId = scene.spatial.spawn('metal-crate', 2, 0, GameLayers.ACTORS, {
            isPushable: true,
            isConductive: true,
        });
        scene.spatial.commit();

        // Act: Turn Oscillator ON to trigger propagation
        gameManager.gameState.entityStore.setData(oscillatorId, { signalState: true }); // Use captured ID

        // Tick: Signal should propagate through crate
        runTick(); // Signal propagates, gate gets pendingSignal
        runTick(); // Gate applies pending signal

        // Check gate
        gateData = scene.spatial.getEntityData(gateId);
        if (!gateData || !hasSignalReceiver(gateData)) throw new Error('Invalid gate');
        expect(gateData.receivedSignal).toBe(true);

        // Act: Move the crate out of the way
        // Sequence:
        // 1. Osc OFF. Spawn Crate.
        // 2. Osc ON. Expect Gate ON.
        // 3. Osc OFF. Expect Gate OFF.
        // 4. Move Crate.
        // 5. Osc ON. Expect Gate OFF.

        gameManager.gameState.entityStore.setData(oscillatorId, { signalState: false });
        runTick(); // Propagate OFF
        runTick(); // Apply OFF to Gate
        gateData = scene.spatial.getEntityData(gateId);
        if (!gateData || !hasSignalReceiver(gateData)) throw new Error('Invalid gate');
        expect(gateData.receivedSignal).toBe(false);

        // Move Crate
        scene.spatial.move(crateId, 2, 1);
        scene.spatial.commit();

        const cratePos = scene.spatial.getEntityPosition(crateId);
        expect(cratePos?.x).toBe(2);
        expect(cratePos?.y).toBe(1);

        // Turn ON
        gameManager.gameState.entityStore.setData(oscillatorId, { signalState: true });
        runTick();
        runTick(); // Wait for potential propagation (which shouldn't happen)

        // Gate should stay OFF because path is broken
        gateData = scene.spatial.getEntityData(gateId);
        if (!gateData || !hasSignalReceiver(gateData)) throw new Error('Invalid gate');
        expect(gateData.receivedSignal).toBe(false);
    });

    test('updates gate when crate moves into circuit (topology change)', () => {
        // Setup: Oscillator already ON, gap in circuit, crate nearby
        // Act: Move crate INTO the gap
        // Expect: Gate turns ON via topology change detection

        // Initial: Oscillator ON, but gate OFF (path broken)
        gameManager.gameState.entityStore.setData(oscillatorId, { signalState: true });
        runTick();
        runTick();

        let gateData = scene.spatial.getEntityData(gateId);
        if (!gateData || !hasSignalReceiver(gateData)) throw new Error('Invalid gate');
        expect(gateData.receivedSignal).toBe(false); // Path broken, no crate

        // Act: Spawn crate at gap position (2,0)
        const crateId = scene.spatial.spawn('metal-crate', 2, 0, GameLayers.ACTORS, {
            isPushable: true,
            isConductive: true,
        });
        scene.spatial.commit();

        // Tick: Topology changed, should re-propagate
        runTick(); // Detects topology change, sets pending on gate
        runTick(); // Gate applies pending

        gateData = scene.spatial.getEntityData(gateId);
        if (!gateData || !hasSignalReceiver(gateData)) throw new Error('Invalid gate');
        expect(gateData.receivedSignal).toBe(true); // Now connected!

        // Act: Move crate OUT of circuit
        scene.spatial.move(crateId, 2, 5);
        scene.spatial.commit();

        runTick(); // Detects topology change, resets gate pending to false
        runTick(); // Gate applies pending (false)

        gateData = scene.spatial.getEntityData(gateId);
        if (!gateData || !hasSignalReceiver(gateData)) throw new Error('Invalid gate');
        expect(gateData.receivedSignal).toBe(false); // Disconnected again
    });
});
