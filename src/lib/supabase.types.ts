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
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      security_events: {
        Row: {
          id: string
          type: string
          user_id: string | null
          ip_address: string | null
          user_agent: string | null
          metadata: Record<string, unknown>
          severity: string
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Record<string, unknown>
          severity: string
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Record<string, unknown>
          severity?: string
          created_at?: string
        }
      }
      ai_metrics: {
        Row: {
          id: string
          timestamp: string
          model: string
          request_count: number
          success_count: number
          cached_count: number
          optimized_count: number
          total_input_tokens: number
          total_output_tokens: number
          total_tokens: number
          avg_latency: number
          max_latency: number
          min_latency: number
        }
        Insert: {
          id?: string
          timestamp?: string
          model: string
          request_count: number
          success_count: number
          cached_count: number
          optimized_count: number
          total_input_tokens: number
          total_output_tokens: number
          total_tokens: number
          avg_latency: number
          max_latency: number
          min_latency: number
        }
        Update: {
          id?: string
          timestamp?: string
          model?: string
          request_count?: number
          success_count?: number
          cached_count?: number
          optimized_count?: number
          total_input_tokens?: number
          total_output_tokens?: number
          total_tokens?: number
          avg_latency?: number
          max_latency?: number
          min_latency?: number
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          created_at: string
          updated_at: string
          preferences: Record<string, unknown>
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
          updated_at?: string
          preferences?: Record<string, unknown>
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          updated_at?: string
          preferences?: Record<string, unknown>
        }
        Relationships: [
          {
            foreignKeyName: 'user_settings_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      get_ai_metrics: {
        Args: {
          p_period: string
          p_start_date: string
          p_end_date: string
          p_model?: string
          p_limit: number
        }
        Returns: {
          date_trunc: string
          model: string
          request_count: number
          success_count: number
          cached_count: number
          optimized_count: number
          total_input_tokens: number
          total_output_tokens: number
          total_tokens: number
          avg_latency: number
          max_latency: number
          min_latency: number
        }[]
      }
      get_ai_model_breakdown: {
        Args: {
          p_start_date: string
          p_end_date: string
        }
        Returns: {
          model: string
          request_count: number
          success_count: number
          cached_count: number
          optimized_count: number
          total_tokens: number
        }[]
      }
      get_ai_error_breakdown: {
        Args: {
          p_start_date: string
          p_end_date: string
        }
        Returns: {
          error_code: string
          error_count: number
        }[]
      }
    }
    Enums: Record<never, never>
  }
}
