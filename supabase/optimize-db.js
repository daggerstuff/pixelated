import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase URL or service role key in environment variables',
  )
  process.exit(1)
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Function to optimize database
async function optimizeDatabase() {
  try {
    console.log('Optimizing database...')

    // Add indexes for frequently queried columns
    const optimizationQueries = [
      // Add indexes for profiles table
      `CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);`,

      // Add indexes for conversations table
      `CREATE INDEX IF NOT EXISTS idx_conversations_user_id_updated_at ON public.conversations(user_id, updated_at);`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at);`,

      // Add indexes for messages table
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON public.messages(conversation_id, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_is_flagged ON public.messages(is_flagged);`,

      // Add indexes for AI usage tables
      `CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model ON public.ai_usage_logs(model);`,

      // Add indexes for audit tables
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);`,

      // Optimize vacuum settings for frequently updated tables
      `ALTER TABLE public.messages SET (autovacuum_vacuum_scale_factor = 0.05);`,
      `ALTER TABLE public.conversations SET (autovacuum_vacuum_scale_factor = 0.05);`,
      `ALTER TABLE public.ai_usage_logs SET (autovacuum_vacuum_scale_factor = 0.05);`,

      // Set up text search capabilities for messages
      `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
      `CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON public.messages USING GIN (content gin_trgm_ops);`,

      // Add filter for conversation search
      `CREATE INDEX IF NOT EXISTS idx_conversations_title_trgm ON public.conversations USING GIN (title gin_trgm_ops);`,

      // Add timestamp indexes for range queries
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_range ON public.audit_logs USING BRIN (created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at_range ON public.ai_usage_logs USING BRIN (created_at);`,

      // Add partial indexes for common filters
      `CREATE INDEX IF NOT EXISTS idx_messages_is_flagged_true ON public.messages(conversation_id) WHERE is_flagged = true;`,

      // Set up RLS policies
      `ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;`,
      `CREATE POLICY IF NOT EXISTS "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);`,
      `CREATE POLICY IF NOT EXISTS "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);`,

      `ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;`,
      `CREATE POLICY IF NOT EXISTS "Users can view their own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "Users can update their own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "Users can insert their own conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "Users can delete their own conversations" ON public.conversations FOR DELETE USING (auth.uid() = user_id);`,

      `ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;`,
      `CREATE POLICY IF NOT EXISTS "Users can view messages in their conversations" ON public.messages FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.conversations WHERE id = conversation_id));`,
      `CREATE POLICY IF NOT EXISTS "Users can insert messages in their conversations" ON public.messages FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.conversations WHERE id = conversation_id));`,

      `ALTER TABLE IF EXISTS public.user_settings ENABLE ROW LEVEL SECURITY;`,
      `CREATE POLICY IF NOT EXISTS "Users can view their own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "Users can update their own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);`,

      // Set up functions for analytics
      `CREATE OR REPLACE FUNCTION get_user_conversation_stats(user_id_param UUID)
      RETURNS TABLE (
        total_conversations BIGINT,
        total_messages BIGINT,
        avg_messages_per_conversation NUMERIC,
        last_active TIMESTAMP WITH TIME ZONE
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          COUNT(DISTINCT c.id) AS total_conversations,
          COUNT(m.id) AS total_messages,
          CASE WHEN COUNT(DISTINCT c.id) = 0 THEN 0 ELSE COUNT(m.id)::NUMERIC / COUNT(DISTINCT c.id) END AS avg_messages_per_conversation,
          MAX(m.created_at) AS last_active
        FROM
          public.conversations c
          LEFT JOIN public.messages m ON c.id = m.conversation_id
        WHERE
          c.user_id = user_id_param;
      END;
      $$;`,

      // Set up function for efficient conversation search
      `CREATE OR REPLACE FUNCTION search_conversations(search_term TEXT, user_id_param UUID, limit_param INTEGER DEFAULT 10)
      RETURNS TABLE (
        conversation_id UUID,
        title TEXT,
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        last_message_at TIMESTAMP WITH TIME ZONE,
        message_count BIGINT,
        relevance REAL
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          c.id AS conversation_id,
          c.title,
          c.created_at,
          c.updated_at,
          c.last_message_at,
          COUNT(m.id) AS message_count,
          similarity(c.title, search_term) +
          COALESCE(MAX(similarity(m.content, search_term)), 0) AS relevance
        FROM
          public.conversations c
          LEFT JOIN public.messages m ON c.id = m.conversation_id
        WHERE
          c.user_id = user_id_param AND
          (
            c.title ILIKE '%' || search_term || '%' OR
            m.content ILIKE '%' || search_term || '%'
          )
        GROUP BY
          c.id, c.title, c.created_at, c.updated_at, c.last_message_at
        ORDER BY
          relevance DESC, c.last_message_at DESC NULLS LAST
        LIMIT limit_param;
      END;
      $$;`,
    ]

    // Execute optimization queries
    const queryPromises = optimizationQueries.map(async (query) => {
      try {
        console.log(`Running optimization query: ${query.substring(0, 60)}...`)

        // Execute the query using SQL query builder
        const { error } = await supabase.rpc('exec_sql', { sql_query: query })

        if (error) {
          console.warn(`Warning in optimization query: ${error.message}`)
          return { success: false, error, query }
        }
        return { success: true, query }
      } catch (error) {
        console.warn(`Failed to execute query: ${error.message}`)
        return { success: false, error, query }
      }
    })

    // Wait for all queries to complete
    await Promise.all(queryPromises)

    console.log('\nDatabase optimization script completed.')
    console.log(
      'If you encountered "function not found" errors, please run this SQL in the Supabase dashboard first:',
    )
    console.log(`
CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;
    `)
    console.log('\nThen run this script again.')
  } catch (error) {
    console.error('Database optimization failed:', error)
  }
}

// Run the optimization
optimizeDatabase()
