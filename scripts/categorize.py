#!/usr/bin/env python3
import re
from collections import Counter

# Read file
with open("/tmp/tc_errors3.txt", "rb") as f:
    raw = f.read()

# Strip ANSI escape codes
ansi = re.compile(rb"\x1b\[[0-9;]*[mK]")
clean = ansi.sub(b"", raw).decode("utf-8", errors="replace")

# Find all error ts(CODE) patterns
codes = re.findall(r"error ts\((\d+)\)", clean)
print(f"Total error lines: {len(codes)}")
print()

# Count by error code
code_counts = Counter(codes)
print("=" * 80)
print("ERRORS BY ERROR CODE")
print("=" * 80)
for code, count in code_counts.most_common():
    print(f"  ts({code}): {count}")

print()

# Find all file paths with errors
file_errors = re.findall(r"^(src/[^:]+):\d+:\d+ - error ts(\d+):", clean, re.MULTILINE)
file_code_counts = Counter()
file_counts = Counter()
for fpath, _ in file_errors:
    file_counts[fpath] += 1

print("=" * 80)
print("ERRORS BY FILE (top 80)")
print("=" * 80)
for fpath, count in file_counts.most_common(80):
    print(f"  {count:5d}  {fpath}")

print()
print(f"Unique files: {len(file_counts)}")
print(f"Unique error codes: {len(code_counts)}")

print()
print("=" * 80)
print("STATS BY ERROR CODE GROUP")
print("=" * 80)

# Group by ts code ranges
groups = {
    "ts(2322/2345/2739/2740) - Type not assignable/missing props": {"2322", "2345", "2739", "2740", "2352"},
    "ts(2339) - Property does not exist": {"2339"},
    "ts(4111) - Index signature access": {"4111"},
    "ts(2724) - Module export not found": {"2724"},
    "ts(2304/2307) - Cannot find name/module": {"2304", "2307"},
    "ts(2558) - Type arg count mismatch": {"2558"},
    "ts(2362/2365) - Arithmetic on wrong types": {"2362", "2365"},
    "ts(7044) - Implicit any": {"7044"},
    "ts(18046/18047) - any type": {"18046", "18047"},
    "All other ts codes": set(),
}

all_codes = set(code_counts.keys())
for label, code_set in groups.items():
    if code_set:
        total = sum(code_counts.get(c, 0) for c in code_set)
        if total:
            print(f"  {total:5d}  {label}")
        all_codes -= code_set
if all_codes:
    total = sum(code_counts.get(c, 0) for c in all_codes)
    if total:
        print("  {:5d}  {} (ts{})".format(total, "All other ts codes", ", ".join(sorted(all_codes))))
