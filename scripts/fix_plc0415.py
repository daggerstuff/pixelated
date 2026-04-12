import os
import re

def fix_plc0415(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Identify local imports (indented imports)
    # This is complex to do via regex safely, but let's try to target common patterns
    # inside functions or methods.
    
    # Pattern for local imports: indented 'import x' or 'from x import y'
    # We only target those that Ruff flags.
    
    lines = content.splitlines(keepends=True)
    new_top_imports = []
    other_lines = []
    
    # Simple heuristic: find indented imports that are likely PLC0415
    # and move them to top.
    
    # We skip imports inside 'if TYPE_CHECKING:' or 'try:' blocks for now as they might be intentional
    
    in_function = False
    modified = False
    
    # Better approach: use ruff's own report to be surgical
    return False # Placeholder for now, I'll use a better strategy

import subprocess
import json

def surgical_fix_plc0415():
    result = subprocess.run(
        ["uv", "run", "ruff", "check", "ai/", "--select", "PLC0415", "--output-format", "json"],
        capture_output=True,
        text=True
    )
    
    try:
        diagnostics = json.loads(result.stdout)
    except:
        return

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
            
        # Sort by row descending
        diags.sort(key=lambda x: x["location"]["row"], reverse=True)
        
        extracted_imports = []
        for diag in diags:
            row = diag["location"]["row"] - 1
            line = lines[row]
            
            # Extract the import line
            if 'import ' in line:
                # Keep indentation for later if needed, but here we want to clean it
                import_line = line.strip() + "\n"
                extracted_imports.append(import_line)
                lines.pop(row)
                modified = True

        if extracted_imports:
            # Insert at top (after docstring/shebang)
            insert_pos = 0
            if lines and lines[0].startswith("#!"):
                insert_pos = 1
            
            # Skip docstring
            if len(lines) > insert_pos and (lines[insert_pos].strip().startswith('"""') or lines[insert_pos].strip().startswith("'''")):
                doc_type = lines[insert_pos].strip()[:3]
                for i in range(insert_pos + 1, len(lines)):
                    if doc_type in lines[i]:
                        insert_pos = i + 1
                        break
            
            # Insert unique imports
            unique_imports = sorted(list(set(extracted_imports)))
            lines[insert_pos:insert_pos] = unique_imports + ["\n"]
            
            with open(fname, 'w') as f:
                f.writelines(lines)
            files_modified += 1
            
    print(f"Surgically fixed PLC0415 in {files_modified} files.")

if __name__ == "__main__":
    surgical_fix_plc0415()
