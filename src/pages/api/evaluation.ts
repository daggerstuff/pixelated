import { Pool } from 'pg';
import type { APIRoute } from 'astro';
import { z } from 'zod';

// Database connection pool
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

const GetQuerySchema = z.object({
  sessionId: z.string().min(1),
});

const PostBodySchema = z.object({
  sessionId: z.string().min(1),
  feedback: z.string().min(1),
  evaluatorId: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  comments: z.string().optional(),
});
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
      // Get evaluations from evaluations table
      const query = `
        SELECT id, session_id, feedback, created_at
        FROM evaluations
        WHERE session_id = $1
        ORDER BY created_at DESC
      `;

      const result = await client.query(query, [sessionId]);

      return new Response(
        JSON.stringify(result.rows),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { sessionId, feedback } = await request.json();

    if (!sessionId || !feedback) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, feedback' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      // Insert evaluation into evaluations table
      const query = `
        INSERT INTO evaluations (session_id, feedback, created_at)
        VALUES ($1, $2, NOW())
        RETURNING id, session_id, feedback, created_at
      `;

      const result = await client.query(query, [sessionId, feedback]);

      // Also update session with latest evaluation feedback
      const sessionQuery = `
        UPDATE sessions
        SET context = jsonb_set(
          COALESCE(context, '{}'::jsonb),
          '{latestEvaluation}',
          $1::jsonb
        ),
        updated_at = NOW()
        WHERE id = $2
      `;

      await client.query(sessionQuery, [
        JSON.stringify({
          feedback: feedback,
          timestamp: new Date().toISOString(),
          evaluator: 'therapist' // Default evaluator
        }),
        sessionId
      ]);

      return new Response(
        JSON.stringify(result.rows[0]),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving evaluation:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
