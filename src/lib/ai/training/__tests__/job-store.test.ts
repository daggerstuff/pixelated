/* @vitest-environment node */
import { beforeEach, describe, expect, test } from "vitest";

import { MemoryJobStore } from "../job-store";
import type { FineTuningJob } from "../types";

function makeJob(overrides: Partial<FineTuningJob> = {}): FineTuningJob {
  return {
    id: "ft-1",
    model: "gpt-4o-mini",
    status: "queued",
    createdAt: new Date(),
    remoteId: "ft-job-1",
    ...overrides,
  };
}

describe("MemoryJobStore", () => {
  let store: MemoryJobStore;

  beforeEach(() => {
    store = new MemoryJobStore();
  });

  test("put + get round-trip", async () => {
    const job = makeJob();
    await store.put(job);
    const fetched = await store.get("ft-1");
    expect(fetched).toMatchObject({ id: "ft-1", remoteId: "ft-job-1" });
  });

  test("getByRemoteId resolves to local id", async () => {
    await store.put(makeJob());
    const found = await store.getByRemoteId("ft-job-1");
    expect(found?.id).toBe("ft-1");
  });

  test("updateStatus returns null for unknown id", async () => {
    const updated = await store.updateStatus("nope", "running");
    expect(updated).toBeNull();
  });

  test("updateStatus updates status and sets updatedAt", async () => {
    await store.put(makeJob());
    const updated = await store.updateStatus("ft-1", "running", {
      fineTunedModel: "ft-1:trained",
    });
    expect(updated?.status).toBe("running");
    expect(updated?.fineTunedModel).toBe("ft-1:trained");
    expect(updated?.updatedAt).toBeInstanceOf(Date);
  });

  test("list / listSync return newest-first", async () => {
    await store.put(makeJob({ id: "old", createdAt: new Date(1) }));
    await store.put(makeJob({ id: "new", createdAt: new Date(100) }));
    const all = await store.list();
    expect(all.map((j) => j.id)).toEqual(["new", "old"]);
    const syncRows = store.listSync();
    expect(syncRows.map((j) => j.id)).toEqual(["new", "old"]);
  });

  test("listByOwner filters by ownerId", async () => {
    await store.put(makeJob({ id: "alice-1", ownerId: "alice" }));
    await store.put(makeJob({ id: "bob-1", ownerId: "bob" }));
    const onlyAlice = await store.listByOwner("alice");
    expect(onlyAlice).toHaveLength(1);
    expect(onlyAlice[0]?.id).toBe("alice-1");
  });

  test("returns empty array when ownerId matches no jobs", async () => {
    await store.put(makeJob({ id: "x" }));
    const out = await store.listByOwner("nobody");
    expect(out).toEqual([]);
  });
});
