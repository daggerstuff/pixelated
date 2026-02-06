import json
import os

files_to_check = [
    'package.json',
    '/home/vivi/.gemini/extensions/logs/gemini-extension.json'
]

def check_file(path):
    if not os.path.exists(path):
        print(f"[-] Missing: {path}")
        return

    print(f"[*] Checking: {path}")
    with open(path, 'rb') as f:
        content = f.read()
        
    # Check for hidden characters/BOM
    if content.startswith(b'\xef\xbb\xbf'):
        print(f"    [!] Warning: Byte Order Mark (BOM) detected.")
    
    try:
        decoded = content.decode('utf-8')
        json.loads(decoded)
        print(f"    [+] JSON is valid.")
    except json.JSONDecodeError as e:
        print(f"    [ERROR] JSON Invalid: {e}")
    except UnicodeDecodeError:
        print(f"    [ERROR] File encoding is not UTF-8.")

for f in files_to_check:
    check_file(f)
