import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'

import SearchFilters, { type SearchFiltersState } from './SearchFilters'

// Setup Mock for onChange
const mockOnChange = vi.fn()

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const defaultFilters: SearchFiltersState = {
  topics: [],
  minRelevance: 0,
  publishers: [],
  sortBy: 'relevance',
}

const filledFilters: SearchFiltersState = {
  topics: ['CBT'],
  minRelevance: 0.5,
  publishers: [],
  sortBy: 'year_desc',
}

describe('SearchFilters', () => {
  it('renders all filter sections', () => {
    render(<SearchFilters filters={defaultFilters} onChange={mockOnChange} />)

    expect(screen.getByText('Advanced Filters')).not.toBeNull()
    expect(screen.getByLabelText('Year From')).not.toBeNull()
    expect(screen.getByLabelText('Year To')).not.toBeNull()
    expect(screen.getByText('Therapeutic Topics')).not.toBeNull()
    expect(screen.getByText('Min Relevance Score')).not.toBeNull()
  })

  it('toggles topics correctly', () => {
    render(<SearchFilters filters={defaultFilters} onChange={mockOnChange} />)

    const topicButton = screen.getByText('CBT')
    fireEvent.click(topicButton)

    // Note: The component uses local state, so we expect the button style to change
    // AND handleApply calls onChange. But wait, toggleTopic updates local state.
    // We verify the button indicates it is pressed or selected visually (class check or aria-pressed).
    // After clicking, it should be pressed (true)
    expect(topicButton.getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onChange with new filters when Apply is clicked', () => {
    render(<SearchFilters filters={defaultFilters} onChange={mockOnChange} />)

    const topicButton = screen.getByText('Trauma')
    fireEvent.click(topicButton)

    const applyButton = screen.getByText('Apply Filters')
    fireEvent.click(applyButton)

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        topics: ['Trauma'],
      }),
    )
  })

  it('resets filters when Reset is clicked', () => {
    render(<SearchFilters filters={filledFilters} onChange={mockOnChange} />)

    const resetButton = screen.getByText('Reset')
    fireEvent.click(resetButton)

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        topics: [],
        minRelevance: 0,
        sortBy: 'relevance',
      }),
    )
  })
})
