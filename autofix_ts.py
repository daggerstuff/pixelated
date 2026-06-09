import logging
import re
from collections import defaultdict

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

ERROR_PATTERN = re.compile(
    r"^\s*([a-zA-Z0-9_/\.-]+)(?::(\d+):(\d+)\s*-\s*|\((\d+),(\d+)\):\s*)error\s+(ts\(\d+\)|TS\d+):\s*(.*)",
    re.IGNORECASE,
)


def parse_errors(log_path: str) -> dict[str, list[dict]]:
    """Parse TSC error log lines into a dict keyed by filepath."""
    with open(log_path, encoding="utf-8") as f:
        lines = f.readlines()

    errors_by_file: dict[str, list[dict]] = defaultdict(list)
    for line in lines:
        match = ERROR_PATTERN.search(line)
        if not match:
            continue

        filepath, l1, c1, l2, c2, error_code, message = match.groups()
        line_num = int(l1) if l1 else int(l2)
        col_num = int(c1) if c1 else int(c2)
        code = error_code.upper().replace("(", "").replace(")", "")

        errors_by_file[filepath].append(
            {
                "file": filepath,
                "line": line_num,
                "col": col_num,
                "msg": message,
                "code": code,
            }
        )
    return errors_by_file


def _collect_null_assertion_fix(err: dict, content_lines: list[str], fixes_by_line: dict, counters: dict) -> None:
    """Collect a `!` insertion position for TS18048 / TS2532 errors."""
    line_idx = err["line"] - 1
    if line_idx >= len(content_lines):
        return

    line_text = content_lines[line_idx]
    col_idx = err["col"] - 1
    if col_idx >= len(line_text):
        return

    end_idx = col_idx
    while end_idx < len(line_text) and (line_text[end_idx].isalnum() or line_text[end_idx] == "_"):
        end_idx += 1

    if end_idx > col_idx:
        fixes_by_line[line_idx].append(end_idx)
        if err["code"] == "TS18048":
            counters["ts18048"] += 1
        elif err["code"] == "TS2532":
            counters["ts2532"] += 1


def _find_brace_bounds(line_text: str, col_idx: int) -> tuple[int, int]:
    brace_depth = 0
    open_brace = -1
    for i in range(col_idx, -1, -1):
        if i >= len(line_text):
            continue
        if line_text[i] == "}":
            brace_depth += 1
        elif line_text[i] == "{":
            if brace_depth == 0:
                open_brace = i
                break
            brace_depth -= 1

    if open_brace == -1:
        return -1, -1

    brace_depth = 0
    close_brace = -1
    for i in range(open_brace, len(line_text)):
        if line_text[i] == "{":
            brace_depth += 1
        elif line_text[i] == "}":
            brace_depth -= 1
            if brace_depth == 0:
                close_brace = i
                break
    return open_brace, close_brace


def _collect_ts7031_fix(err: dict, content_lines: list[str], ts7031_fixes_by_line: dict, counters: dict) -> None:
    """Collect an `: any` insertion position for TS7031 implicitly-any destructuring."""
    line_idx = err["line"] - 1
    if line_idx >= len(content_lines):
        return

    line_text = content_lines[line_idx]
    col_idx = err["col"] - 1
    if col_idx >= len(line_text):
        return

    open_brace, close_brace = _find_brace_bounds(line_text, col_idx)
    if open_brace == -1 or close_brace == -1:
        return

    after_close = line_text[close_brace + 1 : close_brace + 6]
    if ": any" not in after_close and ":any" not in after_close:
        ts7031_fixes_by_line[line_idx].append(close_brace + 1)
        counters["ts7031"] += 1


def fix_file(filepath: str, errors: list[dict], counters: dict) -> None:
    """Apply fixes to a single file and save it if changed."""
    try:
        with open(filepath, encoding="utf-8") as f:
            content_lines = f.readlines()
    except FileNotFoundError:
        log.warning(f"File not found: {filepath}")
        return

    fixes_by_line = defaultdict(list)
    ts7031_fixes_by_line = defaultdict(list)

    for err in errors:
        code = err["code"]
        if code in ("TS18048", "TS2532"):
            _collect_null_assertion_fix(err, content_lines, fixes_by_line, counters)
        elif code == "TS7031":
            _collect_ts7031_fix(err, content_lines, ts7031_fixes_by_line, counters)

    changed = False

    # Apply null assertions
    for line_idx, positions in fixes_by_line.items():
        line = content_lines[line_idx]
        unique_positions = sorted(set(positions), reverse=True)
        for pos in unique_positions:
            if pos < len(line) and line[pos] != "!":
                line = line[:pos] + "!" + line[pos:]
            elif pos == len(line):
                line += "!"
        content_lines[line_idx] = line
        changed = True

    # Apply ts7031 implicit-any destructuring fixes
    for line_idx, positions in ts7031_fixes_by_line.items():
        line = content_lines[line_idx]
        unique_positions = sorted(set(positions), reverse=True)
        for pos in unique_positions:
            after_pos = line[pos : pos + 5]
            if ": any" not in after_pos and ":any" not in after_pos:
                line = line[:pos] + ": any" + line[pos:]
        content_lines[line_idx] = line
        changed = True

    if changed:
        with open(filepath, "w", encoding="utf-8") as f:
            f.writelines(content_lines)


def main() -> None:
    log_file = "raw_tsc_errors.log"
    if not os.path.exists(log_file):
        log.error(f"Log file {log_file} not found.")
        return

    errors_by_file = parse_errors(log_file)
    counters = {"ts18048": 0, "ts2532": 0, "ts7031": 0}

    for filepath, errors in errors_by_file.items():
        fix_file(filepath, errors, counters)

    log.info(f"Fixed {counters['ts18048']} TS18048 errors.")
    log.info(f"Fixed {counters['ts2532']} TS2532 errors.")
    log.info(f"Fixed {counters['ts7031']} TS7031 errors.")


if __name__ == "__main__":
    import os

    main()
