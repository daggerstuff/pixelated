import re
import urllib.request
import json
import glob

files = glob.glob('.github/workflows/*.yml')
actions = set()

for f in files:
    with open(f, 'r') as file:
        content = file.read()
        matches = re.findall(r'uses:\s*([\w\-]+/[\w\-]+)@([^\s]*)', content)
        for repo, tag in matches:
            actions.add(repo)

print("Checking versions for:")
for repo in sorted(actions):
    try:
        url = f"https://api.github.com/repos/{repo}/releases/latest"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            latest_tag = data.get('tag_name', 'UNKNOWN')
            print(f"{repo}: Latest Release = {latest_tag}")
    except Exception as e:
        print(f"{repo}: Failed to fetch ({e})")
