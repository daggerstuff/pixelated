import json
import re
import subprocess


def fix_b904():
    # Get JSON output from ruff for B904
    result = subprocess.run(
        ["uv", "run", "ruff", "check", "ai/", "--select", "B904", "--output-format", "json"],
        capture_output=True,
        text=True
    )

    try:
        diagnostics = json.loads(result.stdout)
    except:
        return

    file_map = {}
    for diag in diagnostics:
        fname = diag["filename"]
        if ".venv" in fname: continue
        if fname not in file_map:
            file_map[fname] = []
        file_map[fname].append(diag)

    files_modified = 0
    for fname, diags in file_map.items():
        with open(fname, "r") as f:
            lines = f.readlines()

        diags.sort(key=lambda x: x["location"]["row"], reverse=True)

        modified = False
        for diag in diags:
            row = diag["location"]["row"] - 1
            line = lines[row]

            # We need to find the exception variable name in the 'except' block above this line
            # Heuristic: look up for 'except ... as ...:'
            exc_name = None
            for i in range(row - 1, max(-1, row - 20), -1):
                m = re.search(r"except\s+.*?\s+as\s+(\w+)\s*:", lines[i])
                if m:
                    exc_name = m.group(1)
                    break

            if exc_name:
                if "raise " in line and " from " not in line:
                    lines[row] = line.replace("\n", "") + f" from {exc_name}\n"
                    modified = True
            else:
                # If no variable, use 'from None' or just skip for now
                if "raise " in line and " from " not in line:
                    lines[row] = line.replace("\n", "") + " from None\n"
                    modified = True

        if modified:
            with open(fname, "w") as f:
                f.writelines(lines)
            files_modified += 1

    print(f"Fixed B904 in {files_modified} files.")

if __name__ == "__main__":
    fix_b904()
