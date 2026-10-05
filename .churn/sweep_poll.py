import json
import subprocess
import time

def sweep():
    out = subprocess.run(["gh", "search", "prs", "--owner", "daggerstuff", "--state", "open",
                          "--json", "number,repository,title,updatedAt"],
                         capture_output=True, text=True)
    if out.returncode != 0:
        return f"search-error: {out.stderr.strip()[:100]}"
    try:
        d = json.loads(out.stdout)
    except Exception:
        return f"parse-error: {out.stdout[:100]}"
    if not d:
        return "ZERO OPEN"
    return " | ".join(f"{x['repository']['name']}#{x['number']}" for x in d)

def state(num):
    out = subprocess.run(["gh", "pr", "view", str(num), "--repo", "daggerstuff/pixelated",
                          "--json", "mergeStateStatus,mergeable,state,headRefOid,statusCheckRollup"],
                         capture_output=True, text=True)
    if out.returncode != 0:
        return f"#{num} err"
    d = json.loads(out.stdout)
    s = {}
    for c in d.get("statusCheckRollup") or []:
        s[c.get("name") or "?"] = c.get("conclusion")
    return (f"#{num} {d['state']} {d['mergeStateStatus']}/{d['mergeable']} "
            f"test={s.get('test') or '-'} sec={s.get('Security Regression Gate') or '-'} "
            f"head={d['headRefOid'][:9]}")

deadline = time.time() + 50 * 60
while time.time() < deadline:
    print(f"[{time.strftime('%H:%M:%S')}] OPEN: {sweep()}", flush=True)
    print(f"[{time.strftime('%H:%M:%S')}] {state(6108)}", flush=True)
    time.sleep(150)
print("RESULT: TIMEOUT")