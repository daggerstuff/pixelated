import json
import re
import subprocess


def fix_pt009_safe():
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
        with open(fname, "r") as f:
            lines = f.readlines()

        # Sort diagnostics by row descending
        diags.sort(key=lambda x: x["location"]["row"], reverse=True)

        modified = False
        needs_pytest_approx = False

        for diag in diags:
            row = diag["location"]["row"] - 1
            line = lines[row]

            # Skip if it's not a simple one-liner
            if line.strip().endswith("(") or row + 1 < len(lines) and lines[row+1].strip().startswith(")"):
                # Potential multiline, skip for safety in this batch
                continue

            # 1. Handle assertTrue(x) -> assert x
            if "self.assertTrue" in line:
                m = re.search(r"(\s+)self\.assertTrue\((.*)\)", line)
                if m:
                    indent, expr = m.groups()
                    if expr.count("(") == expr.count(")"): # Basic check for matched parens in one line
                         lines[row] = f"{indent}assert {expr.strip()}\n"
                         modified = True
                         continue

            # 2. Handle assertFalse(x) -> assert not x
            if "self.assertFalse" in line:
                m = re.search(r"(\s+)self\.assertFalse\((.*)\)", line)
                if m:
                    indent, expr = m.groups()
                    if expr.count("(") == expr.count(")"):
                         lines[row] = f"{indent}assert not {expr.strip()}\n"
                         modified = True
                         continue

            # 3. Handle assertEqual(a, b) -> assert a == b
            if "self.assertEqual" in line:
                # This regex is a bit risky if there are commas in expressions
                # but we can try for simple cases.
                m = re.search(r"(\s+)self\.assertEqual\((.*)\)", line)
                if m:
                    indent, content = m.groups()
                    parts = content.rsplit(",", 1)
                    if len(parts) == 2:
                        a, b = parts
                        if a.count("(") == a.count(")") and b.count("(") == b.count(")"):
                            lines[row] = f"{indent}assert {a.strip()} == {b.strip()}\n"
                            modified = True
                            continue

        if modified:
            with open(fname, "w") as f:
                f.writelines(lines)
            files_modified += 1

    print(f"Safely fixed PT009 in {files_modified} files.")

if __name__ == "__main__":
    fix_pt009_safe()
