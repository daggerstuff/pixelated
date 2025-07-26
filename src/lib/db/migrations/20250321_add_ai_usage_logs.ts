import postgres from 'postgres'

// Initialize client
const sql = postgres(process.env.DATABASE_URL || '')

export async function up() {
  await sql.unsafe`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      user_id UUID REFERENCES auth.users(id),
      model VARCHAR(255) NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost NUMERIC(10,4) NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model ON ai_usage_logs(model);

    -- Add RLS policies
    ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

    -- Users can view their own usage logs
    CREATE POLICY "Users can view their own usage logs"
      ON ai_usage_logs
      FOR SELECT
      USING (auth.uid() = user_id);

    -- Service role can manage all usage logs
    CREATE POLICY "Service role can manage usage logs"
      ON ai_usage_logs
      FOR ALL
      USING (auth.jwt() ? 'service_role');

    -- Admins can view all usage logs
    CREATE POLICY "Admins can view all usage logs"
      ON ai_usage_logs
      FOR SELECT
      USING (auth.jwt() ? 'is_admin');
  `

  console.log('Created ai_usage_logs table')
}

export async function down() {
  await sql.unsafe`
    DROP TABLE IF EXISTS ai_usage_logs CASCADE;
  `

  console.log('Dropped ai_usage_logs table')
}
