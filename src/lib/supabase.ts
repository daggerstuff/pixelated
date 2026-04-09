// Supabase client wrapper
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const supabase = {
  from<T>(table: string) {
    return {
      select() {
        return {
          eq: async (key: string, value: unknown): Promise<{ data: T[]; error: unknown }> => {
            return { data: [], error: null }
          },
        }
      },
      insert(data: T) {
        return {
          select: async () => ({ data: null, error: null }),
        }
      },
      update(data: Partial<T>) {
        return {
          eq: async (key: string, value: unknown): Promise<{ data: T; error: unknown }> => {
            return { data: null as unknown as T, error: null }
          },
        }
      },
      delete() {
        return {
          eq: async (key: string, value: unknown): Promise<{ error: unknown }> => {
            return { error: null }
          },
        }
      },
    }
  },
}

export const createSupabaseClient = (url: string, key: string) => ({
  from: (table: string) => supabase.from(table),
})
