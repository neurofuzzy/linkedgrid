import { useState, useEffect } from 'react';
import { useInput } from 'ink';
import type { Snapshot } from '../lib/test-executor.js';

export function usePlayback(
  snapshots: Snapshot[],
  onAction?: () => void,      // Called when Enter/Space pressed
  autoPlay?: boolean,          // Auto-start when snapshots change
  onComplete?: () => void      // Called when playback reaches end
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [interval] = useState(500);
  
  const isAtEnd = currentIndex >= snapshots.length - 1;
  
  // Reset to beginning when snapshots change
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [snapshots]);
  
  // Auto-start playing when autoPlay is true and we have snapshots
  useEffect(() => {
    if (autoPlay && snapshots.length > 1 && !isPlaying) {
      setIsPlaying(true);
    }
  }, [autoPlay, snapshots.length]);
  
  // Call onComplete when playback reaches the end
  useEffect(() => {
    if (isPlaying && currentIndex >= snapshots.length - 1 && onComplete) {
      setIsPlaying(false);
      onComplete();
    }
  }, [isPlaying, currentIndex, snapshots.length, onComplete]);
  
  // Keyboard controls
  useInput((input, key) => {
    // Enter or Space triggers action if defined
    if ((input === ' ' || key.return) && onAction) {
      onAction();
      return;
    }
    
    // Normal playback controls
    if (input === ' ') {
      setIsPlaying(prev => !prev);
    } else if (key.return) {
      setIsPlaying(true);
    } else if (key.rightArrow) {
      if (currentIndex < snapshots.length - 1) {
        setCurrentIndex(i => i + 1);
      }
    } else if (key.leftArrow) {
      if (currentIndex > 0) {
        setCurrentIndex(i => i - 1);
      }
    } else if (input === 'r' && onAction) {
      onAction();
    }
  });
  
  // Auto-play interval
  useEffect(() => {
    if (!isPlaying || snapshots.length === 0) return;
    
    const timer = setInterval(() => {
      setCurrentIndex(i => {
        if (i >= snapshots.length - 1) {
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, interval);
    
    return () => clearInterval(timer);
  }, [isPlaying, interval, snapshots.length]);
  
  const snapshot = snapshots[currentIndex] || null;
  
  return {
    currentIndex,
    isPlaying,
    interval,
    snapshot,
    isAtEnd,
    startPlayback: () => setIsPlaying(true)
  };
}
