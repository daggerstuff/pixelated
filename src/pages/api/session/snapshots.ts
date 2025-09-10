import { Pool } from 'pg';
import type { APIRoute } from 'astro';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { sessionId, progressSnapshots } = await request.json();

    if (!sessionId || !progressSnapshots) {
      return new Response(JSON.stringify({ error: 'Missing required fields: sessionId, progressSnapshots' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!Array.isArray(progressSnapshots) || !progressSnapshots.every(isValidSnapshot)) {
      return new Response(JSON.stringify({ error: 'Invalid progressSnapshots array' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateQuery = 'UPDATE sessions SET progress_snapshots = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING id';
      const updateRes = await client.query(updateQuery, [JSON.stringify(progressSnapshots), sessionId]);
      if (updateRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      if (progressSnapshots.length > 0) {
        const milestoneQuery = 'INSERT INTO session_milestones (session_id, milestone_name, milestone_value, achieved_at) VALUES ($1, $2, $3, $4)';
        for (const snapshot of progressSnapshots) {
          const milestoneName = (snapshot as any).milestoneName || (snapshot as any).name || (snapshot as any).label || `Progress_${(snapshot as any).value}`;
          await client.query(milestoneQuery, [sessionId, milestoneName, (snapshot as any).value, (snapshot as any).timestamp]);
        }
      }

      await client.query('COMMIT');
      return new Response(JSON.stringify({ success: true, sessionId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      console.error('DB error in POST /api/session/snapshots', err);
      return new Response(JSON.stringify({ error: 'Database error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error handling POST /api/session/snapshots', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId parameter' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const client = await pool.connect();
    try {
      const sessionQuery = 'SELECT progress_snapshots FROM sessions WHERE id = $1';
      const sessionResult = await client.query(sessionQuery, [sessionId]);
      if (sessionResult.rowCount === 0) {
        return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      const milestoneQuery = 'SELECT milestone_name, milestone_value, achieved_at FROM session_milestones WHERE session_id = $1 ORDER BY achieved_at ASC';
      const milestoneResult = await client.query(milestoneQuery, [sessionId]);

      return new Response(JSON.stringify({ sessionId, progressSnapshots: sessionResult.rows[0].progress_snapshots, milestones: milestoneResult.rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error handling GET /api/session/snapshots', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

function isValidSnapshot(s: unknown): s is Snapshot {
  if (typeof s !== 'object' || s === null) {
    return false;
  }
  const obj = s as any;
  if (!('value' in obj) || !('timestamp' in obj)) {
    return false;
  }
  if (typeof obj.value !== 'number') {
    return false;
  }
  const ts = obj.timestamp;
  if (typeof ts === 'string') {
    return !isNaN(Date.parse(ts));
  }
  if (typeof ts === 'number') {
    return !isNaN(new Date(ts).getTime());
  }
  if (ts instanceof Date) {
    return !isNaN(ts.getTime());
  }
  return false;
}


export interface Snapshot { value: number; timestamp: string | number | Date }
