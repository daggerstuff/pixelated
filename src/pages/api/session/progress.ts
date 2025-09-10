import { Pool } from 'pg';

// Database connection pool
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

export const POST = async ({ request }) => {
  try {
    const { sessionId, progressMetrics, therapistId, evaluationFeedback } = await request.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: sessionId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      // Update session with progress metrics if provided
      if (progressMetrics) {
        const query = `
          UPDATE sessions
          SET progress_metrics = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING id
        `;
        const result = await client.query(query, [
          JSON.stringify(progressMetrics),
          sessionId
        ]);
        if (result.rowCount === 0) {
          return new Response(
            JSON.stringify({ error: 'Session not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Insert evaluation feedback if provided
      if (therapistId && evaluationFeedback) {
        // Insert feedback into session_feedback table (assumes table exists)
        const feedbackQuery = `
          INSERT INTO session_feedback (session_id, therapist_id, feedback, created_at)
          VALUES ($1, $2, $3, NOW())
          RETURNING id
        `;
        await client.query(feedbackQuery, [
          sessionId,
          therapistId,
          evaluationFeedback
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
    console.error('Error saving session progress:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const includeFeedback = url.searchParams.get('includeFeedback') === 'true';

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      const query = `
        SELECT progress_metrics, progress_snapshots, skill_scores
        FROM sessions
        WHERE id = $1
      `;

      const result = await client.query(query, [sessionId]);

      if (result.rowCount === 0) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const sessionData = result.rows[0];
      let feedback = null;
      if (includeFeedback) {
        // Fetch feedback for this session
        const feedbackQuery = `
          SELECT therapist_id, feedback, created_at
          FROM session_feedback
          WHERE session_id = $1
          ORDER BY created_at DESC
        `;
        const feedbackResult = await client.query(feedbackQuery, [sessionId]);
        feedback = feedbackResult.rows;
      }
      return new Response(
        JSON.stringify({
          sessionId,
          progressMetrics: sessionData.progress_metrics,
          progressSnapshots: sessionData.progress_snapshots,
          skillScores: sessionData.skill_scores,
          feedback,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching session progress:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
