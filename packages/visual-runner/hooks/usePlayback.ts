import { useState, useEffect } from 'react';
import { useInput } from 'ink';
import type { Snapshot } from '../lib/test-executor.js';

export function usePlayback(
  snapshots: Snapshot[], 
  onRestart?: () => void,
  testStatus?: 'idle' | 'running' | 'complete',
  setTestStatus?: (status: 'idle' | 'running' | 'complete') => void
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
  
  // Update status based on playback position
  useEffect(() => {
    if (snapshots.length === 0 || !setTestStatus) return;
    
    if (testStatus === 'running' && isAtEnd && !isPlaying) {
      setTestStatus('complete');
    }
  }, [isAtEnd, isPlaying, snapshots.length, testStatus, setTestStatus]);
  
  // Auto-start playing when snapshots are loaded and status is running
  useEffect(() => {
    if (snapshots.length > 0 && testStatus === 'running' && !isPlaying) {
      setIsPlaying(true);
    }
  }, [snapshots.length, testStatus]);
  
  // Keyboard controls
  useInput((input, key) => {
    // If test is idle, enter/space should start it
    if (testStatus === 'idle' && (input === ' ' || key.return)) {
      if (onRestart) {
        onRestart(); // This will execute the test
      }
      return;
    }
    
    // If at end and test is complete, restart
    if (testStatus === 'complete' && (input === ' ' || key.return)) {
      if (onRestart) {
        onRestart();
      }
      return;
    }
    
    // Normal playback controls (when running)
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
    } else if (input === 'r') {
      if (onRestart) {
        onRestart();
      } else {
        setCurrentIndex(0);
        setIsPlaying(false);
      }
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
