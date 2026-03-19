import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TableWidget } from './TableWidget'
import type { Column, TableRowData } from './TableWidget'
import { useDebounce } from '../hooks/useDebounce'

// Mock data for testing
const mockColumns: Column[] = [
  { key: 'name', label: 'Name', sortable: true, filterable: true },
  { key: 'email', label: 'Email', sortable: true, filterable: true },
]

const mockData: TableRowData[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
]

// Get the default debounce delay from the shared hook
const DEBOUNCE_DELAY = useDebounce(undefined, 300).delay

describe('TableWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces search input and filters data after delay', async () => {
    render(
      <TableWidget
        title="Test Table"
        columns={mockColumns}
        data={mockData}
        enableSearch={true}
      />
    )

    // All rows should be visible initially
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument()

    // Get the search input and type a search term
    const searchInput = screen.getByPlaceholderText('Search...')
    fireEvent.change(searchInput, { target: { value: 'John' } })

    // Before debounce completes, all rows should still be visible
    // because the debouncedSearchTerm hasn't been updated yet
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument()

    // Advance timers by less than the debounce delay - filtering should NOT happen yet
    vi.advanceTimersByTime(DEBOUNCE_DELAY - 100)

    // Still all visible because we haven't reached the debounce delay
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument()

    // Advance timers past the debounce delay
    vi.advanceTimersByTime(100)

    // After debounce completes, only matching rows should be visible
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Jane and Bob should be filtered out (no longer in the document)
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
    expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument()
  })

  it('shows all data when search is cleared after debounce', async () => {
    render(
      <TableWidget
        title="Test Table"
        columns={mockColumns}
        data={mockData}
        enableSearch={true}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search...')

    // Type to filter
    fireEvent.change(searchInput, { target: { value: 'John' } })
    vi.advanceTimersByTime(DEBOUNCE_DELAY)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()

    // Clear the search
    fireEvent.change(searchInput, { target: { value: '' } })
    vi.advanceTimersByTime(DEBOUNCE_DELAY)

    // All rows should be visible again after debounce
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
    })
  })

  it('does not filter until debounce delay elapses (exact timing test)', async () => {
    render(
      <TableWidget
        title="Test Table"
        columns={mockColumns}
        data={mockData}
        enableSearch={true}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search...')

    // Type a search term
    fireEvent.change(searchInput, { target: { value: 'Jane' } })

    // Advance exactly to just before the debounce time
    vi.advanceTimersByTime(DEBOUNCE_DELAY - 1)

    // Should still show all data (filtering hasn't happened yet)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument()

    // Advance one more millisecond to cross the threshold
    vi.advanceTimersByTime(1)

    // Now filtering should have applied
    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument()
    })
  })
})