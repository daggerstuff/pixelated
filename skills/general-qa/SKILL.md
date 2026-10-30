---
name: general-qa
description: "Fallback skill for general factual questions that no specialized skill owns."
triggers:
  - "general question"
  - "factual question"
  - "capital of a country"
  - "quick lookup"
---

# General QA

Default intent target. Any query whose trigger keywords do not score higher
on a specialized skill is routed here. Also acts as the router fallback
(`[routing] fallback_skill` in `config.toml`).
