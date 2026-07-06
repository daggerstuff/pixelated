# cli
- Use MCP tools (Linear, project management) directly instead of Bash or file-based approaches for project management, issue tracking, and task execution. Confidence: 0.85
- Use sub-agents to investigate and fix each issue independently when multiple separate violations or bugs are identified. Confidence: 0.70
- Use the Colab CLI for managing Colab notebooks (create, launch, monitor) rather than the GUI. Confidence: 0.75

# workflow
- Overwrite original files directly instead of creating versioned copies or backup files. Confidence: 0.85
- Do not create git commits for adversarial audit tasks; leave all changes uncommitted for manual review. Confidence: 0.70
- Set a timer to check the shared coordination scratchpad at least every 10 minutes during multi-agent collaboration. Confidence: 0.85
- Treat all adversarial review warnings and audit findings as important signals; do not defer or dismiss warnings even
  if they are expected to shrink as a downstream effect of other fixes. Confidence: 0.75
- cd into the `hackathon/` directory before running project commands like lint. Confidence: 0.65

# code-style
- Maintain dark mode for all UI changes; reference DESIGN.md for the dark metal color palette. Confidence: 0.85
- Use `pnpm` instead of `npm` for package management operations. Confidence: 0.70

# prompt-engineering
- Fix issues at their source rather than applying surface-level mitigations or workarounds. Confidence: 0.85
- Do not use negative prompts (e.g., telling the model what NOT to do); instead, write positive instructions that naturally avoid undesired outputs. Confidence: 0.75
