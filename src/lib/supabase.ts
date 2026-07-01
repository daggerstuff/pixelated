// Supabase client wrapper (stub)
export const supabase = {
  from<T>(_table: string) {
    return {
      select() {
        return {
          eq: async (
            _key: string,
            _value: unknown,
          ): Promise<{ data: T[]; error: unknown }> => {
            return { data: [], error: null }
          },
        }
      },
      insert(_data: T) {
        return {
          select: async () => ({ data: null, error: null }),
        }
      },
      update(_data: Partial<T>) {
        return {
          eq: async (
            _key: string,
            _value: unknown,
          ): Promise<{ data: T; error: unknown }> => {
            return { data: null as unknown as T, error: null }
          },
        }
      },
      delete() {
        return {
          eq: async (
            _key: string,
            _value: unknown,
          ): Promise<{ error: unknown }> => {
            return { error: null }
          },
        }
      },
    }
  },
}

const makeSupabaseClient = (_url: string, _key: string) => ({
  from: (table: string) => supabase.from(table),
})
export { makeSupabaseClient }
