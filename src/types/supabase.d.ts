// Minimal supabase-like Database type shim used by a few DB helper files
// This avoids pulling a full Supabase generated types dependency into the project

export type Json = any

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          _id: string
          user_id: string
          title?: string
          last_message_at?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          _id?: string
          user_id: string
          title?: string
          last_message_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<{
          _id: string
          user_id: string
          title?: string
          last_message_at?: string
          created_at?: string
          updated_at?: string
        }>
      }
      messages: {
        Row: {
          _id: string
          conversation_id: string
          role: string
          content: string
          created_at?: string
        }
        Insert: {
          _id?: string
          conversation_id: string
          role: string
          content: string
          created_at?: string
        }
        Update: Partial<{
          _id: string
          conversation_id: string
          role: string
          content: string
          created_at?: string
        }>
      }
    }
  }
}
