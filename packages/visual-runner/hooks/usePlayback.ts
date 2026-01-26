import { useState, useEffect, useRef } from 'react';
import type { Snapshot } from '../lib/test-executor.js';

// Discriminated union - makes invalid states impossible
type PlaybackState =
  | { type: 'paused'; currentIndex: number }
  | { type: 'playing'; currentIndex: number };

export function usePlayback(
  snapshots: Snapshot[],
  onAction?: () => void,      // Called when Enter/Space pressed
  autoPlay?: boolean,          // Auto-start when snapshots change
  onComplete?: () => void      // Called when playback reaches end
) {
  const [state, setState] = useState<PlaybackState>({ 
    type: 'paused', 
    currentIndex: 0 
  });
  const interval = 500;
  
  // Use refs for callbacks to avoid dependency issues
  const onCompleteRef = useRef(onComplete);
  const stateRef = useRef(state);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
    stateRef.current = state;
  }, [onComplete, state]);
  
  const isAtEnd = state.currentIndex >= snapshots.length - 1;
  
  // Reset to beginning when snapshots change
  useEffect(() => {
    setState({ type: 'paused', currentIndex: 0 });
  }, [snapshots]);
  
  // Auto-start playing when autoPlay is true and we have snapshots
  // Only triggers on snapshots change or autoPlay change, not on state changes
  useEffect(() => {
    if (autoPlay && snapshots.length > 1) {
      setState({ type: 'playing', currentIndex: 0 });
    }
  }, [autoPlay, snapshots]);
  
  // Call onComplete when playback reaches the end
  useEffect(() => {
    if (state.type === 'playing' && state.currentIndex >= snapshots.length - 1) {
      setState({ type: 'paused', currentIndex: state.currentIndex });
      if (onCompleteRef.current) {
        onCompleteRef.current();
      }
    }
  }, [state.type, state.currentIndex, snapshots.length]);
  
  // Auto-play interval - only runs when playing
  useEffect(() => {
    if (state.type !== 'playing' || snapshots.length === 0) return;
    
    const timer = setInterval(() => {
      // Check ref for most current state
      if (stateRef.current.type !== 'playing') return;
      
      setState(current => {
        // Type guard ensures we only advance when playing
        if (current.type !== 'playing') return current;
        
        if (current.currentIndex >= snapshots.length - 1) {
          return { type: 'paused', currentIndex: current.currentIndex };
        }
        return { type: 'playing', currentIndex: current.currentIndex + 1 };
      });
    }, interval);
    
    return () => clearInterval(timer);
  }, [state.type, interval, snapshots.length]);
  
  const snapshot = snapshots[state.currentIndex] || null;
  
  return {
    currentIndex: state.currentIndex,
    isPlaying: state.type === 'playing',
    interval,
    snapshot,
    isAtEnd,
    startPlayback: () => setState(s => ({ type: 'playing', currentIndex: s.currentIndex })),
    togglePlayback: () => setState(s => ({
      type: s.type === 'playing' ? 'paused' : 'playing',
      currentIndex: s.currentIndex
    })),
    stepForward: () => {
      setState(s => ({
        type: 'paused',
        currentIndex: Math.min(s.currentIndex + 1, snapshots.length - 1)
      }));
    },
    stepBackward: () => {
      setState(s => ({
        type: 'paused',
        currentIndex: Math.max(s.currentIndex - 1, 0)
      }));
    }
  };
}
