import os
import re


def fix_imports(file_path):
    with open(file_path, "r") as f:
        lines = f.readlines()

    timezone_import_pattern = re.compile(r"^\s*from datetime import ([^\n]*timezone[^\n]*)")

    timezone_lines = []
    other_lines = []

    for line in lines:
        if timezone_import_pattern.match(line):
            timezone_lines.append(line.strip())
        else:
            other_lines.append(line)

    if not timezone_lines:
        return False

    # Consolidate timezone imports
    # Example: ["from datetime import timezone, datetime", "from datetime import timezone"]
    all_imports = set()
    for line in timezone_lines:
        # Extract the parts after 'import '
        parts = line.split("import ")[1].split(",")
        for p in parts:
            all_imports.add(p.strip())

    consolidated_import = f"from datetime import {', '.join(sorted(list(all_imports)))}\n"

    # Find where to insert
    insert_pos = 0
    for i, line in enumerate(other_lines):
        if line.startswith("#!"):
            insert_pos = i + 1
        elif line.startswith('"""') or line.startswith("'''"):
            # Skip docstring
            pass
        elif line.strip() and not line.startswith("#"):
            # First real code or import
            insert_pos = i
            break

    new_content = other_lines[:insert_pos] + [consolidated_import] + other_lines[insert_pos:]

    with open(file_path, "w") as f:
        f.writelines(new_content)
    return True

# Fix all .py files in ai/
files_fixed = 0
for root, dirs, files in os.walk("ai"):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                if fix_imports(path):
                    files_fixed += 1
            except Exception as e:
                print(f"Error fixing {path}: {e}")

print(f"Fixed imports in {files_fixed} files.")
