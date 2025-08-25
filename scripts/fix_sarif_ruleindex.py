import json
import logging
import sys

# Usage: python fix_sarif_ruleindex.py <input_file> <output_file>


def main():
    if len(sys.argv) != 3:
        logging.error("Usage: python fix_sarif_ruleindex.py <input_file> <output_file>")
        sys.exit(1)
    input_file = sys.argv[1]
    output_file = sys.argv[2]

    with open(input_file, encoding="utf-8") as f:
        sarif = json.load(f)

    for run in sarif.get("runs", []):
        rules = run.get("tool", {}).get("driver", {}).get("rules", [])
        rule_id_to_index = {rule["id"]: idx for idx, rule in enumerate(rules)}
        for result in run.get("results", []):
            rule_id = result.get("ruleId")
            if rule_id in rule_id_to_index:
                result["ruleIndex"] = rule_id_to_index[rule_id]
            else:
                # Remove ruleIndex if ruleId not found (optional)
                result.pop("ruleIndex", None)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(sarif, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
