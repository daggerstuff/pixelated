// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { useConversationMemory } from '../useConversationMemory'
import { describe, expect, it } from 'vitest'

describe('useConversationMemory', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useConversationMemory())

    expect(result.current.memory.history).toHaveLength(0)
    expect(result.current.memory.sessionState).toBe('idle')
    expect(result.current.memory.progress).toBe(0)
    expect(result.current.memory.progressSnapshots).toHaveLength(0)
  })

  it('adds messages to history', () => {
    const { result } = renderHook(() => useConversationMemory())

    act(() => {
      result.current.addMessage('therapist', 'Hello client')
    })

    expect(result.current.memory.history).toHaveLength(1)
    expect(result.current.memory.history[0]).toEqual({
      role: 'therapist',
      message: 'Hello client',
    })
  })

  it('sets session state', () => {
    const { result } = renderHook(() => useConversationMemory())

    act(() => {
      result.current.setSessionState('active')
    })

    expect(result.current.memory.sessionState).toBe('active')
  })

  it('sets progress value', () => {
    const { result } = renderHook(() => useConversationMemory())

    act(() => {
      result.current.setProgress(50)
    })

    expect(result.current.memory.progress).toBe(50)
  })

  it('adds progress snapshots', () => {
    const { result } = renderHook(() => useConversationMemory())

    act(() => {
      result.current.addProgressSnapshot(25)
    })

    expect(result.current.memory.progressSnapshots).toHaveLength(1)
    expect(result.current.memory.progressSnapshots[0]!.value).toBe(25)
  })

  it('updates skill scores', () => {
    const { result } = renderHook(() => useConversationMemory())

    act(() => {
      result.current.updateSkillScore('Active Listening', 85)
    })

    expect(
      result.current.memory.progressMetrics.skillScores['Active Listening'],
    ).toBe(85)
  })

  it('resets session', () => {
    const { result } = renderHook(() => useConversationMemory())

    act(() => {
      result.current.addMessage('therapist', 'Test message')
      result.current.setSessionState('active')
      result.current.setProgress(75)
      result.current.resetSession()
    })

    expect(result.current.memory.history).toHaveLength(0)
    expect(result.current.memory.sessionState).toBe('idle')
    expect(result.current.memory.progress).toBe(0)
  })
})

// Copyright (c) Pixelated Empathy. All rights reserved.
// SPDX-License-Identifier: MIT
