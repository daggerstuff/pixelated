import { Pool } from 'pg';
import type { APIRoute } from 'astro';

// Database connection pool
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { sessionId, analyticsData } = await request.json();

    const isValid =
      typeof sessionId === 'string' &&
      analyticsData &&
      Array.isArray(analyticsData.sessionMetrics ?? []) &&
      Array.isArray(analyticsData.skillProgress ?? []) &&
      (analyticsData.sessionMetrics?.length ?? 0) <= 1000 &&
      (analyticsData.skillProgress?.length ?? 0) <= 1000;
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!sessionId || !analyticsData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, analyticsData' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      // Insert session analytics data into session_analytics table
      const query = `
        INSERT INTO session_analytics (
          session_id, metric_name, metric_value, metric_category, recorded_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      // Insert session metrics
      for (const metric of analyticsData.sessionMetrics || []) {
        await client.query(query, [
          sessionId,
          metric.metricName || 'session_duration',
          metric.metricValue || metric.averageDuration || 0,
          metric.category || 'session',
          new Date(metric.recordedAt || metric.date || new Date()).toISOString(),
          JSON.stringify({
            sessions: metric.sessions,
            newUsers: metric.newUsers,
            returningUsers: metric.returningUsers,
          })
        ]);
      }

      // Insert skill progress data
      for (const skill of analyticsData.skillProgress || []) {
        await client.query(query, [
          sessionId,
          `skill_${skill.skill}`,
          skill.score,
          skill.category || 'skill',
          new Date().toISOString(),
          JSON.stringify({
            trend: skill.trend,
            previousScore: skill.previousScore,
            sessionsPracticed: skill.sessionsPracticed,
            averageImprovement: skill.averageImprovement,
          })
        ]);
      }

      return new Response(
        JSON.stringify({ success: true, sessionId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving session analytics:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const timeRange = url.searchParams.get('timeRange') || '30d';

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      // Get session analytics data
      const query = `
        SELECT
          metric_name,
          metric_value,
          metric_category,
          recorded_at,
          metadata
        FROM session_analytics
        WHERE session_id = $1
          AND recorded_at >= NOW() - $2::interval
        ORDER BY recorded_at ASC
      `;

      const interval =
        timeRange === '7d' ? '7 days' :
        timeRange === '30d' ? '30 days' :
        timeRange === '90d' ? '90 days' :
        timeRange === '1y' ? '1 year' : '30 days';
      const result = await client.query(query, [sessionId, interval]);
      // Transform data for client consumption
      const sessionMetrics: Array<any> = [];
      const skillProgress: Array<any> = [];

      result.rows.forEach(row => {
        const meta = typeof row.metadata === 'string'
          ? JSON.parse(row.metadata || '{}')
          : (row.metadata ?? {})
        if (row.metric_category === 'skill') {
          skillProgress.push({
            skill: row.metric_name.replace('skill_', ''),
            score: row.metric_value,
            category: row.metric_category,
            ...meta,
            timestamp: row.recorded_at,
          });
        } else {
          sessionMetrics.push({
            metricName: row.metric_name,
            metricValue: row.metric_value,
            category: row.metric_category,
            recordedAt: row.recorded_at,
            ...meta,
          });
        }
      });

      return new Response(
        JSON.stringify({
          sessionId,
          analyticsData: {
            sessionMetrics,
            skillProgress,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching session analytics:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
