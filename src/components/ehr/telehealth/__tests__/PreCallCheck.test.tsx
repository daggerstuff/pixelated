// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest'

import '@testing-library/jest-dom/vitest'

import { PreCallCheck } from '../PreCallCheck'

// Type the mock media devices
interface MockMediaDeviceInfo {
  kind: 'videoinput' | 'audioinput'
  label: string
  deviceId: string
  groupId: string
}

// Mock getUserMedia stream
function createMockStream(): MediaStream {
  return {
    getTracks: () => [{ stop: vi.fn() } as unknown as MediaStreamTrack],
  } as unknown as MediaStream
}

describe('PreCallCheck', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the device check dialog', () => {
    render(<PreCallCheck onComplete={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText('Device Check')).toBeInTheDocument()
    expect(
      screen.getByText(/Verifying your camera and microphone/i),
    ).toBeInTheDocument()
  })

  it('shows camera and microphone as available when devices work', async () => {
    const mockDevices: MockMediaDeviceInfo[] = [
      {
        kind: 'videoinput',
        label: 'Test Camera',
        deviceId: 'cam1',
        groupId: 'g1',
      },
      {
        kind: 'audioinput',
        label: 'Test Mic',
        deviceId: 'mic1',
        groupId: 'g1',
      },
    ]

    const mockMediaDevices = {
      enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
      getUserMedia: vi.fn().mockResolvedValue(createMockStream()),
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true,
    })

    render(<PreCallCheck onComplete={vi.fn()} onCancel={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByText('✓ Available').length).toBe(2)
    })

    // Should show two ✓ Available (camera + mic)
    const availableCount = screen.getAllByText('✓ Available').length
    expect(availableCount).toBe(2)

    // Join button should be enabled
    const joinButton = screen.getByText('Join Session')
    expect(joinButton).not.toBeDisabled()
  })

  it('blocks join when camera is missing', async () => {
    const mockDevices: MockMediaDeviceInfo[] = [
      {
        kind: 'audioinput',
        label: 'Test Mic',
        deviceId: 'mic1',
        groupId: 'g1',
      },
    ]

    const mockMediaDevices = {
      enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
      getUserMedia: vi.fn().mockResolvedValue(createMockStream()),
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true,
    })

    render(<PreCallCheck onComplete={vi.fn()} onCancel={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('✗ Unavailable')).toBeInTheDocument()
    })

    // Join button should be disabled
    const joinButton = screen.getByText('Join Session')
    expect(joinButton).toBeDisabled()

    // Should show actionable error about no camera
    expect(screen.getByText(/No camera device found/i)).toBeInTheDocument()
  })

  it('blocks join when microphone getUserMedia fails', async () => {
    const mockDevices: MockMediaDeviceInfo[] = [
      {
        kind: 'videoinput',
        label: 'Test Camera',
        deviceId: 'cam1',
        groupId: 'g1',
      },
      {
        kind: 'audioinput',
        label: 'Test Mic',
        deviceId: 'mic1',
        groupId: 'g1',
      },
    ]

    const mockMediaDevices = {
      enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
      getUserMedia: vi
        .fn()
        .mockResolvedValueOnce(createMockStream()) // camera ok
        .mockRejectedValueOnce(new Error('Permission denied')), // mic fails
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true,
    })

    render(<PreCallCheck onComplete={vi.fn()} onCancel={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Microphone not accessible/i)).toBeInTheDocument()
    })

    const joinButton = screen.getByText('Join Session')
    expect(joinButton).toBeDisabled()
  })

  it('calls onComplete with result when join is clicked', async () => {
    const onComplete = vi.fn()
    const mockDevices: MockMediaDeviceInfo[] = [
      {
        kind: 'videoinput',
        label: 'Test Camera',
        deviceId: 'cam1',
        groupId: 'g1',
      },
      {
        kind: 'audioinput',
        label: 'Test Mic',
        deviceId: 'mic1',
        groupId: 'g1',
      },
    ]

    const mockMediaDevices = {
      enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
      getUserMedia: vi.fn().mockResolvedValue(createMockStream()),
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true,
    })

    render(<PreCallCheck onComplete={onComplete} onCancel={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Join Session')).not.toBeDisabled()
    })

    fireEvent.click(screen.getByText('Join Session'))

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        cameraAvailable: true,
        microphoneAvailable: true,
      }),
    )
  })

  it('calls onCancel when cancel is clicked', async () => {
    const onCancel = vi.fn()
    const mockMediaDevices = {
      enumerateDevices: vi.fn().mockResolvedValue([]),
      getUserMedia: vi.fn(),
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true,
    })

    render(<PreCallCheck onComplete={vi.fn()} onCancel={onCancel} />)

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
