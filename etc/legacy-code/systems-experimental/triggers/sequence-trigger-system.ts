/**
 * Sequence Trigger System
 * 
 * Manages sequence-based triggers that require activation in a specific order.
 * Useful for puzzles, codes, and multi-step challenges.
 */

import { System } from '@basegrid/ecs';
import { SequenceTriggerComponent, TriggerComponent } from '@basegrid/gameplay';
import type { Entity } from '@basegrid/ecs';

export class SequenceTriggerSystem extends System {
  /**
   * Activate a step in a sequence
   * Call this when an entity activates a trigger that's part of a sequence
   */
  activateStep(sequenceEntity: Entity, triggerId: string): void {
    const sequence = this.world.getComponent(sequenceEntity, SequenceTriggerComponent);
    if (!sequence) return;

    // Initialize step if needed
    if (sequence.currentStep === undefined) {
      sequence.currentStep = 0;
      sequence.elapsed = 0;
    }

    // Check if this is the correct trigger for the current step
    const expectedTriggerId = sequence.sequenceIds[sequence.currentStep];
    
    if (triggerId === expectedTriggerId) {
      // Correct trigger!
      sequence.currentStep++;
      sequence.elapsed = 0; // Reset timer for next step
      
      // Check if sequence completed
      if (sequence.currentStep >= sequence.sequenceIds.length) {
        // Sequence complete!
        sequence.active = true;
        sequence.activationCount = (sequence.activationCount ?? 0) + 1;
        
        if (sequence.onActivate) {
          sequence.onActivate(sequenceEntity);
        }
        
        // Reset for next attempt if repeatable
        if (sequence.repeatable) {
          sequence.currentStep = 0;
          sequence.elapsed = 0;
        }
      }
    } else if (sequence.resetOnWrong) {
      // Wrong trigger - reset sequence
      sequence.currentStep = 0;
      sequence.elapsed = 0;
    }
  }

  /**
   * Helper to register a trigger activation with all sequences
   */
  registerTriggerActivation(triggerId: string): void {
    for (const [sequenceEntity, sequence] of this.world.query(SequenceTriggerComponent)) {
      // Skip if already completed and not repeatable
      if (sequence.active && !sequence.repeatable) continue;
      
      // Skip if max activations reached
      if (sequence.maxActivations !== undefined) {
        const currentActivations = sequence.activationCount ?? 0;
        if (currentActivations >= sequence.maxActivations) continue;
      }
      
      this.activateStep(sequenceEntity, triggerId);
    }
  }

  update(_dt: number): void {
    for (const [sequenceEntity, sequence] of this.world.query(SequenceTriggerComponent)) {
      // Initialize if needed
      if (sequence.currentStep === undefined) {
        sequence.currentStep = 0;
      }
      
      if (sequence.elapsed === undefined) {
        sequence.elapsed = 0;
      }

      // Skip if completed and not repeatable
      if (sequence.active && !sequence.repeatable) continue;

      // Handle time limit
      if (sequence.timeLimit !== undefined && sequence.currentStep > 0) {
        sequence.elapsed++;
        
        if (sequence.elapsed >= sequence.timeLimit) {
          // Time expired - reset sequence
          sequence.currentStep = 0;
          sequence.elapsed = 0;
          
          if (sequence.onDeactivate) {
            sequence.onDeactivate(sequenceEntity);
          }
        }
      }
    }
  }
}
