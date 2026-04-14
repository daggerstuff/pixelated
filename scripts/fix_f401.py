import os
import json
import subprocess

def fix_f401_f841():
    # Get JSON output from ruff for F401
    result = subprocess.run(
        ["uv", "run", "ruff", "check", "ai/", "--select", "F401", "--output-format", "json"],
        capture_output=True,
        text=True
    )
    
    try:
        diagnostics = json.loads(result.stdout)
    except json.JSONDecodeError:
        print("No diagnostics found or error running ruff.")
        return

    # Group by filename
    file_map = {}
    for diag in diagnostics:
        fname = diag["filename"]
        if fname not in file_map:
            file_map[fname] = []
        file_map[fname].append(diag)

    files_modified = 0
    for fname, diags in file_map.items():
        if ".venv" in fname:
            continue
            
        with open(fname, 'r') as f:
            lines = f.readlines()
            
        # Sort diagnostics by row descending to avoid offset issues
        diags.sort(key=lambda x: x["location"]["row"], reverse=True)
        
        modified = False
        for diag in diags:
            row = diag["location"]["row"] - 1 # 0-indexed
            msg = diag["message"]
            
            # Simple line removal or modification
            line = lines[row]
            
            # If the diagnostic gives a column range, we might want to be more surgical
            # but for F401 it's usually the whole import or a part of it.
            
            # For now, let's try to be smart about multi-name imports
            if "imported but unused" in msg:
                # Handle cases like 'from typing import Any, Dict' where only Dict is unused
                import_match = re.search(r'`([^`]+)` imported but unused', msg)
                if import_match:
                    name = import_match.group(1).split('.')[-1]
                    if ',' in line:
                        # Multi-import line
                        # Remove the name and the comma
                        new_line = re.sub(rf'\b{name}\b\s*,?', '', line).replace(', ,', ',').strip(', \n') + '\n'
                        # Cleanup leftover commas
                        new_line = new_line.replace('import ,', 'import')
                        if new_line.strip().endswith('import'):
                             lines.pop(row)
                        else:
                             lines[row] = new_line
                        modified = True
                    else:
                        # Single import line
                        lines.pop(row)
                        modified = True

        if modified:
            with open(fname, 'w') as f:
                f.writelines(lines)
            files_modified += 1
            
    print(f"Manually fixed F401 in {files_modified} files.")

import re
if __name__ == "__main__":
    fix_f401_f841()
