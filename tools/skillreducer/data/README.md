# Sample skills for SkillReducer

Run SkillReducer against these example skill folders:

```bash
# Audit all sample skills
skillreducer audit data --recursive

# Optimize one skill (heuristic, no API key)
skillreducer reduce data/pdf-processing --no-llm

# Optimize with Agno agent (requires api_key in .env)
skillreducer agent data/pdf-processing

# Batch optimize entire data folder
skillreducer agent data --recursive --output optimized/
```

## Included skills

| Folder | Scenario | Expected Stage 1 | Expected Stage 2 |
|--------|----------|------------------|------------------|
| [pdf-processing](pdf-processing/) | Verbose description + monolithic body (examples/templates in SKILL.md) | Compress redundant trigger phrases | Split into `examples.md`, `templates.md`, `background.md` |
| [api-testing](api-testing/) | **Missing** description (empty frontmatter) | Generate description from body | Core rules only in SKILL.md |
| [marketing-strategy](marketing-strategy/) | Long description + large body (paper-style bloat) | DDMIN compression | Progressive disclosure |
| [sql-analytics](sql-analytics/) | Skill with separate `reference.md` (overlap with body) | Trim description | Dedup references |

## Output

Optimized skills are written to `optimized/<skill-name>/` by default (original `data/` folder is never modified).
