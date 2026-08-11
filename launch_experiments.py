"""Launch all experiment pairs on the serverless backend."""
import asyncio
import os
import sys
import time

# Load .env
with open(".env") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            os.environ[key] = val.strip().strip("'").strip('"')

from experiments.experiment_runner import launch_parallel_start, launch_remaining_batch


async def main():
    t0 = time.time()

    print("=" * 60)
    print("Phase 1: Parallel launch — Exp #1 + #3 (4 models)")
    print("=" * 60)
    results = await launch_parallel_start()
    for i, (model_a, model_b) in enumerate(results):
        exp_ids = ["1", "3"]
        print(f"  Exp #{exp_ids[i]}: A={model_a.model.name} tags={model_a.tags}, B={model_b.model.name} tags={model_b.tags}")
    print(f"Phase 1 complete in {time.time()-t0:.0f}s")

    print()
    print("=" * 60)
    print("Phase 2: Batch launch — Exp #2, #4, #5, #6 (8 models)")
    print("=" * 60)
    t1 = time.time()
    results2 = await launch_remaining_batch()
    for i, (model_a, model_b) in enumerate(results2):
        exp_ids = ["2", "4", "5", "6"]
        print(f"  Exp #{exp_ids[i]}: A={model_a.model.name} tags={model_a.tags}, B={model_b.model.name} tags={model_b.tags}")
    print(f"Phase 2 complete in {time.time()-t1:.0f}s")

    print()
    print("=" * 60)
    print(f"All 12 runs complete in {time.time()-t0:.0f}s")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
