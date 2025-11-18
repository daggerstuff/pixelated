/**
 * Pagination hook for journal research lists
 */

import { useState, useMemo, useCallback } from 'react'

export interface PaginationState {
  page: number
  pageSize: number
  total: number
}

export interface UsePaginationOptions {
  initialPage?: number
  initialPageSize?: number
  total?: number
}

export interface UsePaginationReturn {
  pagination: PaginationState
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  setTotal: (total: number) => void
  nextPage: () => void
  previousPage: () => void
  goToFirstPage: () => void
  goToLastPage: () => void
  hasNextPage: boolean
  hasPreviousPage: boolean
  totalPages: number
  startIndex: number
  endIndex: number
}

/**
 * Hook for managing pagination state
 */
export function usePagination(
  options: UsePaginationOptions = {},
): UsePaginationReturn {
  const {
    initialPage = 1,
    initialPageSize = 10,
    total = 0,
  } = options

  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [totalItems, setTotal] = useState(total)

  const totalPages = useMemo(
    () => Math.ceil(totalItems / pageSize) || 1,
    [totalItems, pageSize],
  )

  const hasNextPage = useMemo(() => page < totalPages, [page, totalPages])
  const hasPreviousPage = useMemo(() => page > 1, [page])

  const startIndex = useMemo(
    () => (page - 1) * pageSize,
    [page, pageSize],
  )

  const endIndex = useMemo(
    () => Math.min(startIndex + pageSize, totalItems),
    [startIndex, pageSize, totalItems],
  )

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPage((prev) => prev + 1)
    }
  }, [hasNextPage])

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setPage((prev) => prev - 1)
    }
  }, [hasPreviousPage])

  const goToFirstPage = useCallback(() => {
    setPage(1)
  }, [])

  const goToLastPage = useCallback(() => {
    setPage(totalPages)
  }, [totalPages])

  const handleSetPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }, [totalPages])

  const handleSetPageSize = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    // Reset to first page when page size changes
    setPage(1)
  }, [])

  return {
    pagination: {
      page,
      pageSize,
      total: totalItems,
    },
    setPage: handleSetPage,
    setPageSize: handleSetPageSize,
    setTotal,
    nextPage,
    previousPage,
    goToFirstPage,
    goToLastPage,
    hasNextPage,
    hasPreviousPage,
    totalPages,
    startIndex,
    endIndex,
  }
}

