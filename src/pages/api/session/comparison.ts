import { Pool } from 'pg';
import type { APIRoute } from 'astro';

// Database connection pool
const { DATABASE_URL } = process.env
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set')
const pool =
  (globalThis as any).__pgPool ??
  new Pool({ connectionString: DATABASE_URL })
;(globalThis as any).__pgPool = pool

export const POST: APIRoute = async ({ request }) => {
  try {
    const { therapistId, currentSessionId, previousSessionId, improvementScore, metrics } = await request.json();

    if (!therapistId || !currentSessionId || improvementScore === undefined || improvementScore === null || !metrics) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: therapistId, currentSessionId, improvementScore, metrics' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      // Insert session comparison data into session_comparisons table
      const query = `
        INSERT INTO session_comparisons (
          therapist_id, current_session_id, previous_session_id, improvement_score, comparison_metrics
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING id
      `;

      const result = await client.query(query, [
        therapistId,
        currentSessionId,
        previousSessionId || null,
        improvementScore,
        JSON.stringify(metrics),
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          comparisonId: result.rows[0].id,
          therapistId,
          currentSessionId
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving session comparison:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const therapistId = url.searchParams.get('therapistId');
    const sessionId = url.searchParams.get('sessionId');
    const timeRange = url.searchParams.get('timeRange') || '30d';

    if (!therapistId && !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing therapistId or sessionId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      let query = '';
      let queryParams: any[] = [];

      if (sessionId) {
        // Get specific session comparison
        query = `
          SELECT
            sc.id,
            sc.therapist_id,
            sc.current_session_id,
            sc.previous_session_id,
            sc.improvement_score,
            sc.comparison_metrics,
            sc.analyzed_at,
            cs.started_at as current_session_started_at,
            ps.started_at as previous_session_started_at
          FROM session_comparisons sc
          LEFT JOIN sessions cs ON sc.current_session_id = cs.id
          LEFT JOIN sessions ps ON sc.previous_session_id = ps.id
          WHERE sc.current_session_id = $1
          ORDER BY sc.analyzed_at DESC
          LIMIT 1
        `;
        queryParams = [sessionId];
      } else {
        // Get therapist's session comparisons
        query = `
          SELECT
            sc.id,
            sc.therapist_id,
            sc.current_session_id,
            sc.previous_session_id,
            sc.improvement_score,
            sc.comparison_metrics,
            sc.analyzed_at,
            cs.started_at as current_session_started_at,
            ps.started_at as previous_session_started_at
          FROM session_comparisons sc
          LEFT JOIN sessions cs ON sc.current_session_id = cs.id
          LEFT JOIN sessions ps ON sc.previous_session_id = ps.id
          WHERE sc.therapist_id = $1
            AND sc.analyzed_at >= NOW() - $2::interval
          ORDER BY sc.analyzed_at DESC
        `;
        // Allowlist simple forms like '7 days', '30 days', '24 hours', '30d'
        const allowed = /^(?:\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)|\d+d)$/i
        const safeRange = allowed.test(timeRange) ? timeRange.replace(/(\d+)d/i, '$1 days') : '30 days'
        queryParams = [therapistId, safeRange];
        queryParams = [therapistId];
      }

      const result = await client.query(query, queryParams);

      // Transform data for client consumption
      const comparisons = result.rows.map(row => ({
        id: row.id,
        therapistId: row.therapist_id,
        currentSessionId: row.current_session_id,
        previousSessionId: row.previous_session_id,
        improvementScore: row.improvement_score,
        metrics: JSON.parse(row.comparison_metrics || '{}'),
        analyzedAt: row.analyzed_at,
        currentSessionStartedAt: row.current_session_started_at,
        previousSessionStartedAt: row.previous_session_started_at,
        trend: row.improvement_score > 0 ? 'improving' : row.improvement_score < 0 ? 'declining' : 'stable',
      }));

      return new Response(
        JSON.stringify({
          therapistId: therapistId || result.rows[0]?.therapist_id,
          sessionId: sessionId,
          comparisons,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching session comparisons:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
