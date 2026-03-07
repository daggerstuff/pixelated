import { render, screen } from '@testing-library/react'
import { ComparativeProgressDisplay } from '../ComparativeProgressDisplay'
import { vi } from 'vitest'

// Mock the useComparativeProgress hook
vi.mock('../../../hooks/useComparativeProgress', () => ({
  useComparativeProgress: vi.fn(() => ({
    data: null,
    loading: false,
    error: 'Invalid user ID: must be a non-empty string',
    refetch: vi.fn(),
  })),
}))

describe('ComparativeProgressDisplay', () => {
  it('renders error state when userId is invalid', () => {
    render(<ComparativeProgressDisplay userId="" />)
    expect(screen.getByText(/Error loading data/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Invalid user ID: must be a non-empty string/i),
    ).toBeInTheDocument()
  })

  it('renders retry button in error state', () => {
    render(<ComparativeProgressDisplay userId="" />)
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
