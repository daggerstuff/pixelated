import re
import sys
from collections import defaultdict

with open("/tmp/clean_ts_errors_final.log", encoding="utf-8") as f:
    log_data = f.read()
err_pattern = re.compile(r"^(.+?):(\d+):(\d+) - error (ts\(\d+\)|TS\d+): (.*)$", re.MULTILINE)

errors_by_file = defaultdict(list)
for match in err_pattern.finditer(log_data):
    filepath, line, col, code, msg = match.groups()
    errors_by_file[filepath].append({"line": int(line) - 1, "msg": msg})

fixed = 0
for filepath, errors in errors_by_file.items():
    try:
        with open(filepath, encoding="utf-8") as f:
            lines = f.readlines()
    except Exception:
        continue

    # if the file has "type 'never'" errors, replace empty array inferences
    has_never = any("type 'never'" in err["msg"] for err in errors)
    if has_never:
        for i in range(len(lines)):
            if re.search(r"(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*\[\]", lines[i]):
                lines[i] = re.sub(r"(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*\[\]", r"\1 \2: any[] = []", lines[i])
                fixed += 1
            if re.search(r"([a-zA-Z0-9_]+)\s*:\s*\[\]", lines[i]):
                # in interfaces or objects
                lines[i] = re.sub(r"([a-zA-Z0-9_]+)\s*:\s*\[\]", r"\1: any[]", lines[i])
                fixed += 1

    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(lines)

sys.stdout.write(f"Fixed {fixed} empty array inferences to prevent never[].\n")
