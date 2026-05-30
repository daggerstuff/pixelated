import json
import logging
import os
import sys

sys.path.insert(0, os.getcwd())

from scripts.task_sync.provider_bridge import export_linear_issues

def main():
    logging.basicConfig(level=logging.INFO)
    print("Exporting issues from Linear...")
    issues = export_linear_issues()
    print(f"Loaded {len(issues)} issues.")
    
    # Save to file
    out_path = "exports/current_linear_issues.json"
    with open(out_path, "w") as f:
        json.dump(issues, f, indent=2)
    print(f"Saved to {out_path}")

if __name__ == "__main__":
    main()
