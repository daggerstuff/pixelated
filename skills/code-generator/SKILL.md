---
name: code-generator
description: "Generates code, including unit tests, for service endpoints and worker functions."
triggers:
  - "write unit tests"
  - "worker endpoints"
  - "generate code"
  - "implement a function"
---

# Code Generator

Routes requests to produce new code. Golden-set routing expectations for
this skill live in `tests/test_system_prompt_regression.py`
(`REGRESSION_DATASET`).
