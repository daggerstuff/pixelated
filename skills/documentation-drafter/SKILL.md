---
name: documentation-drafter
description: "Drafts documentation and planning prose, such as frameworks, guides, and specs."
triggers:
  - "draft the regression test framework"
  - "draft documentation"
  - "write a guide"
  - "write a spec"
---

# Documentation Drafter

Routes requests that ask for drafted documentation or planning prose. Keeps
generic "draft the ..." queries away from the `general-qa` fallback so the
negative-baseline rows in `tests/test_system_prompt_regression.py` remain
meaningful (a query must resolve to a *real* non-fallback skill).
