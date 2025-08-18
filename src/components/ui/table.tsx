import React from 'react'
import { cn } from '../../lib/utils'
import type {
  TableColumn,
  TableRowData,
  TableDataSource,
  TableState,
  SortDirection,
} from './table-types'

export interface TableProps<T extends TableRowData> extends React.HTMLAttributes<HTMLTableElement> {
  /** Column definitions */
  columns: TableColumn<T>[]
  /** Data source */
  dataSource: TableDataSource<T>
  /** Table state */
  tableState: TableState
  /** Function to update table state */
  onStateChange: (newState: Partial<TableState>) => void
  /** Whether the table should have a border */
  bordered?: boolean
  /** Whether the table should have striped rows */
  striped?: boolean
  /** Whether the table should be hoverable */
  hoverable?: boolean
  /** Whether the table should be compact */
  compact?: boolean
  /** Whether the table should be full width */
  fullWidth?: boolean
  /** Whether the table should have a sticky header */
  stickyHeader?: boolean
  /** Additional class name */
  className?: string
}

function Table<T extends TableRowData>({
  columns,
  dataSource,
  tableState,
  onStateChange,
  bordered = false,
  striped = false,
  hoverable = false,
  compact = false,
  stickyHeader = false,
  fullWidth = true,
  className,
  ...props
}: TableProps<T>) {
  const handleSort = (columnId: string) => {
    const currentSort = tableState.sort
    let direction: SortDirection = 'asc'

    if (currentSort?.sortBy === columnId) {
      if (currentSort.direction === 'asc') {
        direction = 'desc'
      } else if (currentSort.direction === 'desc') {
        direction = null
      }
    }

    onStateChange({
      sort: direction ? { sortBy: columnId, direction } : undefined,
    })
  }

  return (
    <div
      className={cn('relative w-full overflow-auto', {
        'overflow-x-auto': true,
      })}
    >
      <table
        className={cn(
          'border-collapse w-full text-sm',
          {
            'w-full': fullWidth,
            'border border-gray-200 dark:border-gray-700': bordered,
            '[&>tbody>tr:nth-child(odd)]:bg-gray-50 dark:[&>tbody>tr:nth-child(odd)]:bg-gray-800/50':
              striped,
            '[&>tbody>tr:hover]:bg-gray-100 dark:[&>tbody>tr:hover]:bg-gray-800/70':
              hoverable,
            '[&_td]:p-2 [&_th]:p-2': compact,
            '[&>thead]:sticky [&>thead]:top-0 [&>thead]:bg-inherit':
              stickyHeader,
          },
          className,
        )}
        {...props}
      >
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.id}
                sortable={column.sortable}
                sortAsc={tableState.sort?.sortBy === column.id && tableState.sort.direction === 'asc'}
                sortDesc={tableState.sort?.sortBy === column.id && tableState.sort.direction === 'desc'}
                onSort={() => column.sortable && handleSort(column.id)}
                style={{ width: column.width }}
                className={cn({
                  'text-right': column.align === 'right',
                  'text-center': column.align === 'center',
                  'hidden md:table-cell': column.hideMobile,
                })}
              >
                {column.Header || column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {dataSource.loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8">
                Loading...
              </TableCell>
            </TableRow>
          ) : dataSource.error ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8 text-red-500">
                {dataSource.error}
              </TableCell>
            </TableRow>
          ) : dataSource.data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8">
                No data available
              </TableCell>
            </TableRow>
          ) : (
            dataSource.data.map((row) => (
              <TableRow
                key={row.id}
                selected={tableState.selectedRows?.has(row.id)}
                className={cn(row.className, {
                  'opacity-50': row.disabled,
                })}
              >
                {columns.map((column) => (
                  <TableCell
                    key={`${row.id}-${column.id}`}
                    className={cn({
                      'text-right': column.align === 'right',
                      'text-center': column.align === 'center',
                      'hidden md:table-cell': column.hideMobile,
                    })}
                  >
                    {column.Cell ? (
                      <column.Cell value={column.accessor(row)} row={row} />
                    ) : (
                      column.accessor(row)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </table>

      {dataSource.totalCount > tableState.pageSize && (
        <TablePagination
          currentPage={tableState.currentPage}
          totalPages={Math.ceil(dataSource.totalCount / tableState.pageSize)}
          onPageChange={(page) => onStateChange({ currentPage: page })}
          showPageSize
          pageSize={tableState.pageSize}
          onPageSizeChange={(size) => onStateChange({ pageSize: size, currentPage: 1 })}
        />
      )}
    </div>
  )
}

export interface TableHeaderProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string
}

function TableHeader({ className, ...props }: TableHeaderProps) {
  return (
    <thead
      className={cn('bg-gray-50 dark:bg-gray-800', className)}
      {...props}
    />
  )
}

export interface TableBodyProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string
}

function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody
      className={cn('divide-y divide-gray-200 dark:divide-gray-700', className)}
      {...props}
    />
  )
}

export interface TableFooterProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string
}

function TableFooter({ className, ...props }: TableFooterProps) {
  return (
    <tfoot
      className={cn('bg-gray-50 dark:bg-gray-800 font-medium', className)}
      {...props}
    />
  )
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement>, Pick<TableRowData, 'selected' | 'disabled'> {
  className?: string
}

function TableRow({ selected = false, disabled = false, className, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        'transition-colors',
        {
          'hover:bg-gray-100 dark:hover:bg-gray-800/50': !disabled,
          'bg-blue-50 dark:bg-blue-900/20': selected,
          'opacity-50 cursor-not-allowed': disabled,
        },
        className,
      )}
      aria-selected={selected}
      aria-disabled={disabled}
      {...props}
    />
  )
}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Whether the column is sortable */
  sortable?: boolean
  /** Whether the column is currently sorted ascending */
  sortAsc?: boolean
  /** Whether the column is currently sorted descending */
  sortDesc?: boolean
  /** Function to call when sort direction is changed */
  onSort?: () => void
  /** Column alignment */
  align?: 'left' | 'center' | 'right'
  /** Whether to hide on mobile */
  hideMobile?: boolean
  /** Column width */
  width?: string
  className?: string
}

function TableHead({
  sortable = false,
  sortAsc = false,
  sortDesc = false,
  onSort,
  align = 'left',
  hideMobile = false,
  width,
  className,
  children,
  style,
  ...props
}: TableHeadProps) {
  return (
    <th
      className={cn(
        'h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400',
        'border-b border-gray-200 dark:border-gray-700',
        {
          'cursor-pointer select-none': sortable,
          'text-right': align === 'right',
          'text-center': align === 'center',
          'hidden md:table-cell': hideMobile,
        },
        className,
      )}
      onClick={sortable ? onSort : undefined}
      onKeyDown={sortable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSort?.();
        }
      } : undefined}
      style={{ ...style, width }}
      tabIndex={sortable ? 0 : undefined}
      role={sortable ? "button" : undefined}
      aria-sort={sortable ? (sortAsc ? 'ascending' : sortDesc ? 'descending' : 'none') : undefined}
      {...props}
    >
      {sortable ? (
        <div className="flex items-center gap-2">
          <span>{children}</span>
          <span className="flex flex-col">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={cn('h-2 w-2', {
                'text-gray-700 dark:text-gray-300': sortAsc,
                'text-gray-400 dark:text-gray-600': !sortAsc,
              })}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={cn('h-2 w-2', {
                'text-gray-700 dark:text-gray-300': sortDesc,
                'text-gray-400 dark:text-gray-600': !sortDesc,
              })}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        </div>
      ) : (
        children
      )}
    </th>
  )
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Cell alignment */
  align?: 'left' | 'center' | 'right'
  /** Whether to hide on mobile */
  hideMobile?: boolean
  className?: string
}

function TableCell({ align = 'left', hideMobile = false, className, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        'p-4 align-middle',
        {
          'text-right': align === 'right',
          'text-center': align === 'center',
          'hidden md:table-cell': hideMobile,
        },
        className,
      )}
      {...props}
    />
  )
}

export interface TablePaginationProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Current page (1-based) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Function to call when page is changed */
  onPageChange: (page: number) => void
  /** Whether to show page size select */
  showPageSize?: boolean
  /** Available page sizes */
  pageSizes?: number[]
  /** Current page size */
  pageSize?: number
  /** Function to call when page size is changed */
  onPageSizeChange?: (pageSize: number) => void
  /** Additional class name */
  className?: string
}

function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  showPageSize = false,
  pageSizes = [10, 25, 50, 100],
  pageSize = 10,
  onPageSizeChange,
  className,
  ...props
}: TablePaginationProps) {
  // Calculate visible page range
  const getVisiblePages = () => {
    const pages = []
    let startPage = Math.max(1, currentPage - 2)
    const endPage = Math.min(totalPages, startPage + 4)

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    return pages
  }

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 px-4 py-3 dark:border-gray-700',
        className,
      )}
      {...props}
    >
      {showPageSize && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">Show</span>
          <select
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md',
            'text-gray-500 dark:text-gray-400',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            'disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent',
          )}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {getVisiblePages().map((page) => (
          <button
            key={page}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-sm',
              {
                'bg-primary text-white': currentPage === page,
                'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800':
                  currentPage !== page,
              },
            )}
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        ))}

        <button
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md',
            'text-gray-500 dark:text-gray-400',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            'disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent',
          )}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      <div className="text-sm text-gray-700 dark:text-gray-300">
        Page <span className="font-medium">{currentPage}</span> of{' '}
        <span className="font-medium">{totalPages}</span>
      </div>
    </div>
  )
}

export {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
}
