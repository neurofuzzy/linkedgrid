/**
 * Timer Trigger System
 * 
 * Manages time-based triggers that activate after specified intervals.
 */

import { System } from '@basegrid/ecs';
import { TimerTriggerComponent } from '@basegrid/gameplay';
import type { Entity } from '@basegrid/ecs';

export class TimerTriggerSystem extends System {
  update(_dt: number): void {
    for (const [triggerEntity, trigger] of this.world.query(TimerTriggerComponent)) {
      // Initialize elapsed time
      if (trigger.elapsed === undefined) {
        trigger.elapsed = trigger.startImmediately ? trigger.interval : 0;
      }

      // Handle cooldown
      if (trigger.cooldownTimer && trigger.cooldownTimer > 0) {
        trigger.cooldownTimer--;
        continue;
      }

      // Check max activations (only affects triggering, not active duration)
      const currentActivations = trigger.activationCount ?? 0;
      const canActivate = trigger.maxActivations === undefined || currentActivations < trigger.maxActivations;

      // Only process interval timing if we can still activate
      if (canActivate) {
        // Skip incrementing if non-repeatable and already triggered
        const shouldIncrement = trigger.repeatable || trigger.elapsed <= trigger.interval;
        
        if (shouldIncrement) {
          // Increment elapsed time
          trigger.elapsed++;

          // Check if interval reached
          if (trigger.elapsed >= trigger.interval) {
            // Trigger!
            trigger.active = true;
            trigger.activationCount = currentActivations + 1;
            
            // Reset elapsed time for next interval
            if (trigger.repeatable) {
              trigger.elapsed = 0;
            } else {
              // For non-repeatable, set to interval + 1 to prevent re-triggering
              trigger.elapsed = trigger.interval + 1;
            }

            // Start active timer if not toggle mode
            if (!trigger.toggle && trigger.activeDuration) {
              trigger.activeTimer = trigger.activeDuration;
            }

            // Callback
            if (trigger.onActivate) {
              trigger.onActivate(triggerEntity);
            }

            // Start cooldown if repeatable
            if (trigger.repeatable && trigger.cooldown) {
              trigger.cooldownTimer = trigger.cooldown;
              trigger.active = false; // Deactivate during cooldown
            }
          }
        }
      }

      // Handle active duration timer (for non-toggle mode) - always check this
      if (trigger.active && !trigger.toggle && trigger.activeTimer !== undefined) {
        trigger.activeTimer--;
        
        if (trigger.activeTimer <= 0) {
          trigger.active = false;
          trigger.activeTimer = undefined;
          
          if (trigger.onDeactivate) {
            trigger.onDeactivate(triggerEntity);
          }
        }
      }
    }
  }
}
