import os
import re


def fix_typing(path):
    with open(path, "r") as f:
        content = f.read()

    original = content

    # 1. Fix deprecated imports
    # from typing import ..., Dict, ... -> from typing import ...
    if "from typing import" in content:
        # Replace Dict with dict, List with list, etc.
        # But wait, if we are using them in type annotations we should use the built-ins directly.
        # If they are just in the import line and unused, we should remove them.

        # Simple approach for these specific files:
        content = content.replace(", Dict", "").replace("Dict, ", "").replace("Dict", "")
        content = content.replace(", List", "").replace("List, ", "").replace("List", "")
        content = content.replace(", Tuple", "").replace("Tuple, ", "").replace("Tuple", "")
        # Cleanup potential 'import ' or 'import ,'
        content = content.replace("import ,", "import")
        # If line becomes just 'from typing import ', remove it
        content = re.sub(r"from typing import \s*\n", "", content)

    # 2. Fix Union -> |
    if "Union[" in content:
        # ID = Union[str, int, uuid.UUID] -> ID = str | int | uuid.UUID
        content = re.sub(r"Union\[([^\]]+)\]", lambda m: " | ".join([x.strip() for x in m.group(1).split(",")]), content)

    if content != original:
        with open(path, "w") as f:
            f.write(content)
        return True
    return False

files = [
    "ai/cli/tests/__init__.py",
    "ai/infrastructure/database/persistence.py",
    "ai/memory/__init__.py",
    "ai/sourcing/journal/mcp/prompts/__init__.py",
    "ai/sourcing/journal/mcp/resources/__init__.py",
    "ai/tools/performance/stress_test.py"
]

fixed = 0
for f in files:
    if os.path.exists(f):
        if fix_typing(f):
            fixed += 1

print(f"Manually fixed UP errors in {fixed} files.")
