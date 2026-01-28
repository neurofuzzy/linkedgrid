import { useState, useEffect, useRef } from 'react';
import type { Snapshot } from '../lib/test-executor.js';

// Discriminated union - makes invalid states impossible
type PlaybackState =
  | { type: 'paused'; currentIndex: number }
  | { type: 'playing'; currentIndex: number };

export function usePlayback(
  snapshots: Snapshot[],
  onAction?: () => void, // Called when Enter/Space pressed
  autoPlay?: boolean, // Auto-start when snapshots change
  onComplete?: () => void // Called when playback reaches end
) {
  const [state, setState] = useState<PlaybackState>({
    type: 'paused',
    currentIndex: 0,
  });
  const interval = 500;

  // Use ref for callback to avoid dependency issues
  const onCompleteRef = useRef(onComplete);
  const hasCalledCompleteRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Reset the complete flag when snapshots change
  useEffect(() => {
    hasCalledCompleteRef.current = false;
  }, [snapshots]);

  const isAtEnd = state.currentIndex >= snapshots.length - 1;

  // Reset and auto-play when snapshots change
  useEffect(() => {
    // Only reset if we're starting fresh (no snapshots before) or snapshots length changed
    setState((current) => {
      // If we're already showing a valid frame from the same snapshots, don't reset
      if (
        current.currentIndex < snapshots.length &&
        current.currentIndex >= 0
      ) {
        // Keep current position
        if (autoPlay && snapshots.length > 1 && current.type === 'paused') {
          return { type: 'playing', currentIndex: current.currentIndex };
        }
        return current;
      }

      // Otherwise reset to beginning
      if (autoPlay && snapshots.length > 1) {
        return { type: 'playing', currentIndex: 0 };
      } else {
        return { type: 'paused', currentIndex: 0 };
      }
    });
  }, [snapshots, autoPlay]);

  // Call onComplete when playback reaches the end
  useEffect(() => {
    if (
      state.type === 'playing' &&
      state.currentIndex >= snapshots.length - 1
    ) {
      setState({ type: 'paused', currentIndex: state.currentIndex });
      // Only call onComplete once per playback session
      if (onCompleteRef.current && !hasCalledCompleteRef.current) {
        hasCalledCompleteRef.current = true;
        onCompleteRef.current();
      }
    }
  }, [state.type, state.currentIndex, snapshots.length]);

  // Auto-play interval - only runs when playing
  useEffect(() => {
    if (state.type !== 'playing' || snapshots.length === 0) return;

    const timer = setInterval(() => {
      setState((current) => {
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
    startPlayback: () =>
      setState((s) => ({ type: 'playing', currentIndex: s.currentIndex })),
    togglePlayback: () =>
      setState((s) => ({
        type: s.type === 'playing' ? 'paused' : 'playing',
        currentIndex: s.currentIndex,
      })),
    stepForward: () => {
      setState((s) => ({
        type: 'paused',
        currentIndex: Math.min(s.currentIndex + 1, snapshots.length - 1),
      }));
    },
    stepBackward: () => {
      setState((s) => ({
        type: 'paused',
        currentIndex: Math.max(s.currentIndex - 1, 0),
      }));
    },
  };
}
