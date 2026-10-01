import json
import subprocess
import sys
import time

repo = sys.argv[1]
num = int(sys.argv[2])
required = sys.argv[3:]

deadline = time.time() + 50 * 60
while time.time() < deadline:
    out = subprocess.run(
        ["gh", "pr", "view", str(num), "--repo", repo,
         "--json", "mergeStateStatus,mergeable,statusCheckRollup,headRefOid"],
        capture_output=True, text=True)
    if out.returncode != 0:
        print(f"[{time.strftime('%H:%M:%S')}] gh error: {out.stderr.strip()[:120]}")
        time.sleep(60)
        continue
    d = json.loads(out.stdout)
    rollup = d.get("statusCheckRollup") or []
    states = {}
    for c in rollup:
        name = c.get("name") or c.get("context") or "?"
        states[name] = (c.get("conclusion"), c.get("status"))
    req = {r: states.get(r, ("MISSING", "-")) for r in required}
    greens = all(v[0] in ("SUCCESS", "SKIPPED") for v in req.values())
    any_fail = any(v[0] == "FAILURE" for v in req.values())
    line = "  ".join(f"{r}={v[0] or v[1]}" for r, v in req.items())
    print(f"[{time.strftime('%H:%M:%S')}] #{num} {d['mergeStateStatus']}/{d['mergeable']} {line}")
    if greens:
        print(f"RESULT: GREEN  head={d['headRefOid']}")
        sys.exit(0)
    if any_fail:
        print(f"RESULT: FAILED  head={d['headRefOid']}")
        sys.exit(1)
    time.sleep(90)
print("RESULT: TIMEOUT")
sys.exit(2)