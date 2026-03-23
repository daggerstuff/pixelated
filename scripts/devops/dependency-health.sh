#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "== Pixelated Dependency Health Check =="
echo "Repository: ${REPO_ROOT}"
echo

if command -v uv >/dev/null 2>&1; then
  if [[ "${UV_PRUNE_CACHE:-0}" == "1" ]]; then
    echo "[uv] Pruning uv cache (CI mode)..."
    uv cache prune --ci --force
    echo
  fi
else
  echo "[warn] uv not available; skipping cache prune and uv checks."
  echo
fi

if [ -d "${REPO_ROOT}/.venv" ]; then
  echo "[size] root venv: $(du -sh "${REPO_ROOT}/.venv" | awk '{print $1}')"
fi

if [ -d "${REPO_ROOT}/ai/.venv" ]; then
  echo "[size] ai venv:   $(du -sh "${REPO_ROOT}/ai/.venv" | awk '{print $1}')"
fi

echo

python3 - "${REPO_ROOT}" <<'PY'
import re
import sys
import tomllib
from pathlib import Path
import ast


root = Path(sys.argv[1])

def normalize_dep(token: str) -> str:
    cleaned = token.split(";", 1)[0].strip()
    cleaned = cleaned.split("[", 1)[0].strip()
    if not cleaned:
        return ""
    return re.split(r"[<=>!~\s]", cleaned, maxsplit=1)[0].lower().replace("_", "-")


def manifest_deps(path: Path) -> set[str]:
    data = tomllib.loads(path.read_text())
    project = data.get("project", {})
    deps = list(project.get("dependencies", []) or [])
    for items in (project.get("optional-dependencies", {}) or {}).values():
        deps.extend(items or [])
    for items in (data.get("dependency-groups", {}) or {}).values():
        deps.extend(items or [])

    out = set()
    for item in deps:
        if isinstance(item, str):
            name = normalize_dep(item)
            if name:
                out.add(name)
    return out


def gather_pyproject_files() -> list[Path]:
    skip = {".venv", "ai/.venv", "node_modules", ".git"}
    candidates = []
    for path in root.rglob("pyproject.toml"):
        p = str(path)
        if any(s in p.split("/") for s in skip):
            continue
        candidates.append(path)
    return sorted(candidates)


def scan_imports(base: Path) -> set[str]:
    names: set[str] = set()
    for py_file in base.rglob("*.py"):
        p = str(py_file)
        if any(part in p.split("/") for part in {".venv", "ai/.venv", "node_modules", ".git"}):
            continue
        try:
            text = py_file.read_text()
        except Exception:
            continue
        try:
            tree = ast.parse(text)
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    names.add(alias.name.split(".")[0].lower())
            elif isinstance(node, ast.ImportFrom) and node.module:
                names.add(node.module.split(".")[0].lower())
    return {n for n in names if n}


def rough_unused(deps: set[str], imports: set[str]) -> list[str]:
    alias = {
        "scikit-learn": "sklearn",
        "beautifulsoup4": "bs4",
        "python-dotenv": "dotenv",
        "pyyaml": "yaml",
        "pydantic-ai": "pydantic_ai",
    }
    normalized_imports = {i.lower().replace("_", "-") for i in imports}
    result = []
    for dep in sorted(deps):
        token = dep.lower()
        if token in normalized_imports:
            continue
        if alias.get(token, "").lower().replace("_", "-") in normalized_imports:
            continue
        result.append(token)
    return result


def python_version_key(path: Path) -> tuple[int, int]:
    match = re.search(r"python(\d+)\.(\d+)", str(path))
    if match:
        return int(match.group(1)), int(match.group(2))
    return (0, 0)


manifest_files = gather_pyproject_files()
manifests = {str(p): manifest_deps(p) for p in manifest_files}

print("== Manifest inventory ==")
for path, deps in manifests.items():
    print(f"{Path(path).name:>28}  {len(deps):>3} dependencies")
print()

print("== Cross-manifest overlap (top shared packages) ==")
all_map: dict[str, list[str]] = {}
for path, deps in manifests.items():
    for dep in deps:
        all_map.setdefault(dep, []).append(path)
for dep, paths in sorted(all_map.items(), key=lambda item: (-len(item[1]), item[0])):
    if len(paths) <= 1:
        continue
    print(f"{dep}: {len(paths)} manifests")
    for p in sorted(paths)[:3]:
        print(f"  - {p}")
    if len(paths) > 3:
        print(f"  ... and {len(paths)-3} more")
    print()

print("== Likely unused dependencies by static import check ==")
base_imports = scan_imports(root)
for path in ["pyproject.toml", "ai/pyproject.toml"]:
    full = root / path
    if not full.exists():
        continue
    deps = manifests[str(full)]
    unused = rough_unused(deps, base_imports)
    if unused:
        print(f"{path}: {len(unused)} candidates")
        for dep in sorted(unused)[:40]:
            print(f"  - {dep}")
        if len(unused) > 40:
            print(f"  ... {len(unused)-40} more candidates (requires manual validation)")
    else:
        print(f"{path}: no obvious candidates")
    print()

print("== venv crossover check ==")
root_venv_candidates = sorted(
    (root / ".venv" / "lib").glob("python*/site-packages"),
    key=python_version_key,
)
ai_venv_candidates = sorted(
    (root / "ai" / ".venv" / "lib").glob("python*/site-packages"),
    key=python_version_key,
)
if root_venv_candidates and ai_venv_candidates:
    root_venv = root_venv_candidates[-1]
    ai_venv = ai_venv_candidates[-1]
    shared = {p.name for p in root_venv.iterdir() if p.is_dir()} & {p.name for p in ai_venv.iterdir() if p.is_dir()}
    print(f"Shared package directories: {len(shared)}")
    names = sorted(shared)
    for name in names[:25]:
        print(f"  - {name}")
    if len(names) > 25:
        print(f"  ... and {len(names)-25} more")
else:
    print("Both root and ai venvs must exist to run crossover directory check.")
PY

echo
echo "Tip: set UV_PRUNE_CACHE=1 before running to aggressively clean uv cache in launchers."
