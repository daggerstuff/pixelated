# Evaluation Gating (therapy-bench, clinical similarity)

This change adds CI gates to block merges when evals regress.

What runs:
- TherapyBench persistence and schema checks
- Clinical Similarity Search standalone checks

How to run locally:
- pnpm test:evals
  - Requires uv (Python) installed; the CI step installs uv automatically.

Thresholds policy:
- Start with non-regression policy: failing tests indicate material regressions in persistence, schema, or core search invariants. Quantitative thresholds can be tightened later as baselines stabilize.

CI Integration:
- Azure Pipelines stage adds a job "Evaluation Gates (therapy-bench, clinical-similarity)" before Build.
- The job installs Node and uv, then runs pnpm test:evals. Any failure fails the pipeline.

Updating thresholds:
- For new baselines, update tests or add explicit numeric assertions once metrics are stabilized.

Artifacts:
- Future enhancement: publish JSON summaries to pipeline artifacts for dashboards.
