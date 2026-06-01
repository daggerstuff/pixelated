---
description: Python AI code standards
applyTo: 'ai/**/*.py'
---

# Python AI Instructions

## Style

- PEP 8. Use `uv run` for all Python commands. Never raw `python` or `pip`.
- Type hints on all function signatures. Use `typing` module.
- Docstrings on all public functions (Google style).

## Patterns

- Treat `ai/` as a submodule — own commit discipline.
- No hardcoded credentials or API keys. Use environment variables.
- All ML experiments must be reproducible (seed everything).

## Testing

- Run `uv run pytest` for Python tests.
- Tests live in `tests/` directory.
