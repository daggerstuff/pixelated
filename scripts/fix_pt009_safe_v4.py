import os
import re
import json
import subprocess

def fix_pt009_safe_v4():
    # Get JSON output from ruff for PT009
    result = subprocess.run(
        ["uv", "run", "ruff", "check", "ai/", "--select", "PT009", "--output-format", "json"],
        capture_output=True,
        text=True
    )
    
    try:
        diagnostics = json.loads(result.stdout)
    except:
        print("No PT009 diagnostics found.")
        return

    # Group by filename
    file_map = {}
    for diag in diagnostics:
        fname = diag["filename"]
        if ".venv" in fname: continue
        if fname not in file_map:
            file_map[fname] = []
        file_map[fname].append(diag)

    files_modified = 0
    for fname, diags in file_map.items():
        with open(fname, 'r') as f:
            content = f.read()
            
        lines = content.splitlines(keepends=True)
        # Sort diagnostics by row descending
        diags.sort(key=lambda x: (x["location"]["row"], x["location"]["column"]), reverse=True)
        
        modified = False
        
        for diag in diags:
            row = diag["location"]["row"] - 1
            line = lines[row]
            
            # CRITICAL: Skip if it looks like a multiline call
            # We check if there's an opening paren but no closing one on the SAME line
            # or if the line is very long/complex
            stripped = line.strip()
            if stripped.count('(') != stripped.count(')'):
                continue
            if stripped.endswith(','): # Potential multiline arg list
                continue

            # 1. assertTrue(x) -> assert x
            if 'self.assertTrue' in line:
                m = re.search(r'^(\s*)self\.assertTrue\((.*)\)', line)
                if m:
                    indent, expr = m.groups()
                    inner = expr.strip().rstrip(')')
                    if inner.count('(') == inner.count(')'):
                        lines[row] = f"{indent}assert {inner}\n"
                        modified = True
                        continue

            # 2. assertFalse(x) -> assert not x
            if 'self.assertFalse' in line:
                m = re.search(r'^(\s*)self\.assertFalse\((.*)\)', line)
                if m:
                    indent, expr = m.groups()
                    inner = expr.strip().rstrip(')')
                    if inner.count('(') == inner.count(')'):
                        lines[row] = f"{indent}assert not {inner}\n"
                        modified = True
                        continue

            # 3. assertEqual(a, b) -> assert a == b
            if 'self.assertEqual' in line:
                m = re.search(r'^(\s*)self\.assertEqual\((.*)\)', line)
                if m:
                    indent, content_str = m.groups()
                    inner = content_str.strip().rstrip(')')
                    # Count commas at the top level of this line
                    top_level_commas = 0
                    paren_depth = 0
                    comma_pos = -1
                    for i, char in enumerate(inner):
                        if char == '(': paren_depth += 1
                        elif char == ')': paren_depth -= 1
                        elif char == ',' and paren_depth == 0:
                            top_level_commas += 1
                            comma_pos = i
                    
                    if top_level_commas == 1:
                        a = inner[:comma_pos].strip()
                        b = inner[comma_pos+1:].strip()
                        lines[row] = f"{indent}assert {a} == {b}\n"
                        modified = True
                        continue

            # 4. assertIsNone(x) -> assert x is None
            if 'self.assertIsNone' in line:
                m = re.search(r'^(\s*)self\.assertIsNone\((.*)\)', line)
                if m:
                    indent, expr = m.groups()
                    inner = expr.strip().rstrip(')')
                    if inner.count('(') == inner.count(')'):
                        lines[row] = f"{indent}assert {inner} is None\n"
                        modified = True
                        continue

            # 5. assertIsNotNone(x) -> assert x is not None
            if 'self.assertIsNotNone' in line:
                m = re.search(r'^(\s*)self\.assertIsNotNone\((.*)\)', line)
                if m:
                    indent, expr = m.groups()
                    inner = expr.strip().rstrip(')')
                    if inner.count('(') == inner.count(')'):
                        lines[row] = f"{indent}assert {inner} is not None\n"
                        modified = True
                        continue

        if modified:
            with open(fname, 'w') as f:
                f.writelines(lines)
            files_modified += 1
            
    print(f"Safely fixed PT009 in {files_modified} files.")

if __name__ == "__main__":
    fix_pt009_safe_v4()
