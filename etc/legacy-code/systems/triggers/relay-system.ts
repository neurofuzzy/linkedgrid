/**
 * Relay System
 * 
 * Manages signal propagation through relay networks.
 * Signals propagate from sources through relays to receivers.
 */

import { System } from '@basegrid/ecs';
import { SignalSourceComponent, RelayComponent, SignalReceiverComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export class RelaySystem extends System {
  update(_dt: number): void {
    // Reset all relays and receivers at start of frame
    for (const [_, relay] of this.world.query(RelayComponent)) {
      relay.active = false;
      relay.activeSources = new Set();
    }

    for (const [_, receiver] of this.world.query(SignalReceiverComponent)) {
      const wasActive = receiver.active;
      receiver.active = false;
      
      if (wasActive && receiver.onLost) {
        receiver.onLost(_);
      }
    }

    // Propagate signals from all active sources
    for (const [sourceEntity, source] of this.world.query(SignalSourceComponent)) {
      if (!source.active) continue;

      const sourcePos = this.world.getComponent(sourceEntity, GridPositionComponent);
      if (!sourcePos) continue;

      const reachedEntities: Entity[] = [];

      // Activate relays within source range
      this.activateRelaysInRange(sourceEntity, sourcePos, source, reachedEntities);

      // Propagate through relay chain (iteratively until no new relays activate)
      let changed = true;
      let iterations = 0;
      const maxIterations = 100; // Prevent infinite loops

      while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        // Check all currently active relays for this source
        for (const [relayEntity, relay] of this.world.query(RelayComponent)) {
          if (!relay.active || !relay.activeSources?.has(sourceEntity)) continue;

          const relayPos = this.world.getComponent(relayEntity, GridPositionComponent);
          if (!relayPos || relayPos.grid !== sourcePos.grid) continue;

          // Try to activate other relays from this relay
          for (const [otherRelayEntity, otherRelay] of this.world.query(RelayComponent)) {
            if (otherRelayEntity === relayEntity) continue;
            if (otherRelay.activeSources?.has(sourceEntity)) continue; // Already activated by this source

            const otherPos = this.world.getComponent(otherRelayEntity, GridPositionComponent);
            if (!otherPos || otherPos.grid !== sourcePos.grid) continue;

            // Check channel matching
            if (relay.channel && otherRelay.channel && relay.channel !== otherRelay.channel) {
              continue;
            }

            // Calculate distance
            const distance = Math.abs(otherPos.x - relayPos.x) + Math.abs(otherPos.y - relayPos.y);

            if (distance <= relay.range) {
              // Activate this relay
              if (!otherRelay.activeSources) {
                otherRelay.activeSources = new Set();
              }
              otherRelay.activeSources.add(sourceEntity);
              
              if (!otherRelay.active) {
                otherRelay.active = true;
                changed = true;

                if (otherRelay.onActivate) {
                  otherRelay.onActivate(otherRelayEntity);
                }
              }
            }
          }
        }
      }

      // Activate receivers in range of source or active relays
      this.activateReceivers(sourceEntity, sourcePos, source);

      // Callback
      if (source.onPropagate && reachedEntities.length > 0) {
        source.onPropagate(sourceEntity, reachedEntities);
      }
    }
  }

  /**
   * Activate relays within range of a source
   */
  private activateRelaysInRange(
    sourceEntity: Entity,
    sourcePos: any,
    source: any,
    reachedEntities: Entity[]
  ): void {
    for (const [relayEntity, relay] of this.world.query(RelayComponent)) {
      const relayPos = this.world.getComponent(relayEntity, GridPositionComponent);
      if (!relayPos || relayPos.grid !== sourcePos.grid) continue;

      // Check channel matching
      if (source.channel && relay.channel && source.channel !== relay.channel) {
        continue;
      }

      // Calculate distance
      const distance = Math.abs(relayPos.x - sourcePos.x) + Math.abs(relayPos.y - sourcePos.y);

      if (distance <= source.range) {
        relay.active = true;
        if (!relay.activeSources) relay.activeSources = new Set();
        relay.activeSources.add(sourceEntity);
        reachedEntities.push(relayEntity);

        if (relay.onActivate) {
          relay.onActivate(relayEntity);
        }
      }
    }
  }

  /**
   * Activate relays from another relay
   */
  private activateRelaysFromRelay(
    relayEntity: Entity,
    relayPos: any,
    relay: any,
    sourceEntity: Entity,
    grid: any
  ): void {
    for (const [otherRelayEntity, otherRelay] of this.world.query(RelayComponent)) {
      if (otherRelayEntity === relayEntity) continue;
      if (otherRelay.active) continue;

      const otherPos = this.world.getComponent(otherRelayEntity, GridPositionComponent);
      if (!otherPos || otherPos.grid !== grid) continue;

      // Check channel matching
      if (relay.channel && otherRelay.channel && relay.channel !== otherRelay.channel) {
        continue;
      }

      // Calculate distance
      const distance = Math.abs(otherPos.x - relayPos.x) + Math.abs(otherPos.y - relayPos.y);

      if (distance <= relay.range) {
        otherRelay.active = true;
        if (!otherRelay.activeSources) otherRelay.activeSources = new Set();
        otherRelay.activeSources.add(sourceEntity);
      }
    }
  }

  /**
   * Check if a relay is in range of source or other active relays
   */
  private isInRangeOfActiveSource(
    relayPos: any,
    sourceEntity: Entity,
    sourcePos: any,
    source: any
  ): boolean {
    // Check if in range of original source
    const sourceDistance = Math.abs(relayPos.x - sourcePos.x) + Math.abs(relayPos.y - sourcePos.y);
    if (sourceDistance <= source.range) {
      return true;
    }

    // Check if in range of any active relay
    for (const [otherRelayEntity, otherRelay] of this.world.query(RelayComponent)) {
      if (!otherRelay.active) continue;
      if (!otherRelay.activeSources?.has(sourceEntity)) continue;

      const otherPos = this.world.getComponent(otherRelayEntity, GridPositionComponent);
      if (!otherPos || otherPos.grid !== sourcePos.grid) continue;

      const distance = Math.abs(relayPos.x - otherPos.x) + Math.abs(relayPos.y - otherPos.y);
      if (distance <= otherRelay.range) {
        return true;
      }
    }

    return false;
  }

  /**
   * Activate receivers in range of source or active relays
   */
  private activateReceivers(sourceEntity: Entity, sourcePos: any, source: any): void {
    for (const [receiverEntity, receiver] of this.world.query(SignalReceiverComponent)) {
      const receiverPos = this.world.getComponent(receiverEntity, GridPositionComponent);
      if (!receiverPos || receiverPos.grid !== sourcePos.grid) continue;

      // Check channel matching
      if (source.channel && receiver.channel && source.channel !== receiver.channel) {
        continue;
      }

      let inRange = false;

      // Check if in range of source
      const sourceDistance = Math.abs(receiverPos.x - sourcePos.x) + Math.abs(receiverPos.y - sourcePos.y);
      if (sourceDistance <= source.range) {
        inRange = true;
      }

      // Check if in range of any active relay
      if (!inRange) {
        for (const [_, relay] of this.world.query(RelayComponent)) {
          if (!relay.active || !relay.activeSources?.has(sourceEntity)) continue;

          const relayPos = this.world.getComponent(_, GridPositionComponent);
          if (!relayPos || relayPos.grid !== sourcePos.grid) continue;

          const distance = Math.abs(receiverPos.x - relayPos.x) + Math.abs(receiverPos.y - relayPos.y);
          if (distance <= relay.range) {
            inRange = true;
            break;
          }
        }
      }

      if (inRange) {
        const wasActive = receiver.active;
        receiver.active = true;

        if (!wasActive && receiver.onReceive) {
          receiver.onReceive(receiverEntity, sourceEntity);
        }
      }
    }
  }
}
