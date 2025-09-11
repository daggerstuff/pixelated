import { useState, useRef } from 'react';
import type { SessionProgressMetrics } from '@/types/dashboard';

/**
 * Hook for managing conversation message history and message-related metrics.
 * Encapsulates message state, message addition, and message metrics calculation.
 */
export interface ConversationMessage {
  role: 'therapist' | 'client';
  message: string;
}

export interface UseConversationMessagesResult {
  history: ConversationMessage[];
  progressMetrics: SessionProgressMetrics;
  addMessage: (role: 'therapist' | 'client', message: string) => void;
  resetMessages: () => void;
}

const INITIAL_METRICS: SessionProgressMetrics = {
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
};

/**
 * useConversationMessages
 * Handles message history and message-related metrics for a conversation session.
 */
export function useConversationMessages(
  initialHistory: ConversationMessage[] = [],
  initialMetrics: Partial<SessionProgressMetrics> = {}
): UseConversationMessagesResult {
  const [history, setHistory] = useState<ConversationMessage[]>(initialHistory);
  const [progressMetrics, setProgressMetrics] = useState<SessionProgressMetrics>({
    ...INITIAL_METRICS,
    ...initialMetrics,
  });

  // Track last message time for response time calculation
  const lastMessageTimeRef = useRef<number>(Date.now());

  /**
   * Adds a message to the conversation history and updates metrics.
   */
  const addMessage = (role: 'therapist' | 'client', message: string) => {
    const currentTime = Date.now();
    const responseTime = (currentTime - lastMessageTimeRef.current) / 1000; // seconds

    setHistory((prev) => [...prev, { role, message }]);
    setProgressMetrics((prev) => {
      const newTotalMessages = prev.totalMessages + 1;
      const newTherapistMessages =
        role === 'therapist' ? prev.therapistMessages + 1 : prev.therapistMessages;
      const newClientMessages =
        role === 'client' ? prev.clientMessages + 1 : prev.clientMessages;
      const newResponsesCount = (prev.responsesCount || 0) + 1;
      const prevAvg = prev.responseTime || 0;
      const newResponseTime =
        ((prevAvg * (newResponsesCount - 1)) + responseTime) / newResponsesCount;

      return {
        ...prev,
        totalMessages: newTotalMessages,
        therapistMessages: newTherapistMessages,
        clientMessages: newClientMessages,
        responsesCount: newResponsesCount,
        responseTime: newResponseTime,
      };
    });

    lastMessageTimeRef.current = currentTime;
  };

  /**
   * Resets the message history and metrics.
   */
  const resetMessages = () => {
    setHistory([]);
    setProgressMetrics({ ...INITIAL_METRICS });
    lastMessageTimeRef.current = Date.now();
  };

  return {
    history,
    progressMetrics,
    addMessage,
    resetMessages,
  };
}