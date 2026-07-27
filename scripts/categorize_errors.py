#!/usr/bin/env python3
"""Categorize TypeScript errors from the typecheck output."""

import re
from collections import Counter

with open("/tmp/tc_errors_full.txt") as f:
    content = f.read()

# Match lines like: src/path:line:col - error ts(code): message
errors = re.findall(r"^(src/[^:]+:\d+:\d+) - error ts(\d+): (.*)", content, re.MULTILINE)

print(f"Total error lines found: {len(errors)}")
print()

file_counts = Counter()
code_counts = Counter()
file_details = {}

# TODO: handle empty error list edge case — should print "No errors found" instead of empty sections
for loc, code, _ in errors:
    fpath = loc.split(":")[0]
    file_counts[fpath] += 1
    code_counts[code] += 1
    if fpath not in file_details:
        file_details[fpath] = Counter()
    file_details[fpath][code] += 1

print("=" * 80)
print("ERRORS BY ERROR CODE")
print("=" * 80)
for code, count in code_counts.most_common():
    print(f"  ts({code}): {count} errors")

print()
print("=" * 80)
print("ERRORS BY FILE")
print("=" * 80)
for fpath, count in file_counts.most_common():
    code_strs = [f"ts({c}):{n}" for c, n in sorted(file_details[fpath].items(), key=lambda x: -x[1])]
    print(f"  {count:5d}  {fpath}")
    for cs in code_strs:
        print(f"         ({cs})")

print()
print(f"Total unique files: {len(file_counts)}")
print(f"Total unique error codes: {len(code_counts)}")
