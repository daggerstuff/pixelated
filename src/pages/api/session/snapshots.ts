import { Pool } from 'pg';
import type { APIRoute } from 'astro';

// Database connection pool
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { sessionId, progressSnapshots } = await request.json();

    if (!sessionId || !progressSnapshots) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, progressSnapshots' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate progressSnapshots array and timestamp parseability
    if (
      !Array.isArray(progressSnapshots) ||
      !progressSnapshots.every(isValidSnapshot)
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid sessionId or progressSnapshots; timestamps must be parseable' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update session with progress snapshots
      const query = `
        UPDATE sessions
        SET progress_snapshots = $1::jsonb, updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `;

      const result = await client.query(query, [
        JSON.stringify(progressSnapshots),
        sessionId
      ]);

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Also insert into session_milestones table for detailed tracking
      if (progressSnapshots.length > 0) {
        const milestoneQuery = `
          INSERT INTO session_milestones (session_id, milestone_name, milestone_value, achieved_at)
          VALUES ($1, $2, $3, $4)
        `;

        for (const snapshot of progressSnapshots) {
          // Prefer descriptive milestone names when provided by the client.
          // Supported fields (checked in order): milestoneName, name, label.
          // If none are present, fall back to the original Progress_<value> pattern.
          const milestoneName =
            (snapshot as any).milestoneName ||
            (snapshot as any).name ||
            (snapshot as any).label ||
            `Progress_${snapshot.value}`;

          await client.query(milestoneQuery, [
            sessionId,
            milestoneName,
            snapshot.value,
            snapshot.timestamp,
          ]);
        }
      }

      await client.query('COMMIT');

      return new Response(
        JSON.stringify({ success: true, sessionId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw e;
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
          progressSnapshots: sessionResult.rows[0].progress_snapshots,
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

/**
 * Type guard for snapshot validation.
 * Ensures value is a number and timestamp is a string/number/Date
 * and is parseable as a valid date.
 */
function isValidSnapshot(s: unknown): s is Snapshot {
  if (
    typeof s !== 'object' ||
    s === null ||
    !('value' in s) ||
    !('timestamp' in s) ||
    typeof (s as any).value !== 'number'
  ) {
    return false;
  }
  const ts = (s as any).timestamp;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return !isNaN(parsed);
  }
  if (typeof ts === 'number') {
    // Accepts both ms and seconds since epoch, but new Date(ts) will handle both
    return !isNaN(new Date(ts).getTime());
  }
  if (ts instanceof Date) {
    return !isNaN(ts.getTime());
  }
  return false;
}

/**
 * Snapshot interface for session progress snapshots.
 * - value: Numeric value representing the progress or metric.
 * - timestamp: The time the snapshot was taken (string, number, or Date; must be parseable).
 */
export interface Snapshot {
  value: number;
  timestamp: string | number | Date;
}
