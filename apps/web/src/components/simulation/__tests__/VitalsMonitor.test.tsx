// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ScenarioEvent } from '@/hooks/useScenarioEvents'

import { VitalsMonitor } from '../VitalsMonitor'

import '@testing-library/jest-dom/vitest'

class MockAudioContext {
  static instances: MockAudioContext[] = []
  currentTime = 0
  destination = {}
  constructor() {
    MockAudioContext.instances.push(this)
  }
  createOscillator() {
    const osc = {
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    }
    return osc
  }
  createGain() {
    const gain = {
      gain: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
    return gain
  }
}

const audioHost = window as unknown as { AudioContext?: unknown }
const originalAudioContext = audioHost.AudioContext

describe('VitalsMonitor', () => {
  beforeEach(() => {
    MockAudioContext.instances = []
    audioHost.AudioContext = MockAudioContext
  })

  afterEach(() => {
    cleanup()
    audioHost.AudioContext = originalAudioContext
    vi.restoreAllMocks()
  })

  const baseEvent: ScenarioEvent = {
    updated_vitals: { heart_rate: 80, oxygen_saturation: 98 },
    emotional_state: 'calm',
  }

  it('renders vitals values from the event', () => {
    render(<VitalsMonitor event={baseEvent} status="connected" />)

    expect(screen.getByText('80 bpm')).toBeInTheDocument()
    expect(screen.getByText('98%')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows placeholder dashes when no event yet', () => {
    render(<VitalsMonitor event={null} status="connecting" />)

    expect(screen.getAllByText('--')).toHaveLength(4)
    expect(screen.getByText('Connecting…')).toBeInTheDocument()
  })

  it('shows alert and highlights value on heart rate spike above 120', () => {
    const spikeEvent: ScenarioEvent = {
      updated_vitals: { heart_rate: 135, oxygen_saturation: 98 },
    }
    render(<VitalsMonitor event={spikeEvent} status="connected" />)

    expect(screen.getByText(/Vital spike: heart rate 135/)).toBeInTheDocument()
    expect(screen.getByText('135 bpm')).toHaveClass('text-destructive')
  })

  it('plays audio tone exactly once per spike event', () => {
    const spikeEvent: ScenarioEvent = {
      updated_vitals: { heart_rate: 140 },
    }
    const { rerender } = render(
      <VitalsMonitor event={spikeEvent} status="connected" />,
    )
    rerender(<VitalsMonitor event={spikeEvent} status="connected" />)

    expect(MockAudioContext.instances).toHaveLength(1)
  })

  it('flags low oxygen saturation below 90', () => {
    render(
      <VitalsMonitor
        event={{ updated_vitals: { heart_rate: 80, oxygen_saturation: 85 } }}
        status="connected"
      />,
    )

    expect(screen.getByText(/SpO2 85%/)).toBeInTheDocument()
    expect(screen.getByText('85%')).toHaveClass('text-destructive')
  })

  it('does not show alert for normal vitals', () => {
    render(<VitalsMonitor event={baseEvent} status="connected" />)

    expect(screen.queryByText(/Vital spike/)).not.toBeInTheDocument()
  })

  it('shows reconnect button when disconnected', () => {
    const onReconnect = vi.fn()
    render(
      <VitalsMonitor
        event={null}
        status="disconnected"
        onReconnect={onReconnect}
      />,
    )

    expect(screen.getByText('Offline')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onReconnect).toHaveBeenCalledTimes(1)
  })
})
