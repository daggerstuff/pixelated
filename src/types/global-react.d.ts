// Provide lightweight global aliases for commonly-used React types to reduce
// repetitive imports during scoped typefixes. These are temporary helpers for
// incremental migration and can be removed once code explicitly imports types.

declare global {
  /** Alias for React.FC */
  type FC<P = {}> = import('react').FC<P>

  /** Alias for React.ReactNode */
  type ReactNode = import('react').ReactNode
}

export {}
