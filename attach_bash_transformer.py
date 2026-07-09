import json
import os
import sqlite3
import sys

DB_PATH = os.path.expanduser("~/.claude-code-router/config.sqlite")


def main(dry_run=False):
    if not os.path.isfile(DB_PATH):
        print(f"Error: database not found at {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    db = sqlite3.connect(DB_PATH)
    c = db.cursor()

    row = c.execute('SELECT value_json FROM app_config WHERE key="default"').fetchone()
    if row is None:
        print(f'Error: no row with key="default" found in {DB_PATH}', file=sys.stderr)
        sys.exit(1)

    original_json = row[0]
    config = json.loads(original_json)

    for p in config.get("Providers", []):
        if p["name"] == "nvidia":
            p["transformer"] = {
                "default": {
                    "use": ["clean-property-names", "tooluse", "enhancetool", "bash-transformer", "model-normalizer"]
                }
            }

    new_json = json.dumps(config)

    if dry_run:
        print("[DRY RUN] Would update nvidia provider transformers:")
        print(new_json[:500] + "..." if len(new_json) > 500 else new_json)
        return

    try:
        c.execute('UPDATE app_config SET value_json = ? WHERE key="default"', (new_json,))
        db.commit()
        print("Attached transformers correctly to nvidia provider.")
    except Exception as e:
        db.rollback()
        print(f"Error: update failed, rolled back. {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    main(dry_run=dry)
