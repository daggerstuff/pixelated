import json
import subprocess
import time

def view(repo, num):
    out = subprocess.run(["gh", "pr", "view", str(num), "--repo", repo,
                          "--json", "mergeStateStatus,mergeable,statusCheckRollup,headRefOid,state"],
                         capture_output=True, text=True)
    if out.returncode != 0:
        return None
    return json.loads(out.stdout)

def check_state(d):
    rollup = d.get("statusCheckRollup") or []
    states = {}
    for c in rollup:
        states[c.get("name") or c.get("context") or "?"] = c.get("conclusion")
    test = states.get("test")
    sec = states.get("Security Regression Gate")
    drift = states.get("Dependency health audits")
    return test, sec, drift

deadline = time.time() + 55 * 60
while time.time() < deadline:
    lines = []
    for repo, num in [("daggerstuff/pixelated", 6104), ("daggerstuff/pixelated", 6105)]:
        d = view(repo, num)
        if d is None:
            lines.append(f"#{num} gh-error")
            continue
        test, sec, drift = check_state(d)
        ms = d["mergeStateStatus"]
        h = d["headRefOid"][:9]
        state = d["state"]
        lines.append(f"#{num} {state} {ms}/{d['mergeable']} head={h} test={test or '-'} sec={sec or '-'} drift={drift or '-'}")
    print(f"[{time.strftime('%H:%M:%S')}] " + " | ".join(lines), flush=True)
    time.sleep(120)
print("RESULT: TIMEOUT")