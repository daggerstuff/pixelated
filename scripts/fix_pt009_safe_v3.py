import os
import re
import json
import subprocess

def fix_pt009_safe_v3():
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
            lines = f.readlines()
            
        # Sort diagnostics by row descending
        diags.sort(key=lambda x: (x["location"]["row"], x["location"]["column"]), reverse=True)
        
        modified = False
        
        for diag in diags:
            row = diag["location"]["row"] - 1
            line = lines[row]
            
            # Skip if it looks like a multiline call (contains opening paren but no closing paren on same line)
            if line.count('(') > line.count(')'):
                continue

            # 1. assertTrue(x) -> assert x
            if 'self.assertTrue' in line:
                m = re.search(r'^(\s*)self\.assertTrue\((.*)\)', line)
                if m:
                    indent, expr = m.groups()
                    lines[row] = f"{indent}assert {expr.strip().rstrip(')')}\n"
                    modified = True
                    continue

            # 2. assertFalse(x) -> assert not x
            if 'self.assertFalse' in line:
                m = re.search(r'^(\s*)self\.assertFalse\((.*)\)', line)
                if m:
                    indent, expr = m.groups()
                    lines[row] = f"{indent}assert not {expr.strip().rstrip(')')}\n"
                    modified = True
                    continue

            # 3. assertEqual(a, b) -> assert a == b
            if 'self.assertEqual' in line:
                m = re.search(r'^(\s*)self\.assertEqual\((.*)\)', line)
                if m:
                    indent, content = m.groups()
                    # Only handle simple cases where there is exactly one comma at top level
                    content = content.strip().rstrip(')')
                    if content.count(',') == 1:
                        a, b = content.split(',')
                        lines[row] = f"{indent}assert {a.strip()} == {b.strip()}\n"
                        modified = True
                        continue

            # 4. assertIsNone(x) -> assert x is None
            if 'self.assertIsNone' in line:
                m = re.search(r'^(\s*)self\.assertIsNone\((.*)\)', line)
                if m:
                    indent, expr = m.groups()
                    lines[row] = f"{indent}assert {expr.strip().rstrip(')')} is None\n"
                    modified = True
                    continue

            # 5. assertIsNotNone(x) -> assert x is not None
            if 'self.assertIsNotNone' in line:
                m = re.search(r'^(\s*)self\.assertIsNotNone\((.*)\)', line)
                if m:
                    indent, expr = m.groups()
                    lines[row] = f"{indent}assert {expr.strip().rstrip(')')} is not None\n"
                    modified = True
                    continue

        if modified:
            with open(fname, 'w') as f:
                f.writelines(lines)
            files_modified += 1
            
    print(f"Safely fixed PT009 in {files_modified} files.")

if __name__ == "__main__":
    fix_pt009_safe_v3()
