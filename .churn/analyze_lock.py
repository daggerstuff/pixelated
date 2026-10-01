import subprocess

ref = "5fd51047234166a0f850b72da7488ebb73a673ca"
out = subprocess.run(
    ["gh", "api", "-H", "Accept: application/vnd.github.raw",
     f"repos/daggerstuff/pixelated/contents/pnpm-lock.yaml?ref={ref}"],
    capture_output=True, text=True)
lines = out.stdout.split("\n")

# find snapshots (indent 2: "  name@version:") and their dependency entries (indent 6: "      dep: version")
targets = {"obug", "@astrojs/compiler-rs", "@astrojs/compiler-binding", "vscode-jsonrpc", "astro"}
current = None
deps = {}   # snapshot -> {dep -> version}

for ln in lines:
    if ln.startswith("  ") and not ln.startswith("    ") and ln.rstrip().endswith(":") and "@" in ln and not ln.startswith("  /"):
        # snapshot key like "  obug@2.2.1:" or "  '@astrojs/compiler-rs@0.4.1':"
        key = ln.strip().rstrip(":").strip("'\"")
        current = key
        deps.setdefault(key, {})
    elif ln.startswith("      ") and current and ":" in ln and not ln.startswith("        "):
        # dependency entry "      obug: 2.2.1"
        dep, _, ver = ln.strip().partition(": ")
        if dep in targets or dep.strip("'\"") in targets:
            deps[current][dep.strip("'\"")] = ver.strip()

print("=== dependents of target packages ===")
for t in targets:
    print(f"\n--- {t} ---")
    for snap, d in deps.items():
        if t in d:
            print(f"  {snap}  ->  {t}: {d[t]}")

# Also list which versions of each target exist as snapshots
print("\n=== target snapshots ===")
for t in targets:
    versions = sorted({s.split('@')[-1] for s in deps if s.split('@')[0].strip("'\"") == t})
    print(f"  {t}: {versions}")