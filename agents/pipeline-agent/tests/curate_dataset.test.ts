import { describe, it, expect } from "vitest";
import type { ToolContext } from "eve/tools";

import curateDataset from "../agent/tools/curate_dataset.js";

const ctx = {} as ToolContext;

describe("curate_dataset tool", () => {
  it("returns a curation- prefixed run id and echoes dataset id", async () => {
    const result = await curateDataset.execute(
      { dataset_id: "ds-42", include_synthetic: true },
      ctx,
    );
    expect(result.curation_run_id).toMatch(/^curation-/);
    expect(result.dataset_id).toBe("ds-42");
    expect(result.include_synthetic).toBe(true);
    expect(result.cohort_id).toBeNull();
  });

  it("passes through an optional cohort id", async () => {
    const result = await curateDataset.execute(
      { dataset_id: "ds-43", cohort_id: "cohort-9", include_synthetic: false },
      ctx,
    );
    expect(result.cohort_id).toBe("cohort-9");
    expect(result.include_synthetic).toBe(false);
  });
});
