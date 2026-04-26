import os
import re


def fix_e402_v2(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # Identify all 'from datetime import ...' lines at the START of lines
    import_pattern = re.compile(r"^from datetime import [^\n]*\n", re.MULTILINE)
    imports_found = import_pattern.findall(content)

    if not imports_found:
        return False

    all_datetime_imports = set()
    for imp in imports_found:
        parts = imp.split("import ")[1].strip().split(",")
        for p in parts:
            all_datetime_imports.add(p.strip())

    # Remove all occurrences
    cleaned_content = import_pattern.sub("", content)

    # Consolidated import
    consolidated = f"from datetime import {', '.join(sorted(list(all_datetime_imports)))}\n"

    # 2. Find insertion point (after shebang AND docstring)
    lines = cleaned_content.splitlines(keepends=True)
    insert_pos = 0

    # Skip shebang
    if lines and lines[0].startswith("#!"):
        insert_pos = 1

    # Skip potential docstring starting at insert_pos
    if len(lines) > insert_pos:
        current_content = "".join(lines[insert_pos:]).strip()
        if current_content.startswith('"""') or current_content.startswith("'''"):
            # Find end of docstring
            doc_type = current_content[:3]
            doc_content = "".join(lines[insert_pos:])
            # Find second occurrence of doc_type
            end_match = re.search(re.escape(doc_type), doc_content[3:])
            if end_match:
                # We found the end. Now we need to find how many lines it spanned.
                end_idx = end_match.end() + 3
                doc_part = doc_content[:end_idx]
                doc_lines_count = len(doc_part.splitlines())
                insert_pos += doc_lines_count

    # Reconstruct
    final_content = "".join(lines[:insert_pos]) + "\n" + consolidated + "".join(lines[insert_pos:])

    if final_content != content:
        with open(file_path, "w") as f:
            f.write(final_content)
        return True
    return False

# Fix all .py files in ai/
files_fixed = 0
for root, dirs, files in os.walk("ai"):
    dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__"]
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                if fix_e402_v2(path):
                    files_fixed += 1
            except Exception as e:
                print(f"Error fixing {path}: {e}")

print(f"Fixed E402 in {files_fixed} files.")
