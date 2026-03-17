import re
with open("ai/sourcing/youtube/api.py", "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "self.client = build(" in line and len(line) > 88:
        # split it
        lines[i] = '        self.client = (\n            build("youtube", "v3", developerKey=self.api_key)\n            if self.api_key\n            else None\n        )\n'

with open("ai/sourcing/youtube/api.py", "w") as f:
    f.writelines(lines)
