/**
 * Standalone Message type for cross-module type-only imports.
 */
export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  name: string
  encrypted?: boolean
  verified?: boolean
  isError?: boolean
}

// types module

// types module (standardized)
