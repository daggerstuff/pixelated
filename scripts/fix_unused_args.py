import os
import json
import subprocess
import re

def fix_unused_args():
    # Get JSON output from ruff for ARG001, ARG002
    result = subprocess.run(
        ["uv", "run", "ruff", "check", "ai/", "--select", "ARG001,ARG002", "--output-format", "json"],
        capture_output=True,
        text=True
    )
    
    try:
        diagnostics = json.loads(result.stdout)
    except:
        print("No ARG diagnostics found.")
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
            
        # Sort diagnostics by row descending to avoid offset issues
        # and column descending for multiple on same line
        diags.sort(key=lambda x: (x["location"]["row"], x["location"]["column"]), reverse=True)
        
        modified = False
        for diag in diags:
            row = diag["location"]["row"] - 1
            col = diag["location"]["column"] - 1
            msg = diag["message"]
            
            # Extract arg name from message: Unused function argument: `arg_name`
            arg_match = re.search(r'`([^`]+)`', msg)
            if not arg_match: continue
            arg_name = arg_match.group(1)
            
            line = lines[row]
            # Check if arg_name is at col
            if line[col:col+len(arg_name)] == arg_name:
                # Replace with _arg_name
                lines[row] = line[:col] + "_" + line[col:]
                modified = True

        if modified:
            with open(fname, 'w') as f:
                f.writelines(lines)
            files_modified += 1
            
    print(f"Fixed unused arguments in {files_modified} files.")

if __name__ == "__main__":
    fix_unused_args()
