export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          full_name: string | null
          avatar_url: string | null
          website: string | null
          role: string
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          role?: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          role?: string
        }
      }
      security_events: {
        Row: {
          id: string
          type: string
          user_id: string | null
          ip_address: string | null
          user_agent: string | null
          metadata: Json
          severity: string
          created_at: string
        }
      }
    }
  }
}
