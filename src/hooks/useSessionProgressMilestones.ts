// src/hooks/useSessionProgressMilestones.ts

import { useState } from 'react';
import type { SessionProgressMetrics } from '@/types/dashboard';

export interface ProgressMilestoneState {
  progress: number;
  progressSnapshots: Array<{ timestamp: string; value: number }>;
  progressMetrics: SessionProgressMetrics;
}

export interface UseSessionProgressMilestonesResult extends ProgressMilestoneState {
  setProgress: (value: number) => void;
  addProgressSnapshot: (value: number) => void;
  updateSkillScore: (skill: string, score: number) => void;
  updateConversationFlow: (score: number) => void;
  addMilestone: (milestone: string, progressValue?: number) => void;
  resetProgress: () => void;
  setProgressState: (state: Partial<ProgressMilestoneState>) => void;
}

const initialProgressMetrics: SessionProgressMetrics = {
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

export function useSessionProgressMilestones(
  initialState?: Partial<ProgressMilestoneState>
): UseSessionProgressMilestonesResult {
  const [progress, setProgressValue] = useState<number>(initialState?.progress ?? 0);
  const [progressSnapshots, setProgressSnapshots] = useState<Array<{ timestamp: string; value: number }>>(
    initialState?.progressSnapshots ?? []
  );
  const [progressMetrics, setProgressMetrics] = useState<SessionProgressMetrics>({
    ...initialProgressMetrics,
    ...initialState?.progressMetrics,
  });

  const setProgress = (value: number) => {
    setProgressValue(Math.max(0, Math.min(100, value)));
  };

  const addProgressSnapshot = (value: number) => {
    const clamped = Math.max(0, Math.min(100, value))
    setProgressSnapshots((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), value: clamped },
    ]);
  };

  const updateSkillScore = (skill: string, score: number) => {
    setProgressMetrics((prev) => ({
      ...prev,
      skillScores: {
        ...prev.skillScores,
        [skill]: Math.max(0, Math.min(100, score)),
      },
    }));
  };

  const updateConversationFlow = (score: number) => {
    setProgressMetrics((prev) => ({
      ...prev,
      conversationFlow: Math.max(0, Math.min(100, score)),
    }));
  };

  const addMilestone = (milestone: string, progressValue?: number) => {
    setProgressMetrics((prev) => ({
      ...prev,
      milestonesReached: [...prev.milestonesReached, milestone],
    }));
    setProgressSnapshots((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), value: progressValue ?? progress },
    ]);
  };

  const resetProgress = () => {
    setProgressValue(0);
    setProgressSnapshots([]);
    setProgressMetrics({ ...initialProgressMetrics });
  };

  const setProgressState = (state: Partial<ProgressMilestoneState>) => {
    if (state.progress !== undefined) {
      setProgressValue(state.progress);
    }
    if (state.progressSnapshots !== undefined && state.progressMetrics !== undefined) {
          setProgressMetrics(state.progressMetrics);
    }
    if (state.progressMetrics !== undefined) {
      setProgressMetrics(state.progressMetrics);
    }
  };

  return {
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
  };
}
