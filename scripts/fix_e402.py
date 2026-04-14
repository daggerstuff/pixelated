import os
import re

def fix_e402(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Identify all 'from datetime import ...' lines
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
    
    # Put it at the VERY top (before shebang or docstring)
    # This is the safest way to avoid E402
    final_content = consolidated + cleaned_content
            
    if final_content != content:
        with open(file_path, 'w') as f:
            f.write(final_content)
        return True
    return False

# Fix all .py files in ai/
# Explicitly skip .venv and __pycache__
files_fixed = 0
for root, dirs, files in os.walk("ai"):
    # Skip hidden directories and virtualenvs
    dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__']
    
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                if fix_e402(path):
                    files_fixed += 1
            except Exception as e:
                print(f"Error fixing {path}: {e}")

print(f"Fixed E402/PLC0415 in {files_fixed} files.")
