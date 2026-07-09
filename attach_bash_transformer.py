import json
import sqlite3

db = sqlite3.connect("/home/vivi/.claude-code-router/config.sqlite")
c = db.cursor()
row = c.execute('SELECT value_json FROM app_config WHERE key="default"').fetchone()
config = json.loads(row[0])

for p in config.get("Providers", []):
    if p["name"] == "nvidia":
        p["transformer"] = {
            "default": {
                "use": ["clean-property-names", "tooluse", "enhancetool", "bash-transformer", "model-normalizer"]
            }
        }

new_json = json.dumps(config)
c.execute('UPDATE app_config SET value_json = ? WHERE key="default"', (new_json,))
db.commit()
print("Attached transformers correctly to nvidia provider.")
