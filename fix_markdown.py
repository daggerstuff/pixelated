#!/usr/bin/env python3
"""Fix markdownlint issues in session-ses_04b1.md."""

import re
import textwrap

INPUT = "/data/vivi/pixelated/session-ses_04b1.md"
OUTPUT = "/data/vivi/pixelated/session-ses_04b1.md"

with open(INPUT, encoding="utf-8") as f:
    lines = f.readlines()

# 1. Fix MD010: hard tabs -> spaces (in code blocks and everywhere)
new_lines = []
for line in lines:
    if "\t" in line:
        line = line.expandtabs(4)
    new_lines.append(line)
lines = new_lines

# 2. Fix MD009: trailing spaces
new_lines = []
for line in lines:
    new_lines.append(line.rstrip() + "\n")
lines = new_lines

# 3. Fix MD018: no space after hash on atx heading
# Also fix MD037: spaces inside emphasis markers like "* (foo)" -> "*(foo)*"
# Also fix MD050: __text__ -> **text** for strong style
# Also fix MD036: **Tool: X** -> ### Tool: X (emphasis used as heading)
# Also fix duplicate headings by appending line number reference
heading_counts = {}

new_lines = []
for i, line in enumerate(lines, 1):
    stripped = line.rstrip()

    # MD036: **Tool: X** -> ### Tool: X
    m = re.match(r"^(\s*)\*\*(Tool:\s*\S[^\*]*)\*\*(\s*)$", stripped)
    if m:
        indent = m.group(1)
        tool_text = m.group(2)
        line = f"{indent}### {tool_text}\n"
        stripped = line.rstrip()

    # MD018: #2 -> # 2 (no space after hash)
    stripped = re.sub(r"^(#+)(\d)", r"\1 \2", stripped)

    # MD037: spaces inside emphasis markers like "* (" or "5 *"
    stripped = re.sub(r"\*\s+\(", "*(", stripped)
    stripped = re.sub(r"\*\s+text", "*text", stripped)  # generic pattern
    # More specific: spaces immediately inside * or _
    stripped = re.sub(r"\*(\s)", r"*\1", stripped)
    stripped = re.sub(r"(\s)\*", r"\1*", stripped)

    # MD050: __text__ -> **text**
    stripped = re.sub(r"__([^_]+)__", r"**\1**", stripped)

    # Track headings for MD024
    if re.match(r"^#{1,6}\s+", stripped):
        heading_text = stripped.strip()
        if heading_text in heading_counts:
            heading_counts[heading_text] += 1
            # Append line number to make unique (but keep original first occurrence)
            # Actually we need to rename duplicates, not the first one
        else:
            heading_counts[heading_text] = 1

    new_lines.append(stripped + "\n" if not stripped.endswith("\n") else stripped + "\n")

lines = new_lines

# Fix MD024: duplicate headings - make them unique by appending (2), (3), etc.
heading_counts = {}
new_lines = []
for line in lines:
    stripped = line.rstrip()
    m = re.match(r"^(#{1,6}\s+)(.+)$", stripped)
    if m:
        prefix = m.group(1)
        text = m.group(2)
        full = prefix + text
        if full in heading_counts:
            heading_counts[full] += 1
            line = f"{prefix}{text} ({heading_counts[full]})\n"
        else:
            heading_counts[full] = 1
    new_lines.append(line)
lines = new_lines

# 4. Fix MD013: wrap long lines (>180 chars)
# Only wrap non-code, non-preformatted lines
new_lines = []
in_code_block = False
for line in lines:
    stripped = line.rstrip()
    if stripped.startswith("```"):
        in_code_block = not in_code_block
        new_lines.append(line)
        continue
    if in_code_block:
        new_lines.append(line)
        continue
    if len(stripped) > 180:
        # Wrap the line
        wrapped = textwrap.fill(stripped, width=180)
        for wl in wrapped.split("\n"):
            new_lines.append(wl + "\n")
    else:
        new_lines.append(line)

lines = new_lines

# 5. Fix MD012: no multiple consecutive blank lines
new_lines = []
prev_blank = False
for line in lines:
    is_blank = line.strip() == ""
    if is_blank and prev_blank:
        continue
    prev_blank = is_blank
    new_lines.append(line)
lines = new_lines

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"Fixed {INPUT}")
print(f"Lines: {len(lines)}")
