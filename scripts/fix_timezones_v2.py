import os
import re
import json
import subprocess

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    original = content
    
    # 1. Replace naive calls
    content = re.sub(r'\bdatetime\.datetime\.utcnow\(\)', 'datetime.datetime.now(timezone.utc)', content)
    content = re.sub(r'\bdatetime\.utcnow\(\)', 'datetime.now(timezone.utc)', content)
    content = re.sub(r'\bdatetime\.datetime\.now\(\)', 'datetime.datetime.now(timezone.utc)', content)
    content = re.sub(r'\bdatetime\.now\(\)', 'datetime.now(timezone.utc)', content)
    content = re.sub(r'\bdatetime\.datetime\.utcfromtimestamp\(([^)]+)\)', r'datetime.datetime.fromtimestamp(\1, timezone.utc)', content)
    content = re.sub(r'\bdatetime\.utcfromtimestamp\(([^)]+)\)', r'datetime.fromtimestamp(\1, timezone.utc)', content)

    if content == original:
        return False

    # 2. Fix imports if we added timezone.utc
    if 'timezone.utc' in content:
        # Remove any existing 'from datetime import ...' we might have added or that exist
        import_pattern = re.compile(r'^\s*from datetime import [^\n]*\n', re.MULTILINE)
        existing_imports = import_pattern.findall(content)
        
        all_imports = {"datetime"} # Default
        if existing_imports:
            for imp in existing_imports:
                parts = imp.split('import ')[1].strip().split(',')
                for p in parts:
                    all_imports.add(p.strip())
            content = import_pattern.sub('', content)
        
        all_imports.add("timezone")
        consolidated = f"from datetime import {', '.join(sorted(list(all_imports)))}\n"
        
        # Insert after shebang/docstring
        doc_match = re.match(r'^\s*(?:"""|\'\'\')(.*?)(?:"""|\'\'\')', content, re.DOTALL)
        shebang_match = re.match(r'^#!.*?\n', content)
        
        if doc_match:
            end_pos = doc_match.end()
            content = content[:end_pos] + "\n" + consolidated + content[end_pos:]
        elif shebang_match:
            end_pos = shebang_match.end()
            content = content[:end_pos] + consolidated + content[end_pos:]
        else:
            content = consolidated + content

    with open(path, 'w') as f:
        f.write(content)
    return True

def run():
    # Only target ai/ and skip .venv
    files_to_fix = []
    for root, dirs, files in os.walk("ai"):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__']
        for file in files:
            if file.endswith(".py"):
                files_to_fix.append(os.path.join(root, file))
                
    fixed = 0
    for f in files_to_fix:
        try:
            if fix_file(f):
                fixed += 1
        except Exception as e:
            print(f"Error fixing {f}: {e}")
            
    print(f"Fixed timezone usage in {fixed} files.")

if __name__ == "__main__":
    run()
