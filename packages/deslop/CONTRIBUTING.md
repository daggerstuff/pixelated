# Contributing to deslop

## Setup

```bash
git clone https://github.com/yourname/deslop.git
cd deslop
pip install -e ".[dev]"
```

## Development

```bash
# Run tests
pytest

# Lint
ruff check deslop/
ruff format deslop/

# Type check
mypy deslop/
```

## Adding Slop Patterns

Edit `deslop/rules/core.py`. Add patterns to `DEFAULT_SLOP_POOLS` (for
replacement) or `DEFAULT_SLOP_MARKERS` (for detection only).

Each pool entry should be:

- A list of 3-5 low-information replacements
- Variants of the same empty phrase
- Not domain-specific (this is a general tool)

## Adding Custom Rules

Users can define rules in YAML. See the README for format. If you add a new rule
type, document it in both the README and this file.

## Code Style

- Type hints on all public functions
- Docstrings on all public functions
- No `# type: ignore` unless absolutely necessary
- Keep it short. If your function is >50 lines, split it.

## Pull Requests

- One feature per PR
- Include tests for new functionality
- Update README if adding user-facing features
- No AI-generated commit messages. Write them yourself.
