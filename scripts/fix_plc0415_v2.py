import os
import json
import subprocess
import re

def fix_plc0415_batch():
    # Get JSON output from ruff for PLC0415
    result = subprocess.run(
        ["uv", "run", "ruff", "check", "ai/", "--select", "PLC0415", "--output-format", "json"],
        capture_output=True,
        text=True
    )
    
    try:
        diagnostics = json.loads(result.stdout)
    except:
        print("No PLC0415 diagnostics found.")
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
        
        extracted_imports = []
        modified = False
        
        for diag in diags:
            row = diag["location"]["row"] - 1
            line = lines[row]
            
            # Extract the import line
            if 'import ' in line:
                import_line = line.strip() + "\n"
                extracted_imports.append(import_line)
                
                # Replace with pass if needed to keep block non-empty
                # Check if next non-empty line has smaller indentation or if it's the end of file
                indent = len(line) - len(line.lstrip())
                has_content_after = False
                for i in range(row + 1, len(lines)):
                    if lines[i].strip():
                        next_indent = len(lines[i]) - len(lines[i].lstrip())
                        if next_indent <= indent:
                            # End of block reached
                            break
                        else:
                            has_content_after = True
                            break
                
                # Check if previous line is a ':' (like 'if condition:' or 'def func():')
                is_start_of_block = False
                for i in range(row - 1, -1, -1):
                    if lines[i].strip():
                        if lines[i].strip().endswith(':'):
                            is_start_of_block = True
                        break
                
                if is_start_of_block and not has_content_after:
                    # We are the only thing in the block, replace with pass
                    lines[row] = (" " * indent) + "pass\n"
                else:
                    # Just remove the line
                    lines.pop(row)
                modified = True

        if modified and extracted_imports:
            # Insert at top (after docstring/shebang)
            insert_pos = 0
            if lines and lines[0].startswith("#!"):
                insert_pos = 1
            
            # Skip docstring
            if len(lines) > insert_pos:
                doc_found = False
                for i in range(insert_pos, min(len(lines), insert_pos + 5)):
                    stripped = lines[i].strip()
                    if stripped.startswith('"""') or stripped.startswith("'''"):
                        doc_type = stripped[:3]
                        if stripped.endswith(doc_type) and len(stripped) > 3:
                            # Single-line docstring
                            insert_pos = i + 1
                            doc_found = True
                            break
                        else:
                            # Multi-line docstring
                            for j in range(i + 1, len(lines)):
                                if doc_type in lines[j]:
                                    insert_pos = j + 1
                                    doc_found = True
                                    break
                            if doc_found: break
                
            # Insert unique imports
            unique_imports = sorted(list(set(extracted_imports)))
            lines[insert_pos:insert_pos] = unique_imports + ["\n"]
            
            with open(fname, 'w') as f:
                f.writelines(lines)
            files_modified += 1
            
    print(f"Fixed PLC0415 in {files_modified} files.")

if __name__ == "__main__":
    fix_plc0415_batch()
