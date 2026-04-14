import os
import re

def cleanup_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    # 1. Find all 'from datetime import ...' lines
    # We want to remove all occurrences and put ONE consolidated at the top (after docstring)
    
    import_pattern = re.compile(r'^\s*from datetime import [^\n]*\n', re.MULTILINE)
    
    imports_found = import_pattern.findall(content)
    if not imports_found:
        return False
        
    all_datetime_imports = set()
    for imp in imports_found:
        parts = imp.split('import ')[1].strip().split(',')
        for p in parts:
            all_datetime_imports.add(p.strip())
            
    # Remove all occurrences
    cleaned_content = import_pattern.sub('', content)
    
    # Consolidated import
    consolidated = f"from datetime import {', '.join(sorted(list(all_datetime_imports)))}\n"
    
    # 2. Find insertion point (after docstring)
    # Check if file starts with docstring
    doc_match = re.match(r'^\s*(?:"""|\'\'\')(.*?)(?:"""|\'\'\')', cleaned_content, re.DOTALL)
    if doc_match:
        end_pos = doc_match.end()
        # Ensure there is a newline after docstring
        final_content = cleaned_content[:end_pos] + "\n" + consolidated + cleaned_content[end_pos:]
    else:
        # Check for #!
        shebang_match = re.match(r'^#!.*?\n', cleaned_content)
        if shebang_match:
            end_pos = shebang_match.end()
            final_content = cleaned_content[:end_pos] + consolidated + cleaned_content[end_pos:]
        else:
            final_content = consolidated + cleaned_content
            
    if final_content != content:
        with open(path, 'w') as f:
            f.write(final_content)
        return True
    return False

# Fix all .py files in ai/
files_fixed = 0
for root, dirs, files in os.walk("ai"):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                if cleanup_file(path):
                    files_fixed += 1
            except Exception as e:
                print(f"Error fixing {path}: {e}")

print(f"Cleaned up imports in {files_fixed} files.")
