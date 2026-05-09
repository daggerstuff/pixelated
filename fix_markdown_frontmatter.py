import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    lines = content.split('\n')

    # We want to find any occurrences of:
    # description: >-
    # ---
    # And fix them.

    fixed_lines = []
    i = 0
    modified = False

    while i < len(lines):
        # Look for pattern:
        # description: >-
        # ---
        if i + 1 < len(lines) and lines[i].startswith('description: >-') and lines[i+1].strip() == '---':
             # Okay, we found the broken format. Let's merge the strings following it.
             desc_lines = []
             j = i + 2
             while j < len(lines) and lines[j].startswith('  '):
                 desc_lines.append(lines[j].strip())
                 j += 1

             full_desc = " ".join(desc_lines).replace("'", "\\'")
             fixed_lines.append(f'description: "{full_desc}"')

             # now we don't append the broken ---
             i = j
             modified = True
             continue

        # Look for pattern:
        # description:
        # ---
        if i + 1 < len(lines) and lines[i].startswith('description:') and not lines[i].startswith('description: "') and lines[i+1].strip() == '---':
             desc_lines = []
             j = i + 2
             while j < len(lines) and lines[j].startswith('  '):
                 # It might have quotes already
                 stripped = lines[j].strip()
                 if stripped.startswith("'") and stripped.endswith("'"):
                     stripped = stripped[1:-1]
                 desc_lines.append(stripped)
                 j += 1

             full_desc = " ".join(desc_lines).replace("'", "\\'")
             fixed_lines.append(f'description: "{full_desc}"')
             i = j
             modified = True
             continue

        fixed_lines.append(lines[i])
        i += 1

    if modified:
        with open(filepath, 'w') as f:
            f.write("\n".join(fixed_lines))
        print(f"Fixed {filepath}")

for root, _, files in os.walk('src/content-store'):
    for file in files:
        if file.endswith('.md'):
            fix_file(os.path.join(root, file))
