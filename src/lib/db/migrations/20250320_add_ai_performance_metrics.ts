import postgres from 'postgres'

// Initialize client
const sql = postgres(process.env['DATABASE_URL'] || '')

export async function up() {
  await sql.unsafe`
    CREATE TABLE IF NOT EXISTS ai_performance_metrics (
      id SERIAL PRIMARY KEY,
      model VARCHAR(255) NOT NULL,
      latency INTEGER NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      success BOOLEAN NOT NULL,
      error_code VARCHAR(255),
      cached SMALLINT DEFAULT 0,
      optimized SMALLINT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      user_id VARCHAR(255),
      session_id VARCHAR(255),
      request_id VARCHAR(255)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_perf_model ON ai_performance_metrics(model);
    CREATE INDEX IF NOT EXISTS idx_ai_perf_created_at ON ai_performance_metrics(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_perf_user_id ON ai_performance_metrics(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_perf_success ON ai_performance_metrics(success);
  `

  console.log('Created ai_performance_metrics table')
}

export async function down() {
  await sql.unsafe`
    DROP TABLE IF EXISTS ai_performance_metrics;
  `

  console.log('Dropped ai_performance_metrics table')
}
