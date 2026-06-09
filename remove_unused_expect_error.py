import re
from collections import defaultdict

with open("/tmp/clean_ts_errors_final.log", encoding="utf-8") as f:
    log_data = f.read()
err_pattern = re.compile(r"^(.+?):(\d+):(\d+) - error (ts\(\d+\)|TS\d+): (.*)$", re.MULTILINE)

errors_by_file = defaultdict(list)
for match in err_pattern.finditer(log_data):
    filepath, line, col, code, msg = match.groups()
    errors_by_file[filepath].append({"line": int(line) - 1, "col": int(col) - 1, "code": code.lower(), "msg": msg})

fixed = 0
for filepath, errors in errors_by_file.items():
    try:
        with open(filepath, encoding="utf-8") as f:
            lines = f.readlines()
    except Exception:
        continue

    errors.sort(key=lambda x: (x["line"], x["col"]), reverse=True)

    for err in errors:
        l_idx = err["line"]
        if l_idx >= len(lines):
            continue
        code = err["code"]
        msg = err["msg"]

        if code == "ts(2578)":  # Unused @ts-expect-error
            if "@ts-expect-error" in lines[l_idx] or "@ts-ignore" in lines[l_idx]:
                lines[l_idx] = ""  # Delete it
                fixed += 1
            elif l_idx > 0 and "@ts-expect-error" in lines[l_idx - 1]:
                lines[l_idx - 1] = ""
                fixed += 1
        elif code == "ts(1263)":  # Declarations with initializers cannot also have definite assignment assertions
            lines[l_idx] = lines[l_idx].replace("!:", ":").replace("! =", " =")
            fixed += 1

    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(lines)
