import { fireEvent } from '@testing-library/dom'
import { act } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import type { SearchFiltersState } from './SearchFilters'
import SearchFilters from './SearchFilters'

import '@testing-library/jest-dom/vitest'

const defaultFilters: SearchFiltersState = {
  topics: [],
  minRelevance: 0,
  publishers: [],
  sortBy: 'relevance',
}

import { afterEach } from 'vitest'

describe('SearchFilters', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  async function renderFilters(onChange = vi.fn(), onClose = vi.fn()) {
    const container = document.createElement('div')
    const root = createRoot(container)
    document.body.appendChild(container)
    act(() => {
      root.render(
        <SearchFilters
          filters={defaultFilters}
          onChange={onChange}
          onClose={onClose}
        />,
      )
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container.innerHTML).toContain('Advanced Filters')
    return {
      container,
      root,
      async cleanup() {
        act(() => {
          root.unmount()
        })
        container.remove()
      },
    }
  }

  it('renders with default values', async () => {
    const mockOnChange = vi.fn()
    const { container, cleanup } = await renderFilters(mockOnChange)

    try {
      expect(container.textContent).toContain('Advanced Filters')
      expect(
        container.querySelector('label[for="min-relevance"]'),
      ).toBeInTheDocument()
      expect(
        container.querySelector('label[for="sort-by"]'),
      ).toBeInTheDocument()
    } finally {
      await cleanup()
    }
  })

  it('calls onChange when sort order changes', async () => {
    const mockOnChange = vi.fn()
    const { container, cleanup } = await renderFilters(mockOnChange)

    const sortBySelect = container.querySelector('#sort-by')
    expect(sortBySelect).toBeInTheDocument()
    expect(sortBySelect).not.toBeNull()
    if (sortBySelect === null) return

    fireEvent.change(sortBySelect, { target: { value: 'year_desc' } })

    const applyButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Apply Filters'),
    )
    expect(applyButton).toBeInTheDocument()
    if (!applyButton) return

    fireEvent.click(applyButton)

    try {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'year_desc',
        }),
      )
    } finally {
      await cleanup()
    }
  })

  it('reflects active sort state', async () => {
    const mockOnChange = vi.fn()
    const { container, cleanup } = await renderFilters(mockOnChange)

    try {
      const relevanceOption = Array.from(
        container.querySelectorAll('option'),
      ).find((option) => option.textContent?.includes('Relevance'))
      expect(relevanceOption).toBeInTheDocument()
      if (!relevanceOption) return
      expect(relevanceOption.selected).toBe(true)
    } finally {
      await cleanup()
    }
  })
})
