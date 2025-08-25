#!/usr/bin/env python3
"""
Validate that all result.ruleIndex values in a SARIF file match the index of their ruleId in the rules array.

Usage:
    python scripts/validate_sarif_ruleindex.py <sarif_file>
"""

import json
import sys


def validate_ruleindex(sarif_file):
    with open(sarif_file, encoding="utf-8") as f:
        sarif = json.load(f)
    all_passed = True
    for run in sarif.get("runs", []):
        rules = run.get("tool", {}).get("driver", {}).get("rules", [])
        rule_id_to_index = {rule["id"]: idx for idx, rule in enumerate(rules)}
        for result in run.get("results", []):
            rule_id = result.get("ruleId")
            rule_index = result.get("ruleIndex")
            expected_index = rule_id_to_index.get(rule_id)
            if expected_index is None or rule_index != expected_index:
                all_passed = False
    return all_passed


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(1)
    sarif_file = sys.argv[1]
    ok = validate_ruleindex(sarif_file)
    sys.exit(0 if ok else 2)
