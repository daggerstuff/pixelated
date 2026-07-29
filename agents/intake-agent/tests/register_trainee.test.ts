import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

function defineToolForTest<T extends z.ZodType>(opts: {
  description: string;
  inputSchema: T;
  execute: (input: z.infer<T>) => Promise<Record<string, unknown>>;
}) {
  return opts;
}

vi.mock("eve/tools", () => ({ defineTool: defineToolForTest }));

const storeMemoryMock = vi.fn();
vi.mock("../agent/foresight-client.js", () => ({
  storeMemory: (...args: unknown[]) => storeMemoryMock(...args),
  searchMemories: vi.fn(),
}));

// ---- CUT ----
const EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

const inputSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  clinical_role: z.string().min(1),
  experience_level: z.enum(EXPERIENCE_LEVELS),
  licensing: z.object({
    license_number: z.string().min(1),
    issuing_body: z.string().min(1),
    expiration_date: z.string(),
  }),
  clinical_background: z.object({
    specialties: z.array(z.string()).min(1),
    years_of_practice: z.number().min(0),
    therapeutic_approaches: z.array(z.string()),
  }),
  specialization: z.string().min(1),
  credentials: z.array(z.string()),
  notes: z.string().max(2000).optional(),
});

async function execute(input: z.infer<typeof inputSchema>) {
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

  const stored = await storeMemoryMock({
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
}
// ---- CUT ----

describe("register_trainee", () => {
  const validInput = {
    name: "Dr. Sarah Chen",
    email: "sarah.chen@example.com",
    clinical_role: "therapist",
    experience_level: "INTERMEDIATE" as const,
    licensing: {
      license_number: "LCSW-12345",
      issuing_body: "California Board of Behavioral Sciences",
      expiration_date: "2027-06-30",
    },
    clinical_background: {
      specialties: ["trauma", "CBT"],
      years_of_practice: 8,
      therapeutic_approaches: ["CBT", "EMDR"],
    },
    specialization: "trauma therapy",
    credentials: ["LCSW"],
  };

  beforeEach(() => {
    storeMemoryMock.mockReset();
    storeMemoryMock.mockResolvedValue({ memory_id: "mem_abc123" });
  });

  it("should register a trainee and return an ID", async () => {
    const result = await execute(validInput);

    expect(result.trainee_id).toBeDefined();
    expect(result.name).toBe("Dr. Sarah Chen");
    expect(result.email).toBe("sarah.chen@example.com");
    expect(result.status).toBe("ACTIVE");
    expect(result.next_step).toBe("assign_cohort");
    expect(storeMemoryMock).toHaveBeenCalledTimes(1);
  });

  it("should call storeMemory with the correct tags", async () => {
    await execute(validInput);
    const call = storeMemoryMock.mock.calls[0][0];
    expect(call.tags).toContain("intake");
    expect(call.tags).toContain("level:INTERMEDIATE");
    expect(call.category).toBe("trainee");
    expect(call.retention).toBe("long_term");
  });

  it("should include optional notes when provided", async () => {
    const result = await execute({
      ...validInput,
      notes: "Referred by Dr. Williams",
    });
    const stored = JSON.parse(storeMemoryMock.mock.calls[0][0].content);
    expect(stored.notes).toBe("Referred by Dr. Williams");
    expect(result.foresight_memory.memory_id).toBe("mem_abc123");
  });

  it("should set notes to null when omitted", async () => {
    await execute(validInput);
    const stored = JSON.parse(storeMemoryMock.mock.calls[0][0].content);
    expect(stored.notes).toBeNull();
  });

  it("should reject an unknown experience level", () => {
    expect(() => {
      inputSchema.parse({ ...validInput, experience_level: "EXPERT" });
    }).toThrow();
  });

  it("should reject empty name", () => {
    expect(() => {
      inputSchema.parse({ ...validInput, name: "" });
    }).toThrow();
  });

  it("should reject invalid email", () => {
    expect(() => {
      inputSchema.parse({ ...validInput, email: "not-an-email" });
    }).toThrow();
  });
});
