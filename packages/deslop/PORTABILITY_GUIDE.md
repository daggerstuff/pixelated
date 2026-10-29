# Deslop & Anti-Sycophancy Engine — Portability & Integration Guide

A unified, production-ready system for stripping AI slop, conversational filler, and reflexive sycophancy from both **datasets** and **live AI agent generation loops**.

---

## 1. System Architecture

The setup consists of two tightly integrated layers designed to address AI-generated conversational decay:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Incoming Prompt / Input                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │          LLM Agent Turn           │
                     └─────────────────┬─────────────────┘
                                       │ (Draft Output)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Anti-Sycophancy Gate (deslop.gate / AntiSycophancyGate)            │
│ ─────────────────────────────────────────────────────────────────────────── │
│ • Fast deterministic string rejection (zero model roundtrip)               │
│ • Detects banned sycophantic openers ("I hear how", "It makes sense that")  │
│ • Detects reflexive caving/backtracking ("You're right, I apologize")       │
│ • Detects mechanical quote-parroting ("You mentioned", "Hearing you say")  │
│ • Detects canned empathy boilerplate ("holding space", "I hear you")        │
│ • Generates targeted retry correction prompts on failure                    │
└──────────────────────┬──────────────────────────────────┬───────────────────┘
                       │                                  │
                 (Passed Gate)                     (Rejected Gate)
                       │                                  │
                       ▼                                  ▼
┌──────────────────────────────────────────────┐   ┌──────────────────────────┐
│ Layer 2: Deterministic Deslopper             │   │ Bounded Agent Retry Loop │
│ (deslop.engine / clean_text)                 │   │ (AgentGuard)             │
│ ──────────────────────────────────────────── │   │ ──────────────────────── │
│ • Weighted replacement pools                 │   │ Inject correction prompt │
│ • Punctuation & spacing normalization        │   │ and re-invoke LLM        │
│ • Rule packs: generic-ai, chatbot-assistant, │   └──────────────────────────┘
│   sycophancy, clinical, sales, devrel, etc.  │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
                 Guarded Output
```

---

## 2. Portability & Packaging Options

The engine has been packaged to support any stack or agent architecture:

| Delivery Target | Method | Primary Use Case |
| :--- | :--- | :--- |
| **Python Package** | `pip install deslop-cli` or `dist/*.whl` | Direct Python import in agent runtimes |
| **Standalone Drop-In** | `anti_sycophancy_filter.py` | Zero-dependency single-file embed in any repo |
| **MCP Server** | `deslop mcp` (stdio) | Native tool for Claude Desktop, Cursor, Antigravity, OpenCode |
| **HTTP REST Microservice** | Docker / `marketplace/deslop-saas` | Non-Python agents (Node.js, Go, Rust, Ruby) |
| **CLI / Shell Pipe** | `deslop gate` / `deslop text` | CI/CD pipelines, pre-commit hooks, bash scripts |

---

## 3. Integration Recipes

### A. Python Agent with Bounded Retry (`AgentGuard`)

```python
from openai import OpenAI
from deslop.agent import AgentGuard
from deslop.gate import AntiSycophancyGate

client = OpenAI()
guard = AgentGuard(
    gate=AntiSycophancyGate.default(),
    auto_clean_residual=True  # Cleans lingering filler phrases after gate passes
)

def call_llm(messages):
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )
    return response.choices[0].message.content

# Guard automatically checks output, injects targeted corrections on failure,
# and retries up to max_retries before returning.
safe_reply = guard.run(
    call_fn=call_llm,
    prompt_or_messages=[{"role": "user", "content": "I disagree with your previous point."}],
    max_retries=3
)
```

Async support:
```python
safe_reply = await guard.arun(async_llm_callable, messages, max_retries=3)
```

### B. Direct Functional API

```python
import deslop

# 1. Check an agent turn
result = deslop.check_turn("I hear how difficult this must be for you.")
if not result.passed:
    print(f"Rejected: {result.reason}")
    print(f"Correction for prompt: {result.correction}")

# 2. Clean slop from text
cleaned = deslop.clean_text(
    "I'd be happy to help you deep dive and leverage this solution moving forward.",
    packs=["generic-ai", "sycophancy", "chatbot-assistant"]
)
# Result: "I can examine and use this solution next."

# 3. Scan for slop markers
findings = deslop.scan_text("Let's delve into this robust framework.")
# Result: ['delve into', 'robust']
```

### C. Zero-Dependency Drop-in (`anti_sycophancy_filter.py`)

Copy `packages/deslop/standalone/anti_sycophancy_filter.py` directly into any codebase. Requires **only Python standard library**:

```python
from anti_sycophancy_filter import AntiSycophancyGate, is_sycophantic, clean_text_basic

# Instant check
is_bad, reason = is_sycophantic("You're right, I apologize.")

# Gate object
gate = AntiSycophancyGate.general_assistant()
result = gate.check(agent_draft)
```

### D. Model Context Protocol (MCP) Server for Agents

Add to your MCP configuration (e.g., `claude_desktop_config.json`, Cursor, OpenCode):

```json
{
  "mcpServers": {
    "deslop": {
      "command": "deslop",
      "args": ["mcp"]
    }
  }
}
```

Or run via python directly:
```json
{
  "mcpServers": {
    "deslop": {
      "command": "python",
      "args": ["-m", "deslop.mcp"]
    }
  }
}
```

**Exposed MCP Tools:**
- `deslop_gate`: Validates text and returns pass/fail + retry correction guidance.
- `deslop_clean`: Rewrites slop using weighted deterministic replacements.
- `deslop_scan`: Detects slop patterns across rule packs.

### E. HTTP REST Microservice (For Node.js, Go, Rust, etc.)

Run the containerized microservice:
```bash
docker run -p 8000:8000 pixelated/deslop-saas:latest
```

**Check text endpoint:**
```bash
curl -X POST http://localhost:8000/gate \
  -H "Content-Type: application/json" \
  -d '{"text": "I hear how hard this is for you."}'
```
Response:
```json
{
  "passed": false,
  "reason": "banned_sycophantic_opener: 'i hear how'",
  "tag": "banned_sycophantic_opener",
  "matched": "i hear how",
  "correction": "CORRECTION: The draft was rejected (banned_sycophantic_opener: 'i hear how').\n The draft opened with praise or a reflective cliché. Start with direct engagement in your own words."
}
```

**Clean text endpoint:**
```bash
curl -X POST http://localhost:8000/clean-text \
  -H "Content-Type: application/json" \
  -d '{"text": "Happy to help you with this.", "packs": ["generic-ai", "sycophancy"]}'
```

### F. CLI & Shell Pipelines

```bash
# Validate string in shell / git pre-commit hook (exits 0 if clean, 1 if sycophantic)
deslop gate "Let's review the code line by line."

# Pipe via stdin
echo "I hear how difficult this is." | deslop gate --json

# Clean text from CLI
deslop text "Happy to help you deep dive into this."
```

---

## 4. Rule Packs Reference

Deslop ships with 13 bundled rule packs:

| Rule Pack | Marker Count | Description |
| :--- | :--- | :--- |
| `generic-ai` | ~45 | LLM buzzwords ("delve into", "tapestry", "robust", "game-changer") |
| `sycophancy` | ~75 | Reflexive agreement, caving, flattery, canned validation |
| `chatbot-assistant` | ~35 | Assistant boilerplate ("certainly", "as an AI", "happy to help") |
| `clinical` | ~35 | Therapy buzzwords ("holding space", "sitting with that", "safe space") |
| `therapy-simulation`| ~30 | Formulaic therapist queries ("what comes up for you", "what does that mean") |
| `fabrication-signal` | ~15 | Suspicious statistic citations and consensus claims |
| `customer-support` | ~30 | CSR filler ("we apologize for any inconvenience", "rest assured") |
| `sales` | ~30 | Marketing fluff ("unlock growth", "drive value", "maximize ROI") |
| `devrel` | ~30 | Developer hype ("seamlessly integrate", "battle-tested", "blazing fast") |
| `academic` | ~30 | Scholarly filler ("this paper delves into", "further research is needed") |
| `roleplay` | ~25 | Stage directions ("smirks", "eyes sparkle", "chuckles softly") |
| `synthetic-evals` | ~15 | Formulaic reasoning cues ("the key insight is", "by process of elimination") |
| `bias` | ~50 | Stereotypical backhanded descriptors and tropes |

---

## 5. Artifacts and Build Files

The distribution artifacts are located in:
- Wheel: `packages/deslop/dist/deslop_cli-0.3.0-py3-none-any.whl`
- Source tarball: `packages/deslop/dist/deslop_cli-0.3.0.tar.gz`
- Standalone zero-dep script: `packages/deslop/standalone/anti_sycophancy_filter.py`
- SaaS microservice: `marketplace/deslop-saas/`
