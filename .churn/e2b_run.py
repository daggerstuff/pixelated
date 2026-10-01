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
    cmd = sys.argv[1]
    with open(STATE) as f:
        state = json.load(f)
    os.environ["E2B_API_KEY"] = read_env_key("/home/vivi/pixelated/.env", "E2B_API_KEY")
    from e2b import Sandbox
    sb = Sandbox.connect(state["sandbox_id"])
    # write command to a payload file (avoid heredoc/quoting issues; child shell survives non-zero exit)
    sb.files.write("/home/user/run.sh", f"#!/bin/bash\ncd /tmp/repo || exit 9\n{cmd}\necho PAYLOAD_EXIT=$?\n")
    r = sb.commands.run("bash /home/user/run.sh 2>&1; echo OUTER_EXIT=$?")
    print(r.stdout)
    if r.stderr:
        print("STDERR:", r.stderr[:2000])

if __name__ == "__main__":
    main()