import os
import re

def fix_unclosed_calls(path):
    with open(path, 'r') as f:
        lines = f.readlines()
    
    modified = False
    for i, line in enumerate(lines):
        # Pattern 1: assert ... == len(something
        if 'assert' in line and 'len(' in line and line.count('(') > line.count(')'):
            if line.strip().endswith('('): continue # Skip multiline start
            # Add missing parenthesis
            lines[i] = line.rstrip() + ")\n"
            modified = True
            
        # Pattern 2: self.assertIn("key", something
        elif 'self.assertIn(' in line and line.count('(') > line.count(')'):
            if line.strip().endswith('('): continue
            lines[i] = line.rstrip() + ")\n"
            modified = True

        # Pattern 3: self.assertIsInstance(something, type
        elif 'self.assertIsInstance(' in line and line.count('(') > line.count(')'):
            if line.strip().endswith('('): continue
            lines[i] = line.rstrip() + ")\n"
            modified = True

    if modified:
        with open(path, 'w') as f:
            f.writelines(lines)
        return True
    return False

def run():
    fixed = 0
    for root, dirs, files in os.walk("ai"):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__']
        for file in files:
            if file.endswith(".py"):
                if fix_unclosed_calls(os.path.join(root, file)):
                    fixed += 1
    print(f"Fixed unclosed calls in {fixed} files.")

if __name__ == "__main__":
    run()
