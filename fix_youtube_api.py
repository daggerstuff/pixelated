import re

file_path = "ai/sourcing/youtube/api.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add the import statement
import_statement = "from googleapiclient.discovery import build\n"
if import_statement not in content:
    # Insert after standard library imports (or logging)
    content = re.sub(
        r'(import logging\n)',
        rf'\1{import_statement}',
        content
    )

# Replace the TODO comment
todo_regex = r'(self\.api_key = api_key\n\s+)# TODO: Initialize YouTube client with api_key'
replacement = r'\1self.client = build("youtube", "v3", developerKey=self.api_key) if self.api_key else None'

content = re.sub(todo_regex, replacement, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Modification complete.")
