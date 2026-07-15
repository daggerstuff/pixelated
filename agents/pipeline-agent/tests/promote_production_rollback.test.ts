import { describe, it, expect } from "vitest";
import type { ToolContext } from "eve/tools";

import promoteToProduction from "../agent/tools/promote_to_production.js";
import rollbackModel from "../agent/tools/rollback_model.js";

const ctx = {} as ToolContext;

describe("promote_to_production tool", () => {
  it("deploys to the production namespace and returns a release- id", async () => {
    const result = await promoteToProduction.execute(
      {
        staging_release_id: "stg-1",
        image_tag: "v1",
        release_notes: "ship it",
      },
      ctx,
    );
    expect(result.deploy_namespace).toBe("pixelated-prod");
    expect(result.production_release_id).toMatch(/^release-/);
    expect(result.staging_release_id).toBe("stg-1");
  });
});

describe("rollback_model tool", () => {
  it("rolls back to the previous release and records the reason", async () => {
    const result = await rollbackModel.execute(
      {
        current_release_id: "rel-2",
        previous_release_id: "rel-1",
        reason: "regression",
      },
      ctx,
    );
    expect(result.rolled_back_to).toBe("rel-1");
    expect(result.from_release).toBe("rel-2");
    expect(result.reason).toBe("regression");
  });
});
