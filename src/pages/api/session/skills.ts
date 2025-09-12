import { Pool } from 'pg';
import type { APIRoute } from 'astro';
import { getSkillCategory } from '../../../lib/skillCategories';

// Database connection pool
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { sessionId, therapistId, skillScores } = await request.json();

    if (!sessionId || !therapistId || !skillScores) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, therapistId, skillScores' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      // Update session with skill scores
      const sessionQuery = `
        UPDATE sessions
        SET skill_scores = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `;

      const sessionResult = await client.query(sessionQuery, [
        JSON.stringify(skillScores),
        sessionId
      ]);

      if (sessionResult.rowCount === 0) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Update or insert into skill_development table for long-term tracking
      // Build batched INSERT query to avoid N+1 queries
      const skillInserts: Array<{
        therapistId: string;
        skillName: string;
        category: string;
        score: number;
      }> = [];

      // skillScores may be either { name: number } or { name: { score: number, category?: string }}
      for (const [skillName, scoreOrObj] of Object.entries(skillScores)) {
        let score: number;
        let explicitCategory: string | undefined;

        if (typeof scoreOrObj === 'object' && scoreOrObj !== null && ('score' in scoreOrObj)) {
          // @ts-ignore incoming payload from runtime
          score = Number((scoreOrObj as any).score);
          // @ts-ignore
          explicitCategory = (scoreOrObj as any).category;
        } else {
          score = Number(scoreOrObj as any);
        }

  // Determine category using helper mapping (allows expansion without changing this file)
  const category = getSkillCategory(skillName, explicitCategory);

        skillInserts.push({
          therapistId,
          skillName,
          category,
          score: score as number,
        });
      }

      if (skillInserts.length > 0) {
        // Build VALUES clause for batched insert
        // We insert: therapist_id, skill_name, skill_category, current_score, practice_sessions, last_practiced
        // For each row we need 5 parameters (last_practiced is NOW()). Build VALUES clause accordingly.
        const valuesClause = skillInserts
          .map((_, index) => `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5}, NOW())`)
          .join(', ');

        // Build parameter array
        const params: any[] = [];
        skillInserts.forEach(insert => {
          params.push(insert.therapistId, insert.skillName, insert.category, insert.score, 1);
        });

        const batchedSkillQuery = `
          INSERT INTO skill_development (
            therapist_id, skill_name, skill_category, current_score, practice_sessions, last_practiced
          ) VALUES ${valuesClause}
          ON CONFLICT (therapist_id, skill_name)
          DO UPDATE SET
            current_score = EXCLUDED.current_score,
            practice_sessions = skill_development.practice_sessions + 1,
            last_practiced = NOW(),
            updated_at = NOW()
        `;

        await client.query(batchedSkillQuery, params);
      }

      return new Response(
        JSON.stringify({ success: true, sessionId, therapistId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving skill scores:', error);
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
    const therapistId = url.searchParams.get('therapistId');

    const client = await pool.connect();
    try {
      if (sessionId) {
        // Get skill scores from specific session
        const query = `
          SELECT skill_scores
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

        return new Response(
          JSON.stringify({
            sessionId,
            skillScores: result.rows[0].skill_scores,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else if (therapistId) {
        // Get therapist's skill development history
        const query = `
          SELECT skill_name, skill_category, current_score, practice_sessions, last_practiced, created_at
          FROM skill_development
          WHERE therapist_id = $1
          ORDER BY last_practiced DESC
        `;

        const result = await client.query(query, [therapistId]);

        return new Response(
          JSON.stringify({
            therapistId,
            skills: result.rows,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ error: 'Missing sessionId or therapistId parameter' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching skill scores:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
