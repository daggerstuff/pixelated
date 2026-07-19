# 🧼 Deslop CLI

**The ultimate AI Corpus Deslopping Engine.**

Are you fine-tuning an LLM? Training a specialized model? Stop feeding your models generic,
AI-generated slop. `deslop-cli` is a blazing fast, highly configurable toolkit that recursively
scans and sanitizes your JSON/JSONL datasets, stripping out AI clichés, overly enthusiastic tones,
and repetitive structural markers.

Make your synthetic datasets sound *human* again.

## 🚀 Features

* **Recursive JSON Traversal:** Doesn't matter if your dataset is a flat JSONL or deeply nested
  conversational trees. If there's a string, `deslop` will find the slop.
* **Deterministic Replacements:** Replaces slop phrases (e.g., "happy to help", "as discussed")
  with human-sounding equivalents using a Zipf-weighted distribution, preserving natural variance.
* **Ollama LLM Regen:** Need more than a regex replacement? Pass `--mode ollama` to completely rewrite the offending records dynamically using your local LLM.
* **Beautiful Remediation Reports:** Scans your dataset and generates a gorgeous terminal report of your exact Slop Density Percentage.
* **Extensible:** (Coming Soon) Bring your own `rules.yaml` to define custom jargon, slop pools, and company-specific markers.

## 📦 Installation

```bash
pip install deslop-cli
```

## 🛠️ Usage

### 1. Scan your dataset
Get a detailed Slop Remediation Report without altering your files:
```bash
deslop scan my_dataset.jsonl
```

### 2. Clean in-place (Fast Regex)
Instantly swap cliches with natural human variance:
```bash
deslop clean my_dataset.jsonl --in-place
```
*(Alternatively, specify an output file: `deslop clean in.jsonl --output out.jsonl`)*

### 3. Deep LLM Regeneration
Target the worst offenders and completely rewrite them using a local model:
```bash
deslop ollama my_dataset.jsonl --endpoint http://127.0.0.1:11434 --model llama3.2 --in-place
```

---
Built with ❤️ by Pixelated Empathy
