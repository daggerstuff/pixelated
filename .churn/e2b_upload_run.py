import json
import os
import sys

def read_env_key(path, k):
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line.startswith(k + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None

STATE = "/home/vivi/pixelated/.churn/sandbox_state.json"

def main():
    local = sys.argv[1]          # local script path
    remote = sys.argv[2]         # e.g. /home/user/edit.py
    run_after = len(sys.argv) > 3 and sys.argv[3] == "run"
    with open(STATE) as f:
        state = json.load(f)
    os.environ["E2B_API_KEY"] = read_env_key("/home/vivi/pixelated/.env", "E2B_API_KEY")
    from e2b import Sandbox
    sb = Sandbox.connect(state["sandbox_id"])
    content = open(local).read()
    sb.files.write(remote, content)
    if run_after:
        r = sb.commands.run(f"cd /tmp/repo && python3 {remote} 2>&1; echo PAYLOAD_EXIT=$?")
        print(r.stdout)
        if r.stderr:
            print("STDERR:", r.stderr[:2000])
    else:
        print("uploaded", remote, len(content), "bytes")

if __name__ == "__main__":
    main()