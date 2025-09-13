/**
 * @file useConversationMemory.ts
 * @module hooks/useConversationMemory
 * @description
 *   Provides a modular React hook for managing conversational session state, history, and progress metrics
 *   in the Pixelated Empathy dashboard. This hook composes session timing, progress/milestone, and message
 *   management logic into a single, ergonomic API for therapist-client chat and analytics.
 *
 *   - Session timing and metrics logic is delegated to `useSessionTimingMetrics`.
 *   - Progress and milestone logic is delegated to `useSessionProgressMilestones`.
 *   - Message and session state logic is managed locally and integrated with the above.
 *
 *   All state is strictly typed and designed for extensibility and testability.
 *
 *   Usage:
 *     const {
 *       memory, progress, progressSnapshots, progressMetrics,
 *       addMessage, setSessionState, setProgress, addProgressSnapshot,
 *       updateSkillScore, updateConversationFlow, addMilestone, resetSession, setMemory
 *     } = useConversationMemory();
 */

// Session timing/metrics logic (active/idle/paused/ended spans, durations, etc.)
// Progress and milestone tracking (progress %, skill scores, milestones, etc.)
import { useState, useRef, useEffect } from 'react';
import { useSessionTimingMetrics } from './useSessionTimingMetrics';
import { useSessionProgressMilestones } from './useSessionProgressMilestones';
import type { SessionProgressMetrics } from '@/types/dashboard';

/**
 * Represents the conversational memory state for a session.
 * - `history`: Array of chat messages with role and message.
 * - `context`: Arbitrary session context (e.g., topic, metadata).
 * - `sessionState`: Current session state ('idle', 'active', 'paused', 'ended').
 */
interface ConversationMemory {
  history: Array<{ role: 'therapist' | 'client'; message: string }>;
  context: Record<string, any>;
  sessionState: 'idle' | 'active' | 'paused' | 'ended';
}

/**
 * Internal memory state used by timing and progress hooks. Extends ConversationMemory
 * with progress-related fields expected by `useSessionTimingMetrics`.
 */
interface MemoryState extends ConversationMemory {
  progress: number;
  progressSnapshots: Array<{ timestamp: string; value: number }>;
  progressMetrics: SessionProgressMetrics;
}

/**
 * React hook for managing conversational session memory, progress, and metrics.
 *
 * @param initialState - Optional initial state for memory, progress, and metrics.
 * @returns Object containing:
 *   - memory: ConversationMemory (history, context, sessionState)
 *   - progress: number (current progress %)
 *   - progressSnapshots: Array of progress snapshots
 *   - progressMetrics: SessionProgressMetrics (message counts, response time, etc.)
 *   - addMessage: (role, message) => void (add chat message and update metrics)
 *   - setSessionState: (state) => void (update session state and metrics)
 *   - setProgress, addProgressSnapshot, updateSkillScore, updateConversationFlow, addMilestone, resetSession, setMemory: utility functions
 *
 * Usage:
 *   const {
 *     memory, progress, progressSnapshots, progressMetrics,
 *     addMessage, setSessionState, setProgress, addProgressSnapshot,
 *     updateSkillScore, updateConversationFlow, addMilestone, resetSession, setMemory
 *   } = useConversationMemory();
 */
const DEFAULT_MEMORY = {
  history: [],
  context: {},
  sessionState: 'idle' as const,
  progress: 0,
  progressSnapshots: [] as Array<{ timestamp: string; value: number }>,
  progressMetrics: {
    totalMessages: 0,
    therapistMessages: 0,
    clientMessages: 0,
    responsesCount: 0,
    sessionDuration: 0,
    activeTime: 0,
    skillScores: {},
    responseTime: 0,
    conversationFlow: 0,
    milestonesReached: [],
    lastMilestoneTime: undefined,
  } as SessionProgressMetrics,
} as const

export function useConversationMemory(initialState?: Partial<MemoryState>) {
  const [memory, setMemory] = useState<MemoryState>({
    ...DEFAULT_MEMORY,
    ...initialState,
  } as MemoryState);

  // Extracted session timing and metrics logic
  const sessionStartTimeRef = useRef<number>(Date.now());
  const lastActiveTimeRef = useRef<number>(Date.now());
  // Lazily track the timestamp of the last message. Start as null so the initial
  // mount -> first-message interval isn't treated as a response time.
  const lastMessageTimeRef = useRef<number | null>(null);

  useSessionTimingMetrics(memory.sessionState, setMemory, sessionStartTimeRef, lastActiveTimeRef);

  // Progress/milestone logic extracted to hook
  const {
    progress,
    progressSnapshots,
    progressMetrics,
    setProgress,
    addProgressSnapshot,
    updateSkillScore,
    updateConversationFlow,
    addMilestone,
    resetProgress,
    setProgressState,
  } = useSessionProgressMilestones({
    progress: initialState?.progress,
    progressSnapshots: initialState?.progressSnapshots,
    progressMetrics: initialState?.progressMetrics,
  });

  /**
   * Adds a new message to the conversation history and updates progress metrics.
   * - Increments message counts for therapist/client.
   * - Updates running average response time.
   * - Updates last message timestamp.
   */
  const addMessage = (role: 'therapist' | 'client', message: string) => {
    const currentTime = Date.now();
    // If there's no previous message recorded, skip response-time calculation so
    // the first message doesn't produce a skewed response time.
    const responseTime = lastMessageTimeRef.current === null
      ? null
      : (currentTime - lastMessageTimeRef.current) / 1000; // in seconds

    setMemory((prev) => ({
      ...prev,
      history: [...prev.history, { role, message }],
    }));

    // Update progress metrics for message counts and (optionally) response time.
    // Manually update progressMetrics since setProgressState does not accept a function updater.
    // Only include response-time statistics when we have a valid previous timestamp.
    const prevResponses = progressMetrics.responsesCount ?? 0;
    const prevAvg = progressMetrics.responseTime ?? 0;

    const updatedMetrics: typeof progressMetrics = {
      ...progressMetrics,
      totalMessages: (progressMetrics.totalMessages ?? 0) + 1,
      therapistMessages: role === 'therapist'
        ? (progressMetrics.therapistMessages ?? 0) + 1
        : progressMetrics.therapistMessages ?? 0,
      clientMessages: role === 'client'
        ? (progressMetrics.clientMessages ?? 0) + 1
        : progressMetrics.clientMessages ?? 0,
    } as typeof progressMetrics;

    if (responseTime !== null) {
      // Update running average response time and response count
      const newResponses = prevResponses + 1;
      const newAvg = ((prevAvg * prevResponses) + responseTime) / newResponses;
      updatedMetrics.responseTime = newAvg;
      updatedMetrics.responsesCount = newResponses;
    }

    setProgressState({ progressMetrics: updatedMetrics });

  // Record the timestamp for subsequent messages
  lastMessageTimeRef.current = currentTime;
  };

  /**
   * Updates the session state and synchronizes timing/metrics.
   * - Handles transitions: idle→active, active→ended, active→paused.
   * - Flushes active time and session duration as needed.
   */
  const setSessionState = (state: ConversationMemory['sessionState']) => {
    const prevState = memory.sessionState ?? 'idle';

    // Transition: non-active → active (immediate start)
    if (state === 'active' && prevState !== 'active') {
      lastActiveTimeRef.current = Date.now();
      setMemory((prev) => ({ ...prev, sessionState: state }));
      setProgressState({ progressMetrics: { ...progressMetrics } });
      return;
    }

    // Transition: active → paused (flush active time)
    if (prevState === 'active' && state === 'paused') {
      const now = Date.now();
      const elapsed = Math.floor((now - lastActiveTimeRef.current) / 1000);
      setMemory((prev) => ({ ...prev, sessionState: state }));
      setProgressState({
        progressMetrics: {
          ...progressMetrics,
          activeTime: (progressMetrics.activeTime ?? 0) + elapsed,
        },
      });
      return;
    }

    // Transition: active → ended (flush active time and set session duration)
    if (prevState === 'active' && state === 'ended') {
      const now = Date.now();
      const elapsed = Math.floor((now - lastActiveTimeRef.current) / 1000);
      setMemory((prev) => ({ ...prev, sessionState: state }));
      setProgressState({
        progressMetrics: {
          ...progressMetrics,
          activeTime: (progressMetrics.activeTime ?? 0) + elapsed,
          sessionDuration: Math.floor((now - sessionStartTimeRef.current) / 1000),
        },
      });
      return;
    }

    // Default: other transitions simply update state and keep metrics as-is
    setMemory((prev) => ({ ...prev, sessionState: state }));
    setProgressState({ progressMetrics: { ...progressMetrics } });
  };

  const resetSession = () => {
  sessionStartTimeRef.current = Date.now();
  lastActiveTimeRef.current = Date.now();
  // Clear lastMessageTime so the next message is treated as the first.
  // This ensures first-sample behavior is preserved after reset.
  lastMessageTimeRef.current = null;
    setMemory((prev) => ({
      ...prev,
      history: [],
      context: {},
      sessionState: 'idle',
    }));

    resetProgress();
  };

  // Update session duration / active time every second only while active
  useEffect(() => {
    if (memory.sessionState !== 'active') {
      return
    }

    const interval = setInterval(() => {
      setMemory(prev => ({
        ...prev,
        progressMetrics: {
          ...prev.progressMetrics,
          sessionDuration: Math.floor((Date.now() - sessionStartTimeRef.current) / 1000),
          activeTime: (prev.progressMetrics.activeTime ?? 0) + Math.floor((Date.now() - lastActiveTimeRef.current) / 1000),
        }
      }))
      lastActiveTimeRef.current = Date.now()
    }, 1000)

    return () => clearInterval(interval)
  }, [memory.sessionState])

  return {
    memory,
    progress,
    progressSnapshots,
    progressMetrics,
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
