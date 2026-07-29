import { defineTool } from "eve/tools";
import { z } from "zod";

import { storeMemory, searchMemories } from "../foresight-client.js";

const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const COHORT_STATUSES = ["UPCOMING", "ACTIVE", "COMPLETED"] as const;

const SCHEMA = z.object({
  trainee_id: z.string().uuid().describe("UUID of the trainee to assign."),
  cohort_id: z.string().optional().describe("Existing cohort ID. Omit to create a new cohort."),
  name: z
    .string()
    .min(1)
    .optional()
    .describe('Cohort name (e.g. "2026-Q3"). Required when creating a new cohort.'),
  skill_level: z
    .enum(SKILL_LEVELS)
    .optional()
    .describe("Skill level for this cohort. Required when creating."),
  start_date: z
    .string()
    .optional()
    .describe("Cohort start date (ISO date). Required when creating."),
  end_date: z.string().optional().describe("Cohort end date (ISO date)."),
  curriculum_id: z.string().optional().describe("Curriculum definition ID."),
});

export default defineTool({
  description:
    "Assign a trainee to a cohort. If cohort_id is provided, assigns to an " +
    "existing cohort. If omitted, creates a new cohort with the given parameters " +
    "first. Cohorts are defined by both time window and skill level. A trainee " +
    "may only be in one ACTIVE cohort at a time.",
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    let cohortId = input.cohort_id;
    const assignedAt = new Date().toISOString();

    // If no cohort_id, create a new cohort
    if (!cohortId) {
      if (!input.name || !input.skill_level || !input.start_date) {
        return {
          error: true,
          message: "Creating a new cohort requires name, skill_level, and start_date.",
        };
      }
      cohortId = crypto.randomUUID();

      const cohort = {
        type: "cohort_definition",
        cohort_id: cohortId,
        name: input.name,
        skill_level: input.skill_level,
        start_date: input.start_date,
        end_date: input.end_date ?? null,
        curriculum_id: input.curriculum_id ?? "default",
        status: "ACTIVE" as const,
        created_at: assignedAt,
      };

      await storeMemory({
        content: JSON.stringify(cohort),
        category: "cohort",
        scope: "cohort",
        retention: "long_term",
        importance: 0.7,
        tags: [
          `cohort:${cohortId}`,
          `level:${input.skill_level}`,
          `cohort_name:${input.name}`,
          "cohort_definition",
        ],
      });
    }

    // Check trainee is not already in an ACTIVE cohort
    const existing = await searchMemories({
      query: `trainee:${input.trainee_id} enrollment active`,
      limit: 5,
      tag_filter: [`trainee:${input.trainee_id}`],
    });

    const hasActive = (existing ?? []).some((m) => {
      try {
        const parsed = JSON.parse(m.content) as { status?: string };
        return parsed.status === "ACTIVE";
      } catch {
        return false;
      }
    });

    if (hasActive) {
      return {
        error: true,
        message:
          "Trainee is already assigned to an ACTIVE cohort. Use adjust_trainee_status to reassign.",
        trainee_id: input.trainee_id,
      };
    }

    // Create assignment record
    const assignment = {
      type: "cohort_assignment",
      trainee_id: input.trainee_id,
      cohort_id: cohortId,
      status: "ACTIVE",
      assigned_at: assignedAt,
    };

    const stored = await storeMemory({
      content: JSON.stringify(assignment),
      category: "enrollment",
      scope: "trainee",
      retention: "long_term",
      importance: 0.7,
      tags: [
        `trainee:${input.trainee_id}`,
        `cohort:${cohortId}`,
        "enrollment",
        "cohort_assignment",
      ],
    });

    return {
      trainee_id: input.trainee_id,
      cohort_id: cohortId,
      status: "ACTIVE",
      assigned_at: assignedAt,
      foresight_memory: stored ?? {
        memory_id: null,
        note: "Foresight MCP write may have failed.",
      },
    };
  },
});
