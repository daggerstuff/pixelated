import json
import os
import subprocess
import sys

def read_env_key(path, k):
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line.startswith(k + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None

STATE = "/home/vivi/pixelated/.churn/sandbox_state.json"

def get_token():
    return subprocess.run(["gh", "auth", "token"], capture_output=True, text=True).stdout.strip()

def main():
    repo = sys.argv[1]
    branch = sys.argv[2]
    base = sys.argv[3]
    os.environ["E2B_API_KEY"] = read_env_key("/home/vivi/pixelated/.env", "E2B_API_KEY")
    token = get_token()
    from e2b import Sandbox
    sb = Sandbox.create(template="base", timeout=3600)
    with open(STATE, "w") as f:
        json.dump({"sandbox_id": sb.sandbox_id, "repo": repo, "branch": branch, "base": base}, f)
    url = f"https://x-access-token:{token}@github.com/{repo}.git"
    script = f"""#!/bin/bash
export GIT_TERMINAL_PROMPT=0
rm -rf /tmp/repo
git -c core.hooksPath=/dev/null clone --no-tags "{url}" /tmp/repo 2>&1 | tail -3
cd /tmp/repo
git config user.name "PR Churn Bot"
git config user.email "churn@daggerstuff.local"
git -c core.hooksPath=/dev/null fetch origin {base} --no-tags 2>&1 | tail -2
git -c core.hooksPath=/dev/null checkout "{branch}" 2>&1 | tail -3
echo "--- head ---"; git rev-parse HEAD
echo "--- log ---"; git log --oneline -3
echo CLONE_DONE=0
"""
    sb.files.write("/home/user/clone.sh", script)
    r = sb.commands.run("bash /home/user/clone.sh 2>&1; echo PAYLOAD_EXIT=$?")
    print("SANDBOX_ID:", sb.sandbox_id)
    print(r.stdout)
    if r.stderr:
        print("STDERR:", r.stderr[:1200])

if __name__ == "__main__":
    main()