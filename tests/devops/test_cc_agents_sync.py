"""The Command Code bridge must not lose a concurrent writer's servers.

`cc-agents-sync.sh sync` reads the target, merges, and replaces it. Two runs
that read the same snapshot each write a complete document, so the later write
discards the earlier one's additions. The bridge holds an exclusive lock across
that sequence, and these tests prove a second writer waits for the first
instead of overwriting it.
"""

import fcntl
import json
import os
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "devops" / "cc-agents-sync.sh"

# A slow writer: takes the same lock the bridge takes, snapshots the target,
# announces itself, spends a second "merging" (the window in which the old
# bridge read the same stale snapshot), then writes its own server into it.
SLOW_WRITER = """
import fcntl, json, sys, time

target, ready = sys.argv[1], sys.argv[2]
handle = open(target + ".lock", "a+", encoding="utf-8")
fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
with open(target, encoding="utf-8") as fh:
    document = json.load(fh)
open(ready, "w", encoding="utf-8").close()
time.sleep(1.0)
document["mcpServers"]["held"] = {"command": "/bin/held"}
with open(target, "w", encoding="utf-8") as fh:
    json.dump(document, fh)
"""


def write_servers(path, servers):
    path.write_text(json.dumps({"mcpServers": servers}, indent=2), encoding="utf-8")


def read_servers(path):
    return json.loads(path.read_text(encoding="utf-8"))["mcpServers"]


def bridge_env(source, target):
    return dict(
        os.environ,
        CC_AGENTS_MCP_SOURCE=str(source),
        CC_MCP_TARGET=str(target),
    )


def test_sync_waits_for_an_in_flight_writer(tmp_path):
    source = tmp_path / "agents-mcp.json"
    target = tmp_path / "cc-mcp.json"
    ready = tmp_path / "writer-ready"
    write_servers(source, {"incoming": {"command": "/bin/incoming"}})
    write_servers(target, {"base": {"command": "/bin/base"}})

    writer = subprocess.Popen(
        [sys.executable, "-c", SLOW_WRITER, str(target), str(ready)],
    )
    try:
        deadline = time.time() + 30
        while not ready.exists():
            assert time.time() < deadline, "slow writer never took the lock"
            assert writer.poll() is None, "slow writer died before taking the lock"
            time.sleep(0.01)

        synced = subprocess.run(
            [str(SCRIPT), "sync"],
            env=bridge_env(source, target),
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    finally:
        writer.wait(timeout=60)

    assert synced.returncode == 0, synced.stderr
    assert set(read_servers(target)) == {"base", "incoming", "held"}


def test_status_does_not_take_the_write_lock(tmp_path):
    source = tmp_path / "agents-mcp.json"
    target = tmp_path / "cc-mcp.json"
    write_servers(source, {"incoming": {"command": "/bin/incoming"}})
    write_servers(target, {"base": {"command": "/bin/base"}})

    with open(str(target) + ".lock", "a+", encoding="utf-8") as holder:
        fcntl.flock(holder.fileno(), fcntl.LOCK_EX)
        reported = subprocess.run(
            [str(SCRIPT), "status"],
            env=bridge_env(source, target),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

    assert reported.returncode == 0, reported.stderr
    assert "incoming" in reported.stdout
