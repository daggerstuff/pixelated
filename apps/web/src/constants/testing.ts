import type { LoadingSizes, SeverityStyles } from '../types/testing'

export const LOADING_SIZES: LoadingSizes = {
  small: { width: 50, height: 20 },
  medium: { width: 100, height: 30 },
  large: { width: 150, height: 40 },
}

export const SEVERITY_STYLES: SeverityStyles = {
  critical: {
    backgroundColor: '#ef4444',
    color: 'white',
  },
  major: {
    backgroundColor: '#f59e0b',
    color: 'white',
  },
  minor: {
    backgroundColor: '#6b7280',
    color: 'white',
  },
}
