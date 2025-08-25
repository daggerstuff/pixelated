#!/usr/bin/env python3
"""
Validate that all result.ruleIndex values in a SARIF file match the index of their ruleId in the rules array.

Usage:
    python scripts/validate_sarif_ruleindex.py <sarif_file>
"""
import sys
import json

def validate_ruleindex(sarif_file):
    with open(sarif_file, "r", encoding="utf-8") as f:
        sarif = json.load(f)
    all_passed = True
    for run in sarif.get("runs", []):
        rules = run.get("tool", {}).get("driver", {}).get("rules", [])
        rule_id_to_index = {rule["id"]: idx for idx, rule in enumerate(rules)}
        for i, result in enumerate(run.get("results", [])):
            rule_id = result.get("ruleId")
            rule_index = result.get("ruleIndex")
            expected_index = rule_id_to_index.get(rule_id)
            if expected_index is None:
                print(f"[FAIL] Result {i}: ruleId '{rule_id}' not found in rules array.")
                all_passed = False
            elif rule_index != expected_index:
                print(f"[FAIL] Result {i}: ruleId '{rule_id}' has ruleIndex {rule_index}, expected {expected_index}.")
                all_passed = False
    if all_passed:
        print("✅ All result.ruleIndex values match their ruleId in the rules array.")
    else:
        print("❌ Some ruleIndex values do not match. See above for details.")
    return all_passed

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/validate_sarif_ruleindex.py <sarif_file>")
        sys.exit(1)
    sarif_file = sys.argv[1]
    ok = validate_ruleindex(sarif_file)
    sys.exit(0 if ok else 2)
