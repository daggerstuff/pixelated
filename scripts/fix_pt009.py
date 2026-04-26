import os
import re


def fix_pt009_surgical(path):
    with open(path, "r") as f:
        lines = f.readlines()

    modified = False
    new_lines = []
    for line in lines:
        # self.assertAlmostEqual(a, b, places=5) -> assert a == pytest.approx(b, abs=1e-5)
        if "self.assertAlmostEqual" in line:
            match = re.search(r"self\.assertAlmostEqual\((.*),\s*places=(\d+)\)", line)
            if match:
                expr = match.group(1)
                places = int(match.group(2))
                tol = 10**(-places)
                indent = line[:line.find("self")]
                new_line = f"{indent}assert {expr} == pytest.approx({expr.split(',')[-1].strip()}, abs={tol})\n"
                # Wait, expr.split(',')[-1] is wrong if expr is 'a, b'
                # Let's be simpler:
                match_full = re.search(r"self\.assertAlmostEqual\(([^,]+),\s*([^,]+),\s*places=(\d+)\)", line)
                if match_full:
                    a = match_full.group(1).strip()
                    b = match_full.group(2).strip()
                    places = int(match_full.group(3))
                    tol = 10**(-places)
                    new_line = f"{indent}assert {a} == pytest.approx({b}, abs={tol})\n"
                    new_lines.append(new_line)
                    modified = True
                    continue
        new_lines.append(line)

    if modified:
        # Ensure pytest is imported
        if not any("import pytest" in l for l in new_lines):
            # Insert at top or after other imports
            new_lines.insert(0, "import pytest\n")

        with open(path, "w") as f:
            f.writelines(new_lines)
        return True
    return False

files = [
    "ai/lab/tests/test_integration_end_to_end.py",
    "ai/lab/tests/test_processing_components.py",
    "ai/monitoring/test_quality_analytics_dashboard_v2.py",
    "ai/tests/test_integration_end_to_end.py",
    "ai/tests/test_processing_components.py"
]

fixed = 0
for f in files:
    if os.path.exists(f):
        try:
            if fix_pt009_surgical(f):
                fixed += 1
        except Exception as e:
            print(f"Error fixing {f}: {e}")

print(f"Surgically fixed PT009 in {fixed} files.")
