export interface HasAI {
  aiState: 'idle' | 'chase' | 'attack';
  /** Whether AI is currently active (defaults to true). Used by sleep-wake zones. */
  aiActive?: boolean;
}
