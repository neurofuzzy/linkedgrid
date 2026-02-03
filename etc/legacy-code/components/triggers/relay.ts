/**
 * @component SignalSource
 * @icon radio
 * @description Signal origin for relay networks (telegraphs, beacons)
 * 
 * Signal Source Component
 * 
 * Origin point for signal propagation through relay nodes.
 * 
 * @property {number} range - Range of the signal
 * @property {boolean} active - Whether source is currently active
 * @property {string} channel - Signal frequency/channel for filtering
 */

/**
 * @component Relay
 * @icon repeat
 * @description Propagates signals through network (relay nodes, towers)
 * 
 * Relay Component
 * 
 * Telegraph/relay network for signal propagation through relay nodes.
 * Similar to electricity but for general signals/messages.
 * 
 * Examples:
 * - Telegraph relay networks
 * - Beacon chains
 * - Signal towers
 * - Communication networks
 * 
 * @property {number} range - Range that this relay can propagate signals
 * @property {boolean} active - Whether relay is currently active
 * @property {string} channel - Signal channel filtering
 */

/**
 * @component SignalReceiver
 * @icon radio-receiver
 * @description Receives signals from relay network (endpoints, devices)
 * 
 * Signal Receiver Component
 * 
 * Endpoint that receives signals from relay network.
 * 
 * @property {boolean} active - Whether receiver is currently receiving signal
 * @property {string} channel - Signal channel filtering
 */

import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export interface SignalSource {
  /** Range of the signal */
  range: number;
  
  /** Whether the source is currently active */
  active: boolean;
  
  /** Optional: Signal frequency/channel for filtering */
  channel?: string;
  
  /** Optional: Callback when signal propagates */
  onPropagate?: (source: Entity, reachedEntities: Entity[]) => void;
}

export const SignalSourceComponent = defineComponent<SignalSource>();

export interface Relay {
  /** Range that this relay can propagate signals */
  range: number;
  
  /** Whether this relay is currently active (has signal) */
  active: boolean;
  
  /** Optional: Signal channel filtering */
  channel?: string;
  
  /** Optional: Callback when relay activates */
  onActivate?: (relay: Entity) => void;
  
  /** Optional: Callback when relay deactivates */
  onDeactivate?: (relay: Entity) => void;
  
  /** Internal: Track which signals activated this relay (for propagation) */
  activeSources?: Set<Entity>;
}

export const RelayComponent = defineComponent<Relay>();

export interface SignalReceiver {
  /** Whether this receiver is currently receiving a signal */
  active: boolean;
  
  /** Optional: Signal channel filtering */
  channel?: string;
  
  /** Optional: Callback when signal received */
  onReceive?: (receiver: Entity, source: Entity) => void;
  
  /** Optional: Callback when signal lost */
  onLost?: (receiver: Entity) => void;
}

export const SignalReceiverComponent = defineComponent<SignalReceiver>();
