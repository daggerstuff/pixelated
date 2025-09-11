import { Pool } from 'pg';
import type { APIRoute } from 'astro';

// Database connection pool
const { DATABASE_URL } = process.env
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set')
const pool =
  (globalThis as any).__pgPool ??
  new Pool({
    connectionString: DATABASE_URL,
  })
;(globalThis as any).__pgPool = pool

export const POST: APIRoute = async ({ request }) => {
  try {
    const { sessionId, snapshots } = await request.json();

    if (!sessionId || !snapshots) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, snapshots' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      // Update session with progress snapshots
      const query = `
        UPDATE sessions
        SET progress_snapshots = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `;

      const result = await client.query(query, [
        JSON.stringify(snapshots),
        sessionId
      ]);

      if (result.rowCount === 0) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Also insert into session_milestones table for detailed tracking
      if (snapshots.length > 0) {
        const milestoneQuery = `
          INSERT INTO session_milestones (session_id, milestone_name, milestone_value, achieved_at)
          VALUES ($1, $2, $3, $4)
        `;

        for (const snapshot of snapshots) {
          await client.query(milestoneQuery, [
            sessionId,
            `Progress_${snapshot.value}`,
            snapshot.value,
            snapshot.timestamp
          ]);
        }
      }

      return new Response(
        JSON.stringify({ success: true, sessionId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving progress snapshots:', error);
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

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      // Get snapshots from sessions table
      const sessionQuery = `
        SELECT progress_snapshots
        FROM sessions
        WHERE id = $1
      `;

      const sessionResult = await client.query(sessionQuery, [sessionId]);

      if (sessionResult.rowCount === 0) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get detailed milestone data
      const milestoneQuery = `
        SELECT milestone_name, milestone_value, achieved_at
        FROM session_milestones
        WHERE session_id = $1
        ORDER BY achieved_at ASC
      `;

      const milestoneResult = await client.query(milestoneQuery, [sessionId]);

      return new Response(
        JSON.stringify({
          sessionId,
          snapshots: sessionResult.rows[0].progress_snapshots,
          milestones: milestoneResult.rows,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching progress snapshots:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
