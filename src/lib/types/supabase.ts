import type { Json } from '../../types/supabase'
import type {
  SecurityEventSeverity,
  SecurityEventType,
} from '../security/monitoring'

export interface Database {
  public: {
    Tables: {
      security_events: {
        Row: {
          id: string
          type: SecurityEventType
          user_id: string | null
          ip_address: string | null
          user_agent: string | null
          metadata: Json
          severity: SecurityEventSeverity
          created_at: string
        }
        Insert: {
          id?: string
          type: SecurityEventType
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
          severity: SecurityEventSeverity
          created_at?: string
        }
        Update: {
          id?: string
          type?: SecurityEventType
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
          severity?: SecurityEventSeverity
          created_at?: string
        }
      }
    }
  }
}
