---
name: code-review
description: "Reviews git commits, diffs, and pull requests for correctness and style."
triggers:
  - "review a commit"
  - "review this diff"
  - "commit diff"
  - "pull request review"
---

# Code Review

Routes requests to inspect and critique existing changes. Golden-set routing
expectations for this skill live in `tests/test_system_prompt_regression.py`
(`REGRESSION_DATASET`).
