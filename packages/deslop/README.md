```
 ██████╗ ███████╗██████╗ ██████╗ ███████╗██████╗
 ██╔══██╗██╔════╝██╔═══╝ ██╔══██╗██╔════╝██╔══██╗
 ██║  ██║█████╗  ██║     ██████╔╝█████╗  ██████╔╝
 ██║  ██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗
 ██████╔╝███████╗╚██████╗██║     ███████╗██║  ██║
 ╚═════╝ ╚══════╝ ╚═════╝╚═╝     ╚══════╝╚═╝  ╚═╝
                    clean your data.
```

[![PyPI version](https://img.shields.io/pypi/v/deslop-cli.svg)](https://pypi.org/project/deslop-cli/)
[![Python versions](https://img.shields.io/pypi/pyversions/deslop-cli.svg)](https://pypi.org/project/deslop-cli/)

**deslop** is a dataset hygiene CLI for teams fine-tuning, evaluating, or
selling synthetic data. It detects AI-cliché contamination, produces audit
reports, previews safe rewrites, and cleans JSON/JSONL records while preserving
schema.

## Why it exists

Synthetic corpora often contain repeated assistant phrases: "happy to help,"
"robust," "moving forward," "as an AI language model," and other polish that
makes downstream models sound generic. deslop gives data teams a measurable
quality gate before training, evals, or delivery.

## Features

- Real-time anti-sycophancy gate (`deslop gate` / `deslop.gate`) for agent generation loops
- Automated agent retry coordinator (`AgentGuard`) with actionable prompt repair
- Single text cleaning (`deslop text`) and pattern scanning
- Built-in Model Context Protocol (MCP) stdio server (`deslop mcp`)
- Field-aware JSON/JSONL scanning with record IDs, field paths, snippets, and pattern counts
- Deterministic cleaning with weighted replacement pools and detect-only marker removal
- Preview and diff commands before writing files
- HTML, Markdown, and JSON quality reports
- CI density gate via `--fail-on-density`
- Bundled rule packs for generic AI, support, clinical, sales, devrel, academic,
  roleplay, therapy simulation, chatbot, and synthetic eval datasets
- Custom `rules.yaml` without mutating global defaults
- Ollama regeneration that defaults to flagged records only and validates
  top-level schema
- Zero-dependency standalone drop-in script (`standalone/anti_sycophancy_filter.py`)

## Install

```bash
pip install deslop-cli
```

## Quick start

### Real-Time Anti-Sycophancy Gate (CLI & Python)

Check text for sycophancy, caving phrases, or canned clichés (exits 0 if clean, 1 if rejected):

```bash
deslop gate "I hear how difficult this has been for you."
```

In Python agent loops:

```python
from deslop.gate import AntiSycophancyGate

gate = AntiSycophancyGate.default()
result = gate.check(assistant_response)

if not result.passed:
    print(f"Rejected: {result.reason}")
    print(f"Correction for prompt: {result.correction}")
```

### Auto-Retrying Agent Interceptor (`AgentGuard`)

Wrap any LLM callable with automatic anti-sycophancy check and prompt retry:

```python
from deslop.agent import AgentGuard

guard = AgentGuard(auto_clean_residual=True)
safe_text = guard.run(llm_callable, user_messages, max_retries=3)
```

### Clean a Single Text String

```bash
deslop text "Happy to help you deep dive into this moving forward."
# Output: "Glad to pitch in you look into this next."
```

### Model Context Protocol (MCP) Server for Agents

Expose tools (`deslop_gate`, `deslop_clean`, `deslop_scan`) to Claude Desktop, Cursor, or OpenCode:

```bash
deslop mcp
```

### Dataset Scanning & Cleaning

Scan a dataset:

```bash
deslop scan data.jsonl
```

Emit machine-readable JSON:

```bash
deslop scan data.jsonl --json
```

Create a shareable audit report:

```bash
deslop scan data.jsonl --report deslop-report.html
```

Preview changes without writing:

```bash
deslop preview data.jsonl --limit 20
```

Clean to a new file:

```bash
deslop clean data.jsonl --output clean.jsonl
```

Clean in place with a backup:

```bash
deslop clean data.jsonl --in-place --backup
```

Use rule packs and field filters:

```bash
deslop scan data.jsonl --packs generic-ai,clinical --fields messages.*.content,response
```

Fail CI when contamination is too high:

```bash
deslop scan data.jsonl --fail-on-density 5
```

Regenerate flagged records with Ollama:

```bash
deslop regen data.jsonl --output regen.jsonl --provider ollama --endpoint http://127.0.0.1:11434 --model llama3.2
```

## Rule packs

List bundled packs:

```bash
deslop rules list
```

Inspect a pack:

```bash
deslop rules explain clinical
```

Use a custom rules file:

```bash
deslop scan data.jsonl --rules examples/rules.example.yaml
```

Custom file shape:

```yaml
markers:
  - bespoke slop

pools:
  delighted to assist:
    - ['I can help', 0.35]
    - ["I'll take a look", 0.25]
    - [null, 0.4]
```

## Development

```bash
cd packages/deslop
uv sync --dev
uv run pytest -q
uv run python -m deslop.cli scan tests/fixtures/sample.jsonl
```

## Business surface

deslop is designed to become more than a one-off regex cleaner:

- quality reports for dataset vendors
- CI gates for fine-tuning pipelines
- domain-specific private rule packs
- hosted dataset audit API
- certification reports for synthetic data deliveries
- eval hooks to measure whether cleanup improves downstream behavior

## License

MIT
