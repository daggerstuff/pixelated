import { defineTool } from "eve/tools";
import { z } from "zod";

import { storeMemory } from "../foresight-client.js";

const EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

const SCHEMA = z.object({
  name: z.string().min(1).max(200).describe("Full name of the trainee."),
  email: z.string().email().describe("Email address for contact and platform access."),
  clinical_role: z
    .string()
    .min(1)
    .describe("Clinical role (e.g. therapist, counselor, psychologist)."),
  experience_level: z.enum(EXPERIENCE_LEVELS).describe("Self-reported experience level."),
  licensing: z
    .object({
      license_number: z.string().min(1).describe("Professional license number."),
      issuing_body: z.string().min(1).describe("Licensing board or authority."),
      expiration_date: z.string().describe("License expiration date (ISO date string)."),
    })
    .describe("Professional licensing information."),
  clinical_background: z
    .object({
      specialties: z
        .array(z.string())
        .min(1)
        .describe("Clinical specialties (e.g. CBT, trauma, adolescent)."),
      years_of_practice: z.number().min(0).describe("Years of clinical practice."),
      therapeutic_approaches: z.array(z.string()).describe("Therapeutic modalities trained in."),
    })
    .describe("Clinical background and training."),
  specialization: z.string().min(1).describe("Primary clinical specialization or focus area."),
  credentials: z.array(z.string()).describe("Professional credentials (e.g. LCSW, LMFT, PhD)."),
  notes: z.string().max(2000).optional().describe("Optional intake notes."),
});

export default defineTool({
  description:
    "Register a new clinical trainee with their full profile including licensing, " +
    "clinical background, specialization, and credentials. Creates a long-term " +
    "Foresight record and returns the trainee ID for cohort assignment.",
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const traineeId = crypto.randomUUID();
    const enrolledAt = new Date().toISOString();

    const profile = {
      type: "trainee_profile",
      trainee_id: traineeId,
      name: input.name,
      email: input.email,
      clinical_role: input.clinical_role,
      experience_level: input.experience_level,
      licensing: input.licensing,
      clinical_background: input.clinical_background,
      specialization: input.specialization,
      credentials: input.credentials,
      notes: input.notes ?? null,
      status: "ACTIVE",
      enrolled_at: enrolledAt,
    };

    const stored = await storeMemory({
      content: JSON.stringify(profile),
      category: "trainee",
      scope: "trainee",
      retention: "long_term",
      importance: 0.8,
      tags: [`trainee:${traineeId}`, "intake", "enrollment", `level:${input.experience_level}`],
    });

    return {
      trainee_id: traineeId,
      name: input.name,
      email: input.email,
      status: "ACTIVE",
      enrolled_at: enrolledAt,
      foresight_memory: stored ?? {
        memory_id: null,
        note: "Foresight MCP write failed or server unreachable.",
      },
      next_step: "assign_cohort",
    };
  },
});
