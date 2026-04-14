// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, expect, it, afterEach, vi } from 'vitest'

import SearchFilters, { type SearchFiltersState } from './SearchFilters'

import '@testing-library/jest-dom/vitest'

const defaultFilters: SearchFiltersState = {
  topics: [],
  minRelevance: 0,
  publishers: [],
  sortBy: 'relevance',
}

describe('SearchFilters', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders with default values', () => {
    const mockOnChange = vi.fn()
    render(
      <SearchFilters
        filters={defaultFilters}
        onChange={mockOnChange}
        onClose={vi.fn()}
      />,
    )

    // Restore high-level matchers for better readability (Review suggestion)
    expect(screen.getByText(/Topics/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Min Relevance/i)).toBeInTheDocument()
    expect(screen.getByText(/Sort By/i)).toBeInTheDocument()
  })

  it('calls onChange when sort order changes', () => {
    const mockOnChange = vi.fn()
    render(
      <SearchFilters
        filters={defaultFilters}
        onChange={mockOnChange}
        onClose={vi.fn()}
      />,
    )

    const newestButton = screen.getByText(/Newest/i)
    fireEvent.click(newestButton)

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: 'year',
      }),
    )
  })

  it('reflects active sort state via aria-pressed', () => {
    const mockOnChange = vi.fn()
    render(
      <SearchFilters
        filters={defaultFilters}
        onChange={mockOnChange}
        onClose={vi.fn()}
      />,
    )

    const relevanceButton = screen.getByText(/Relevance/i)
    // Use toHaveAttribute matcher again (Review suggestion)
    expect(relevanceButton).toHaveAttribute('aria-pressed', 'true')
  })
})
