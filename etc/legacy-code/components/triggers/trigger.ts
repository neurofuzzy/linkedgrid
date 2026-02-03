/**
 * @component Trigger
 * @icon zap-off
 * @description Base trigger for event-based mechanics (touch, proximity, timers)
 * 
 * Trigger Component
 * 
 * Base component for trigger-based mechanics.
 * Triggers can be activated by various conditions (touch, proximity, time, etc.)
 * 
 * Examples:
 * - Pressure plates
 * - Proximity sensors
 * - Timer triggers
 * - Sequence triggers
 * 
 * @property {boolean} active - Whether this trigger is currently active
 * @property {boolean} repeatable - Whether trigger can be reused after activation
 * @property {number} cooldown - Cooldown time between activations (ticks)
 * @property {number} cooldownTimer - Remaining cooldown time
 * @property {string[]} activatorTags - Entity types that can activate this trigger
 * @property {number} maxActivations - Maximum number of activations
 * @property {number} activationCount - Current activation count
 * @property {boolean} toggle - Toggle mode or auto-deactivate
 * @property {number} activeDuration - How long to stay active (ticks, non-toggle)
 * @property {number} activeTimer - Timer for active duration
 */

import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export interface Trigger {
  /** Whether this trigger is currently active */
  active: boolean;
  
  /** Whether the trigger can be reused after activation */
  repeatable?: boolean;
  
  /** Cooldown time between activations (in ticks) */
  cooldown?: number;
  
  /** Internal: Remaining cooldown time */
  cooldownTimer?: number;
  
  /** Optional: Entity types that can activate this trigger */
  activatorTags?: string[];
  
  /** Optional: Callback when trigger activates */
  onActivate?: (trigger: Entity, activator?: Entity) => void;
  
  /** Optional: Callback when trigger deactivates */
  onDeactivate?: (trigger: Entity) => void;
  
  /** Optional: Maximum number of activations */
  maxActivations?: number;
  
  /** Internal: Current activation count */
  activationCount?: number;
  
  /** Whether the trigger stays active (toggle mode) or auto-deactivates */
  toggle?: boolean;
  
  /** For non-toggle triggers, how long to stay active (in ticks) */
  activeDuration?: number;
  
  /** Internal: Timer for active duration */
  activeTimer?: number;
}

export const TriggerComponent = defineComponent<Trigger>();

/**
 * @component PressurePlate
 * @icon square
 * @description Triggers when entities step on it
 * 
 * Pressure Plate Component
 * 
 * Triggers when entities step on it.
 * 
 * @property {number} weightRequired - Weight required to activate (number of entities)
 */
export interface PressurePlate extends Trigger {
  /** Weight required to activate (number of entities) */
  weightRequired?: number;
  
  /** Internal: Current entities on plate */
  entitiesOnPlate?: Set<Entity>;
}

export const PressurePlateComponent = defineComponent<PressurePlate>();

/**
 * Proximity Trigger Component
 * 
 * Triggers when entities enter radius.
 */
export interface ProximityTrigger extends Trigger {
  /** Detection radius */
  radius: number;
  
  /** Whether to trigger continuously while entities are in range */
  continuous?: boolean;
  
  /** Internal: Entities currently in range */
  entitiesInRange?: Set<Entity>;
}

export const ProximityTriggerComponent = defineComponent<ProximityTrigger>();

/**
 * Timer Trigger Component
 * 
 * Triggers after a specified time interval.
 */
export interface TimerTrigger extends Trigger {
  /** Interval between triggers (in ticks) */
  interval: number;
  
  /** Internal: Time elapsed since last trigger */
  elapsed?: number;
  
  /** Whether to start immediately or wait for first interval */
  startImmediately?: boolean;
}

export const TimerTriggerComponent = defineComponent<TimerTrigger>();

/**
 * Sequence Trigger Component
 * 
 * Requires triggers to be activated in sequence.
 */
export interface SequenceTrigger extends Trigger {
  /** IDs of triggers that must be activated in order */
  sequenceIds: string[];
  
  /** Current step in sequence */
  currentStep?: number;
  
  /** Optional: Time limit for completing sequence (in ticks) */
  timeLimit?: number;
  
  /** Internal: Time elapsed since sequence started */
  elapsed?: number;
  
  /** Whether to reset sequence on wrong trigger */
  resetOnWrong?: boolean;
}

export const SequenceTriggerComponent = defineComponent<SequenceTrigger>();
