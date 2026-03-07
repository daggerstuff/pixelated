/**
 * Column definition for table headers
 */
export interface TableColumn<T> {
  /** Unique identifier for the column */
  id: string
  /** Header text to display */
  header: string
  /** Function to access the cell value from a row */
  accessor: (row: T) => React.ReactNode
  /** Whether this column is sortable */
  sortable?: boolean
  /** Custom cell renderer */
  Cell?: (props: { value: unknown; row: T }) => React.ReactNode
  /** Column width (CSS value) */
  width?: string
  /** Whether to hide column on mobile */
  hideMobile?: boolean
  /** Custom header renderer */
  Header?: React.ReactNode
  /** Column alignment */
  align?: 'left' | 'center' | 'right'
}

/**
 * Base interface for table row data
 */
export interface TableRowData {
  /** Unique identifier for the row */
  id: string | number
  /** Whether the row is selected */
  selected?: boolean
  /** Whether the row is disabled */
  disabled?: boolean
  /** Custom CSS class names */
  className?: string
}

/**
 * Sort direction type
 */
export type SortDirection = 'asc' | 'desc' | null

/**
 * Sort state for table
 */
export interface TableSortState {
  /** Column ID being sorted */
  sortBy: string
  /** Sort direction */
  direction: SortDirection
}

/**
 * Table data source interface
 */
export interface TableDataSource<T extends TableRowData> {
  /** Array of row data */
  data: T[]
  /** Total number of rows (for pagination) */
  totalCount: number
  /** Whether data is loading */
  loading?: boolean
  /** Error message if data fetch failed */
  error?: string
}

/**
 * Table state interface
 */
export interface TableState {
  /** Current sort state */
  sort?: TableSortState
  /** Current page number */
  currentPage: number
  /** Number of rows per page */
  pageSize: number
  /** Selected row IDs */
  selectedRows?: Set<string | number>
}
