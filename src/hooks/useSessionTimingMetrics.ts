import { useEffect } from 'react';
import type { SessionProgressMetrics } from '@/types/dashboard';

type SetMemory = React.Dispatch<React.SetStateAction<{
  history: Array<{ role: 'therapist' | 'client'; message: string }>;
  context: Record<string, any>;
  sessionState: 'idle' | 'active' | 'paused' | 'ended';
  progress: number;
  progressSnapshots: Array<{ timestamp: string; value: number }>;
  progressMetrics: SessionProgressMetrics;
}>>;

/**
 * Custom hook to handle session timing and metrics updates.
 * Extracted from useConversationMemory for single responsibility.
 */
export function useSessionTimingMetrics(
  sessionState: 'idle' | 'active' | 'paused' | 'ended',
  setMemory: SetMemory,
  sessionStartTimeRef: React.MutableRefObject<number>,
  lastActiveTimeRef: React.MutableRefObject<number>
) {
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionState === 'active') {
        setMemory(prev => ({
          ...prev,
          progressMetrics: {
            ...prev.progressMetrics,
            sessionDuration: Math.floor((Date.now() - sessionStartTimeRef.current) / 1000),
            activeTime: prev.progressMetrics.activeTime + Math.floor((Date.now() - lastActiveTimeRef.current) / 1000)
          }
        }));
        lastActiveTimeRef.current = Date.now();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState, setMemory, sessionStartTimeRef, lastActiveTimeRef]);
}