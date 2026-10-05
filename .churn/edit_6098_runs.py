p = "/tmp/repo/scripts/training/recreate_serverless_runs.py"
s = open(p).read()

anchor = '''class _HistoryFrame(Protocol):
    def to_json(self, path_or_buf: str | Path, orient: str) -> str | None: ...

    def __len__(self) -> int: ...
'''
addition = anchor + '''


class _WandbApi(Protocol):
    def run(self, path: str) -> Any: ...
'''
assert anchor in s, "anchor not found"
s = s.replace(anchor, addition, 1)

old = '''    api = wandb.Api()
    run = api.run(f"{PROJECT}/{run_name}")'''
new = '''    api = cast(_WandbApi, wandb.Api())
    run = api.run(f"{PROJECT}/{run_name}")'''
assert old in s, "run-call site not found"
s = s.replace(old, new, 1)

open(p, "w").write(s)
print("EDIT OK - _WandbApi added and cast applied")