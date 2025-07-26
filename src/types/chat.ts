/**
 * Chat message types for the therapy system
 */

/**
 * Base chat message interface
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
  encrypted?: boolean
  verified?: boolean
  verificationToken?: string
  isError?: boolean
}

/**
 * Chat thread containing multiple messages
 */
export interface ChatThread {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  messages: Message[]
  metadata?: {
    scenario?: string
    securityLevel?: 'standard' | 'hipaa' | 'maximum'
    encryptionEnabled?: boolean
    encryptionMode?: string
    clientType?: string
  }
}

/**
 * Chat session containing multiple threads
 */
export interface ChatSession {
  id: string
  userId: string
  threads: ChatThread[]
  activeThreadId: string
  createdAt: number
  updatedAt: number
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  name: string
  encrypted?: boolean
  verified?: boolean
  isError?: boolean
}

export interface ChatOptions {
  initialMessages?: Message[]
  api?: string
  body?: Record<string, unknown>
  onResponse?: (response: Response) => void
  onError?: (error: Error) => void
}

export interface MentalHealthAnalysis {
  category: 'low' | 'medium' | 'high'
  scores: {
    anxiety?: number
    depression?: number
    stress?: number
    anger?: number
    [key: string]: number | undefined
  }
  emotions: string[]
  riskFactors: string[]
  expertGuided: boolean
  timestamp: number
  confidence: number
}

export interface ExtendedMessage extends Message {
  mentalHealthAnalysis?: MentalHealthAnalysis | undefined
  metadata?: {
    interventionType?: 'immediate' | 'preventive' | 'supportive'
    requiresFollowUp?: boolean
    suggestedResources?: string[]
    [key: string]: unknown
  }
}

export interface ChatState {
  messages: ExtendedMessage[]
  isLoading: boolean
  error: string | null
}

export interface InterventionConfig {
  scores: Record<string, number>
  type: 'immediate' | 'preventive' | 'supportive'
  requiresExpert: boolean
  emotions: string[]
  riskFactors: string[]
}
