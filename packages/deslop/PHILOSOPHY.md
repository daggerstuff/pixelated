# Philosophy

## Why deslop exists

AI models produce text. Some of that text is useful. Most of it is filler.

"Happy to help!", "Let's dive in!", "Great question!" — these phrases carry zero
information. They exist because the model was trained on polite human
conversation and learned to mimic it. When you're processing thousands of
documents, this noise compounds.

deslop removes the noise.

## What slop is

Slop is text that:

- Carries no semantic meaning
- Exists only to fill space or sound polite
- Is immediately recognizable as generic
- Could be deleted without losing information

It's not wrong text. It's not misinformation. It's just... empty.

## What deslop is not

- A writing assistant. It doesn't improve your prose.
- A grammar checker. It doesn't fix errors.
- A content filter. It doesn't judge quality.

It's a scalpel for removing dead weight from AI-generated text.

## Design principles

1. **Regex first, LLMs second.** Deterministic patterns are fast, free, and
   predictable. Use them when they work.

2. **Dense, not pretty.** The terminal output shows you what you need. No
   animations, no spinners, no decorative anything.

3. **Customizable, not complex.** Three slop pools and a YAML file. That's the
   entire configuration surface.

4. **Privacy by default.** Everything runs locally. Your data never leaves your
   machine unless you explicitly call the Ollama endpoint.
