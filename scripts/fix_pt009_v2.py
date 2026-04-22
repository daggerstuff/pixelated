import json
import re
import subprocess


def fix_pt009_batch():
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

        diags.sort(key=lambda x: (x["location"]["row"], x["location"]["column"]), reverse=True)

        modified = False
        needs_pytest_approx = False

        for diag in diags:
            row = diag["location"]["row"] - 1
            col = diag["location"]["column"] - 1
            line = lines[row]

            # 1. Handle assertAlmostEqual(a, b, places=n) -> assert a == pytest.approx(b, abs=10**-n)
            match_ae = re.search(r"self\.assertAlmostEqual\(([^,]+),\s*([^,]+),\s*places=(\d+)\)", line)
            if match_ae:
                a, b, n = match_ae.groups()
                tol = 10**(-int(n))
                indent = line[:line.find("self")]
                lines[row] = f"{indent}assert {a.strip()} == pytest.approx({b.strip()}, abs={tol})\n"
                modified = True
                needs_pytest_approx = True
                continue

            # 2. Handle assertEquals(a, b) -> assert a == b
            if "self.assertEqual" in line:
                match = re.search(r"self\.assertEqual\((.*)\)", line)
                if match:
                    args = match.group(1).split(",", 1)
                    if len(args) == 2:
                        indent = line[:line.find("self")]
                        lines[row] = f"{indent}assert {args[0].strip()} == {args[1].strip()}\n"
                        modified = True
                        continue

            # 3. Handle assertTrue(x) -> assert x
            if "self.assertTrue" in line:
                match = re.search(r"self\.assertTrue\((.*)\)", line)
                if match:
                    expr = match.group(1)
                    indent = line[:line.find("self")]
                    lines[row] = f"{indent}assert {expr.strip()}\n"
                    modified = True
                    continue

            # 4. Handle assertFalse(x) -> assert not x
            if "self.assertFalse" in line:
                match = re.search(r"self\.assertFalse\((.*)\)", line)
                if match:
                    expr = match.group(1)
                    indent = line[:line.find("self")]
                    lines[row] = f"{indent}assert not {expr.strip()}\n"
                    modified = True
                    continue

            # 5. Handle assertIn(a, b) -> assert a in b
            if "self.assertIn" in line:
                match = re.search(r"self\.assertIn\(([^,]+),\s*([^)]+)\)", line)
                if match:
                    a, b = match.groups()
                    indent = line[:line.find("self")]
                    lines[row] = f"{indent}assert {a.strip()} in {b.strip()}\n"
                    modified = True
                    continue

        if modified:
            if needs_pytest_approx:
                if not any("import pytest" in l for l in lines):
                    # Find insertion point
                    lines.insert(0, "import pytest\n")

            with open(fname, "w") as f:
                f.writelines(lines)
            files_modified += 1

    print(f"Fixed PT009 assertions in {files_modified} files.")

if __name__ == "__main__":
    fix_pt009_batch()
