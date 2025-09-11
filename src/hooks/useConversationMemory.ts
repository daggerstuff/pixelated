import { useState, useEffect, useRef } from 'react';
import type { SessionProgressMetrics } from '@/types/dashboard';

export interface ConversationMemory {
  history: Array<{ role: 'therapist' | 'client'; message: string }>;
  context: Record<string, any>;
  sessionState: 'idle' | 'active' | 'paused' | 'ended';
  progress: number; // 0-100 session progress
  progressSnapshots: Array<{ timestamp: string; value: number }>; // milestone snapshots
  progressMetrics: SessionProgressMetrics;
}

export function useConversationMemory(initialState?: Partial<ConversationMemory>) {
  const [memory, setMemory] = useState<ConversationMemory>({
    history: [],
    context: {},
    sessionState: 'idle',
    progress: 0,
    progressSnapshots: [],
    progressMetrics: {
      totalMessages: 0,
      therapistMessages: 0,
      clientMessages: 0,
      sessionDuration: 0,
      activeTime: 0,
      skillScores: {},
      responseTime: 0,
      conversationFlow: 0,
      milestonesReached: [],
    },
    ...initialState,
  });

  // Track session timing
  const sessionStartTimeRef = useRef<number>(Date.now());
  const lastActiveTimeRef = useRef<number>(Date.now());
  const lastMessageTimeRef = useRef<number>(Date.now());

  // Update session duration metrics
  useEffect(() => {
    const interval = setInterval(() => {
      if (memory.sessionState === 'active') {
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
  }, [memory.sessionState]);

  const addMessage = (role: 'therapist' | 'client', message: string) => {
    const currentTime = Date.now();
    const responseTime = (currentTime - lastMessageTimeRef.current) / 1000; // in seconds

    setMemory((prev) => ({
      ...prev,
      history: [...prev.history, { role, message }],
      progressMetrics: {
        ...prev.progressMetrics,
        totalMessages: prev.progressMetrics.totalMessages + 1,
        therapistMessages: role === 'therapist' ? prev.progressMetrics.therapistMessages + 1 : prev.progressMetrics.therapistMessages,
        clientMessages: role === 'client' ? prev.progressMetrics.clientMessages + 1 : prev.progressMetrics.clientMessages,
        responseTime: prev.progressMetrics.responseTime > 0
          ? (prev.progressMetrics.responseTime + responseTime) / 2 // average response time
          : responseTime
      }
    }));

    lastMessageTimeRef.current = currentTime;
  };

  const setSessionState = (state: ConversationMemory['sessionState']) => {
    setMemory((prev) => {
      // Update active time when pausing
      if (state === 'paused' && prev.sessionState === 'active') {
        return {
          ...prev,
          sessionState: state,
          progressMetrics: {
            ...prev.progressMetrics,
            activeTime: prev.progressMetrics.activeTime + Math.floor((Date.now() - lastActiveTimeRef.current) / 1000)
          }
        };
      } else {
        if (state === 'active' && prev.sessionState !== 'active') {
          lastActiveTimeRef.current = Date.now();
        }
        return { ...prev, sessionState: state };
      }
    });
  };

  const setProgress = (value: number) => {
    setMemory((prev) => ({ ...prev, progress: Math.max(0, Math.min(100, value)) }));
  };

  const addProgressSnapshot = (value: number) => {
    setMemory((prev) => ({
      ...prev,
      progressSnapshots: [
        ...prev.progressSnapshots,
        { timestamp: new Date().toISOString(), value }
      ]
    }));
  };

  const updateSkillScore = (skill: string, score: number) => {
    setMemory((prev) => ({
      ...prev,
      progressMetrics: {
        ...prev.progressMetrics,
        skillScores: {
          ...prev.progressMetrics.skillScores,
          [skill]: Math.max(0, Math.min(100, score))
        }
      }
    }));
  };

  const updateConversationFlow = (score: number) => {
    setMemory((prev) => ({
      ...prev,
      progressMetrics: {
        ...prev.progressMetrics,
        conversationFlow: Math.max(0, Math.min(100, score))
      }
    }));
  };

  const addMilestone = (milestone: string) => {
    setMemory((prev) => ({
      ...prev,
      progressMetrics: {
        ...prev.progressMetrics,
        milestonesReached: [...prev.progressMetrics.milestonesReached, milestone]
      },
      progressSnapshots: [
        ...prev.progressSnapshots,
        { timestamp: new Date().toISOString(), value: prev.progress }
      ]
    }));
  };

  const resetSession = () => {
    sessionStartTimeRef.current = Date.now();
    lastActiveTimeRef.current = Date.now();
    lastMessageTimeRef.current = Date.now();

    setMemory((prev) => ({
      ...prev,
      history: [],
      context: {},
      sessionState: 'idle',
      progress: 0,
      progressSnapshots: [],
      progressMetrics: {
        totalMessages: 0,
        therapistMessages: 0,
        clientMessages: 0,
        sessionDuration: 0,
        activeTime: 0,
        skillScores: {},
        responseTime: 0,
        conversationFlow: 0,
        milestonesReached: [],
      }
    }));
  };

  return {
    memory,
    addMessage,
    setSessionState,
    setProgress,
    addProgressSnapshot,
    updateSkillScore,
    updateConversationFlow,
    addMilestone,
    resetSession,
    setMemory,
  };
}
