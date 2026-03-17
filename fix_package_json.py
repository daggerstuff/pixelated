import json

with open("package.json", "r", encoding="utf-8") as f:
    data = json.load(f)

if "packageManager" in data:
    data["packageManager"] = "pnpm@10.30.1"

with open("package.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write('\n')
print("Modification complete.")
