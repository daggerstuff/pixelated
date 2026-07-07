#!/usr/bin/env bash
# archive-planning-docs.sh
# Finds structural/planning markdown files in the repo, moves them to
# ~/.agent/internal/ARCHIVED/, and outputs an old→new path mapping (TSV).
#
# Usage: ./scripts/archive-planning-docs.sh [REPO_ROOT]

set -euo pipefail

REPO_ROOT="${1:-$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel 2>/dev/null || pwd)}"
REPO_ROOT="$(realpath "${REPO_ROOT}")"
ARCHIVE_DIR="${HOME}/.agent/internal/ARCHIVED"
MAPPING_FILE="${ARCHIVE_DIR}/mapping.tsv"

NAME_PATTERN='roadmap|spec|arch|todo|plan|migrat|proposal|backlog|milestone|design|adr|rfc|deprecat|phase|sprint|changelog|implement|notes|scratchpad|brainstorm|research|brief|outline|strategy|review|audit|initiative|objective|discovery|exploration|tracking|status'
CONTENT_KEYWORDS='roadmap\|architecture\|migration plan\|todo\|backlog\|proposal\|milestone\|technical spec\|implementation plan\|sprint\|phase \(1\|2\|3\|planning\|objective\|initiative'

mkdir -p "${ARCHIVE_DIR}"
printf 'old_path\tnew_path\n' > "${MAPPING_FILE}"

moved=0
skipped=0

# Use a simple find with explicit -path prune expressions (no eval, no array expansion tricks).
# Each excluded directory gets its own -path '*/name' -prune -o block.
while IFS= read -r -d '' f; do
  base="$(basename "${f}" .md)"

  matched=0
  # 1. Filename heuristic
  if echo "${base}" | grep -qiE "${NAME_PATTERN}"; then
    matched=1
  fi
  # 2. Content heuristic (only if filename didn't match)
  if [[ ${matched} -eq 0 ]] && grep -qiE "${CONTENT_KEYWORDS}" "${f}" 2>/dev/null; then
    matched=1
  fi

  [[ ${matched} -eq 0 ]] && continue

  rel="${f#"${REPO_ROOT}/"}"
  flat="${rel//\//__}"
  dest="${ARCHIVE_DIR}/${flat}"

  if [[ -f "${dest}" ]]; then
    echo "SKIP (dest exists): ${f}" >&2
    (( skipped++ )) || true
    continue
  fi

  mv "${f}" "${dest}"
  printf '%s\t%s\n' "${f}" "${dest}"
  printf '%s\t%s\n' "${f}" "${dest}" >> "${MAPPING_FILE}"
  (( moved++ )) || true

done < <(
  find "${REPO_ROOT}" \
    -path "${REPO_ROOT}/.git"                    -prune -o \
    -path "${REPO_ROOT}/node_modules"            -prune -o \
    -path "${REPO_ROOT}/.venv"                   -prune -o \
    -path "${REPO_ROOT}/.pytest_cache"           -prune -o \
    -path "${REPO_ROOT}/.vercel"                 -prune -o \
    -path "${REPO_ROOT}/foresight/.venv"     -prune -o \
    -path "${ARCHIVE_DIR}"                       -prune -o \
    -path "${REPO_ROOT}/.agents/skills"          -prune -o \
    -path "*/node_modules"                       -prune -o \
    -path "*/.venv"                              -prune -o \
    -name "*.md" -print0
)

echo "──────────────────────────────────────────" >&2
echo "Moved:   ${moved} file(s)" >&2
echo "Skipped: ${skipped} file(s)" >&2
echo "Mapping: ${MAPPING_FILE}" >&2
