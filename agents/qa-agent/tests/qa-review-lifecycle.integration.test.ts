import { describe, it, expect } from "vitest";
import { z } from "zod";

// --- Shared schemas ---

const fetchSessionsSchema = z.object({
  since: z.string().datetime(),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

const scoreSessionSchema = z.object({
  session_id: z.string().uuid(),
  cohort_id: z.string().min(1),
  rubric_version: z.string().min(1),
});

const detectPatternsSchema = z.object({
  session_id: z.string().uuid(),
  cohort_id: z.string().min(1),
  reference_period_days: z.number().int().min(1).max(180).default(30),
});

const flagGapSchema = z.object({
  session_id: z.string().uuid(),
  cohort_id: z.string().min(1),
  rationale: z.string().max(2000),
  priority: z.number().int().min(0).max(4),
  labels: z.array(z.string()).default([]),
});

const generateReportSchema = z.object({
  cohort_id: z.string().min(1),
  rubric_version: z.string().min(1),
  scoring_session_ids: z.array(z.string().uuid()).min(0).max(200),
  linear_ticket_references: z
    .array(
      z.object({
        session_id: z.string().uuid(),
        ticket_identifier: z.string(),
        priority: z.number().int().min(0).max(4),
      }),
    )
    .default([]),
});

const summarizeCohortSchema = z.object({
  cohort_id: z.string().min(1),
  rubric_version: z.string().min(1),
  since: z.string().datetime(),
});

// --- Execute bodies ---

async function fetchSessions(input: z.infer<typeof fetchSessionsSchema>) {
  return {
    since: input.since,
    limit: input.limit,
    cursor: input.cursor ?? null,
    next_cursor: null,
    sessions: [],
    fetched_at: new Date().toISOString(),
  };
}

async function scoreSession(input: z.infer<typeof scoreSessionSchema>) {
  return {
    session_id: input.session_id,
    cohort_id: input.cohort_id,
    rubric_version: input.rubric_version,
    state: "REVIEWED",
    scored_at: new Date().toISOString(),
    placeholder_dimensions: ["rapport", "open_questions", "reflection", "boundaries", "crisis_recognition"],
  };
}

async function detectPatterns(input: z.infer<typeof detectPatternsSchema>) {
  return {
    session_id: input.session_id,
    cohort_id: input.cohort_id,
    reference_period_days: input.reference_period_days,
    analyzed_at: new Date().toISOString(),
    pattern_flags: [],
    recommendation: "hold",
  };
}

let _gapCounter = 0;
async function flagGap(input: z.infer<typeof flagGapSchema>) {
  _gapCounter++;
  const identifier = `QA-${Date.now().toString(36)}${_gapCounter}`.toUpperCase();
  return {
    ticket_identifier: identifier,
    ticket_url_stub: `https://linear.app/pixelated/issue/${identifier}`,
    session_id: input.session_id,
    priority: input.priority,
    labels: input.labels ?? [],
    created_at: new Date().toISOString(),
  };
}

async function generateReport(input: z.infer<typeof generateReportSchema>) {
  return {
    cohort_id: input.cohort_id,
    rubric_version: input.rubric_version,
    session_count: input.scoring_session_ids.length,
    ticket_count: input.linear_ticket_references.length,
    rendered_at: new Date().toISOString(),
    digest_blocks: [],
    completed_with: "qa-agent.subagents.report-writer:v0",
  };
}

async function summarizeCohort(input: z.infer<typeof summarizeCohortSchema>) {
  return {
    cohort_id: input.cohort_id,
    rubric_version: input.rubric_version,
    since: input.since,
    aggregates: { mean: {}, p10: {}, p90: {} },
    top_gap_trainees: [],
    aggregated_at: new Date().toISOString(),
  };
}

// --- Integration tests ---

describe("QA review lifecycle integration", () => {
  const cohortId = "cohort-alpha";
  const rubricVersion = "2026.Q3.Starter";
  const since = "2026-01-01T00:00:00.000Z";

  it("should fetch sessions and score each one", async () => {
    const fetch = await fetchSessions({ since, limit: 50 });
    expect(fetch.sessions).toHaveLength(0);

    const scoredIds = (fetch.sessions as string[]).map((s) => s);
    for (const sid of scoredIds) {
      const scored = await scoreSession({ session_id: sid, cohort_id: cohortId, rubric_version: rubricVersion });
      expect(scored.state).toBe("REVIEWED");
    }
  });

  it("should preserve cohort_id across all tools in the flow", async () => {
    const sid = "550e8400-e29b-41d4-a716-446655440000";

    const fetch = await fetchSessions({ since, limit: 50 });
    const scored = await scoreSession({ session_id: sid, cohort_id: cohortId, rubric_version: rubricVersion });
    const patterns = await detectPatterns({ session_id: sid, cohort_id: cohortId });
    const gap = await flagGap({ session_id: sid, cohort_id: cohortId, rationale: "Test", priority: 2 });

    expect(scored.cohort_id).toBe(cohortId);
    expect(patterns.cohort_id).toBe(cohortId);
    expect(gap.session_id).toBe(sid);
  });

  it("should produce zero tickets when no sessions exist", async () => {
    const report = await generateReport({
      cohort_id: cohortId,
      rubric_version: rubricVersion,
      scoring_session_ids: [],
      linear_ticket_references: [],
    });
    expect(report.session_count).toBe(0);
    expect(report.ticket_count).toBe(0);
    expect(report.completed_with).toBe("qa-agent.subagents.report-writer:v0");
  });

  it("should count sessions and tickets in the report", async () => {
    const sids = [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
    ];
    const gaps = await Promise.all(
      sids.map((sid) =>
        flagGap({ session_id: sid, cohort_id: cohortId, rationale: "Gap found", priority: 1 }),
      ),
    );

    const report = await generateReport({
      cohort_id: cohortId,
      rubric_version: rubricVersion,
      scoring_session_ids: sids,
      linear_ticket_references: gaps.map((g, i) => ({
        session_id: sids[i],
        ticket_identifier: g.ticket_identifier,
        priority: 1,
      })),
    });

    expect(report.session_count).toBe(3);
    expect(report.ticket_count).toBe(3);
  });

  it("should run emotion pattern detection on each scored session", async () => {
    const sid = "550e8400-e29b-41d4-a716-446655440000";
    const patterns = await detectPatterns({
      session_id: sid,
      cohort_id: cohortId,
      reference_period_days: 30,
    });
    expect(patterns.session_id).toBe(sid);
    expect(patterns.recommendation).toBe("hold");
    expect(patterns.pattern_flags).toHaveLength(0);
  });

  it("should generate cohort summary with correct params", async () => {
    const summary = await summarizeCohort({
      cohort_id: cohortId,
      rubric_version: rubricVersion,
      since,
    });
    expect(summary.cohort_id).toBe(cohortId);
    expect(summary.rubric_version).toBe(rubricVersion);
    expect(summary.aggregates).toHaveProperty("mean");
    expect(summary.aggregates).toHaveProperty("p10");
    expect(summary.aggregates).toHaveProperty("p90");
    expect(summary.top_gap_trainees).toHaveLength(0);
  });

  it("should default emotion recommendation to hold", async () => {
    const sid = "550e8400-e29b-41d4-a716-446655440000";
    const patterns = await detectPatterns({ session_id: sid, cohort_id: cohortId });
    expect(patterns.recommendation).toBe("hold");
  });

  it("should score sessions with the correct rubric version", async () => {
    const sid = "550e8400-e29b-41d4-a716-446655440000";
    const scored = await scoreSession({
      session_id: sid,
      cohort_id: cohortId,
      rubric_version: rubricVersion,
    });
    expect(scored.rubric_version).toBe(rubricVersion);
    expect(scored.placeholder_dimensions).toContain("rapport");
    expect(scored.placeholder_dimensions).toContain("crisis_recognition");
  });

  it("should generate unique ticket identifiers for each gap", async () => {
    const sid = "550e8400-e29b-41d4-a716-446655440000";
    const gap1 = await flagGap({ session_id: sid, cohort_id: cohortId, rationale: "Gap 1", priority: 1 });
    const gap2 = await flagGap({ session_id: sid, cohort_id: cohortId, rationale: "Gap 2", priority: 2 });
    expect(gap1.ticket_identifier).not.toBe(gap2.ticket_identifier);
  });
});
