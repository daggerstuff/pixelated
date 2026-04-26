import os
import re


def fix_datetime_usage(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    original_content = content

    # Patterns to replace
    # We use \b to ensure we match whole words and avoid partial matches

    # 1. datetime.datetime.utcnow() -> datetime.datetime.now(timezone.utc)
    content = re.sub(r"\bdatetime\.datetime\.utcnow\(\)", "datetime.datetime.now(timezone.utc)", content)

    # 2. datetime.utcnow() -> datetime.now(timezone.utc)
    content = re.sub(r"\bdatetime\.utcnow\(\)", "datetime.now(timezone.utc)", content)

    # 3. datetime.datetime.now() -> datetime.datetime.now(timezone.utc)
    # Only if it has no arguments (DTZ005)
    content = re.sub(r"\bdatetime\.datetime\.now\(\)", "datetime.datetime.now(timezone.utc)", content)

    # 4. datetime.now() -> datetime.now(timezone.utc)
    # Only if it has no arguments (DTZ005)
    content = re.sub(r"\bdatetime\.now\(\)", "datetime.now(timezone.utc)", content)

    # 5. datetime.utcfromtimestamp(ts) -> datetime.fromtimestamp(ts, timezone.utc)
    content = re.sub(r"\bdatetime\.datetime\.utcfromtimestamp\(([^)]+)\)", r"datetime.datetime.fromtimestamp(\1, timezone.utc)", content)
    content = re.sub(r"\bdatetime\.utcfromtimestamp\(([^)]+)\)", r"datetime.fromtimestamp(\1, timezone.utc)", content)

    if content != original_content:
        # Check if we need to add 'from datetime import timezone'
        if "timezone.utc" in content:
            # Case 1: 'from datetime import ...' already exists
            if "from datetime import" in content:
                # Find the line
                match = re.search(r"from datetime import ([^\n]+)", content)
                if match:
                    imports = match.group(1)
                    if "timezone" not in imports:
                        new_import_line = f"from datetime import timezone, {imports}"
                        content = content.replace(match.group(0), new_import_line)
            # Case 2: 'import datetime' exists but not 'from datetime import'
            elif "import datetime" in content:
                # We could use datetime.timezone.utc, but the instruction says add 'from datetime import timezone'
                # Let's add it after 'import datetime'
                content = re.sub(r"(import datetime\n)", r"\1from datetime import timezone\n", content)
            # Case 3: No datetime imports found (unlikely if now() was used but possible with local imports)
            else:
                # Add at the top
                content = "from datetime import timezone\n" + content

        with open(file_path, "w") as f:
            f.write(content)
        return True
    return False

# Get all .py files in ai/
files_to_check = []
for root, dirs, files in os.walk("ai"):
    for file in files:
        if file.endswith(".py"):
            files_to_check.append(os.path.join(root, file))

fixed_count = 0
for file_path in files_to_check:
    try:
        if fix_datetime_usage(file_path):
            fixed_count += 1
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")

print(f"Fixed {fixed_count} files.")
