import { renderHook, act } from "@testing-library/react";
import { useConversationMemory } from "../useConversationMemory";
import { describe, expect, it } from "vitest";

describe("useConversationMemory", () => {
  it("initializes with default state", () => {
    const { result } = renderHook(() => useConversationMemory());

    expect(result.current.memory.history).toHaveLength(0);
    expect(result.current.memory.sessionState).toBe('idle');
    expect(result.current.memory.progress).toBe(0);
    expect(result.current.memory.progressSnapshots).toHaveLength(0);
  });

  it("adds messages to history", () => {
    const { result } = renderHook(() => useConversationMemory());

    act(() => {
      result.current.addMessage('therapist', 'Hello client');
    });

    expect(result.current.memory.history).toHaveLength(1);
    expect(result.current.memory.history[0]).toEqual({
      role: 'therapist',
      message: 'Hello client'
    });
  });

  it("sets session state", () => {
    const { result } = renderHook(() => useConversationMemory());

    act(() => {
      result.current.setSessionState('active');
    });

    expect(result.current.memory.sessionState).toBe('active');
  });

  it("sets progress value", () => {
    const { result } = renderHook(() => useConversationMemory());

    act(() => {
      result.current.setProgress(50);
    });

    expect(result.current.memory.progress).toBe(50);
  });

  it("adds progress snapshots", () => {
    const { result } = renderHook(() => useConversationMemory());

    act(() => {
      result.current.addProgressSnapshot(25);
    });

    expect(result.current.memory.progressSnapshots).toHaveLength(1);
    expect(result.current.memory.progressSnapshots[0]!.value).toBe(25);
  });

  it("updates skill scores", () => {
    const { result } = renderHook(() => useConversationMemory());

    act(() => {
      result.current.updateSkillScore('Active Listening', 85);
    });

    expect(result.current.memory.progressMetrics.skillScores['Active Listening']).toBe(85);
  });

  it("resets session", () => {
    const { result } = renderHook(() => useConversationMemory());

    act(() => {
      result.current.addMessage('therapist', 'Test message');
      result.current.setSessionState('active');
      result.current.setProgress(75);
      result.current.resetSession();
    });

    expect(result.current.memory.history).toHaveLength(0);
    expect(result.current.memory.sessionState).toBe('idle');
    expect(result.current.memory.progress).toBe(0);
  });
});

// Copyright (c) Pixelated Empathy. All rights reserved.
// SPDX-License-Identifier: MIT

import { renderHook, act } from "@testing-library/react";
import { useConversationMemory, type ConversationMemory } from "../useConversationMemory";
import { describe, it, expect, beforeEach } from "vitest";

describe("useConversationMemory", () => {
  let initialState: Partial<ConversationMemory>;

  beforeEach(() => {
    initialState = {
      history: [{ role: "therapist", message: "Welcome!" }],
      context: { topic: "anxiety" },
      sessionState: "idle",
    };
  });

  it("initializes with default state", () => {
    const { result } = renderHook(() => useConversationMemory());
    expect(result.current.memory.history).toEqual([]);
    expect(result.current.memory.sessionState).toBe("idle");
    expect(result.current.progress).toBeDefined();
    expect(result.current.progressMetrics).toBeDefined();
  });

  it("initializes with provided state", () => {
    const { result } = renderHook(() => useConversationMemory(initialState));
    expect(result.current.memory.history).toHaveLength(1);
    expect(result.current.memory.context).toEqual({ topic: "anxiety" });
    expect(result.current.memory.sessionState).toBe("idle");
  });

  it("adds messages and updates metrics", () => {
    const { result } = renderHook(() => useConversationMemory(initialState));
    act(() => {
      result.current.addMessage("client", "Hello, I need help.");
      result.current.addMessage("therapist", "How can I support you?");
    });
    expect(result.current.memory.history).toHaveLength(3);
    expect(result.current.memory.history[2].role).toBe("therapist");
    expect(result.current.progressMetrics.totalMessages).toBeGreaterThanOrEqual(2);
    expect(result.current.progressMetrics.therapistMessages).toBeGreaterThanOrEqual(1);
    expect(result.current.progressMetrics.clientMessages).toBeGreaterThanOrEqual(1);
    expect(result.current.progressMetrics.responseTime).toBeGreaterThanOrEqual(0);
  });

  it("handles session state transitions and timing", () => {
    const { result } = renderHook(() => useConversationMemory(initialState));
    act(() => {
      result.current.setSessionState("active");
    });
    expect(result.current.memory.sessionState).toBe("active");
    act(() => {
      result.current.setSessionState("paused");
    });
    expect(result.current.memory.sessionState).toBe("paused");
    act(() => {
      result.current.setSessionState("ended");
    });
    expect(result.current.memory.sessionState).toBe("ended");
    expect(result.current.progressMetrics.activeTime).toBeGreaterThanOrEqual(0);
    expect(result.current.progressMetrics.sessionDuration).toBeGreaterThanOrEqual(0);
  });

  it("adds progress snapshots and milestones", () => {
    const { result } = renderHook(() => useConversationMemory(initialState));
    act(() => {
      result.current.setProgress(30);
      result.current.addProgressSnapshot({ timestamp: "2025-01-01T10:00:00Z", value: 30 });
      result.current.addMilestone("introduction");
    });
    expect(result.current.progress).toBe(30);
    expect(result.current.progressSnapshots).toEqual(
      expect.arrayContaining([{ timestamp: "2025-01-01T10:00:00Z", value: 30 }])
    );
    expect(result.current.progressMetrics.milestonesReached).toContain("introduction");
  });

  it("updates skill scores and conversation flow", () => {
    const { result } = renderHook(() => useConversationMemory(initialState));
    act(() => {
      result.current.updateSkillScore("Empathy", 90);
      result.current.updateConversationFlow(80);
    });
    expect(result.current.progressMetrics.skillScores?.Empathy).toBe(90);
    expect(result.current.progressMetrics.conversationFlow).toBe(80);
  });

  it("resets session and progress", () => {
    const { result } = renderHook(() => useConversationMemory(initialState));
    act(() => {
      result.current.addMessage("client", "Test");
      result.current.setProgress(50);
      result.current.resetSession();
    });
    expect(result.current.memory.history).toEqual([]);
    expect(result.current.memory.sessionState).toBe("idle");
    expect(result.current.progress).toBe(0);
    expect(result.current.progressMetrics.totalMessages ?? 0).toBe(0);
  });

  it("allows direct memory state update", () => {
    const { result } = renderHook(() => useConversationMemory(initialState));
    act(() => {
      result.current.setMemory((prev) => ({
        ...prev,
        context: { ...prev.context, updated: true },
      }));
    });
    expect(result.current.memory.context.updated).toBe(true);
  });
});