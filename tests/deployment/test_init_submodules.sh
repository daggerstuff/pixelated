#!/usr/bin/env bash

set -euo pipefail

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TARGET_SCRIPT="${PROJECT_ROOT}/scripts/devops/init-submodules.sh"
TEST_DIR="$(mktemp -d /tmp/init-submodules-test-XXXXXX)"

print_header() { echo -e "${BLUE}[TEST]${NC} $1"; }
print_pass() { echo -e "${GREEN}[PASS]${NC} $1"; TESTS_PASSED=$((TESTS_PASSED + 1)); }
print_fail() { echo -e "${RED}[FAIL]${NC} $1"; TESTS_FAILED=$((TESTS_FAILED + 1)); }

cleanup() {
  rm -rf "${TEST_DIR}"
}
trap cleanup EXIT

setup_fake_git() {
  mkdir -p "${TEST_DIR}/bin" "${TEST_DIR}/repo"
  cat > "${TEST_DIR}/repo/.gitmodules" <<'EOF'
[submodule "ai"]
	path = ai
	url = https://github.com/daggerstuff/ai.git

[submodule "docs"]
	path = docs
	url = https://github.com/daggerstuff/docs.git
EOF

  cat > "${TEST_DIR}/bin/git" <<EOF
#!/usr/bin/env bash
set -euo pipefail

log_file="${TEST_DIR}/git.log"
printf '%s\n' "\$*" >> "\${log_file}"

args=("\$@")
idx=0
while [[ \$idx -lt \$# && "\${args[\$idx]}" == "-c" ]]; do
  idx=\$((idx + 2))
done
cmd="\${args[\$idx]:-}"

if [[ "\$#" -ge \$((idx + 2)) && "\$cmd" == "rev-parse" && "\${args[\$((idx + 1))]}" == "--show-toplevel" ]]; then
  printf '%s\n' "${TEST_DIR}/repo"
  exit 0
fi

if [[ "\$#" -ge \$((idx + 4)) && "\$cmd" == "config" && "\${args[\$((idx + 1))]}" == "-f" && "\${args[\$((idx + 2))]}" == ".gitmodules" && "\${args[\$((idx + 3))]}" == "--get" ]]; then
  case "\${args[\$((idx + 4))]}" in
    submodule.ai.path) printf '%s\n' 'ai' ;;
    submodule.docs.path) printf '%s\n' 'docs' ;;
    submodule.ai.url) printf '%s\n' 'https://github.com/daggerstuff/ai.git' ;;
    submodule.docs.url) printf '%s\n' 'https://github.com/daggerstuff/docs.git' ;;
    *) exit 1 ;;
  esac
  exit 0
fi

if [[ "\$cmd" == "submodule" ]]; then
  if [[ "\${args[\$((idx + 1))]:-}" == "update" && "\$*" == *"--depth 1"* && "${MOCK_GIT_FAIL_SHALLOW_UPDATE:-0}" == "1" ]]; then
    exit 1
  fi
  exit 0
fi

if [[ "\$cmd" == "ls-remote" ]]; then
  remote=""
  for ((i = idx + 1; i < \$#; i++)); do
    arg="\${args[\$i]}"
    if [[ "\$arg" == http* || "\$arg" == git@* ]]; then
      remote="\$arg"
      break
    fi
  done
  if [[ "\${MOCK_GIT_FAIL_REMOTE_PATTERN:-}" != "" && "\$remote" == *"\${MOCK_GIT_FAIL_REMOTE_PATTERN}"* ]]; then
    exit 1
  fi
  printf '%s\n' 'deadbeef	HEAD'
  exit 0
fi

exit 0
EOF
  chmod +x "${TEST_DIR}/bin/git"
}

assert_contains() {
  local needle="$1"
  local file="$2"

  if grep -Fq -- "${needle}" "${file}"; then
    print_pass "Found expected fragment: ${needle}"
  else
    print_fail "Missing expected fragment: ${needle}"
  fi
}

test_azure_submodule_update_uses_per_command_headers() {
  print_header "Azure submodule update prefers Azure mirrors"
  TESTS_RUN=$((TESTS_RUN + 1))
  setup_fake_git

  PATH="${TEST_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${TEST_DIR}/repo" \
  TF_BUILD="True" \
  SYSTEM_ACCESSTOKEN="test-token" \
  bash "${TARGET_SCRIPT}"

  assert_contains "-c http.https://dev.azure.com/.extraHeader=AUTHORIZATION: bearer test-token" "${TEST_DIR}/git.log"
  assert_contains "submodule update --recursive --force --depth 1" "${TEST_DIR}/git.log"
  assert_contains "config submodule.ai.url https://dev.azure.com/handtransfer/pixelated/_git/ai" "${TEST_DIR}/git.log"
}

test_azure_falls_back_to_github_when_mirror_is_unavailable() {
  print_header "Azure submodule update falls back to GitHub when Azure mirror is unavailable"
  TESTS_RUN=$((TESTS_RUN + 1))
  rm -rf "${TEST_DIR}"
  TEST_DIR="$(mktemp -d /tmp/init-submodules-test-XXXXXX)"
  setup_fake_git

  PATH="${TEST_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${TEST_DIR}/repo" \
  TF_BUILD="True" \
  SYSTEM_ACCESSTOKEN="test-token" \
  GITHUB_PAT="github-token" \
  MOCK_GIT_FAIL_REMOTE_PATTERN="dev.azure.com/handtransfer/pixelated/_git/" \
  bash "${TARGET_SCRIPT}"

  assert_contains "config submodule.ai.url https://github.com/daggerstuff/ai.git" "${TEST_DIR}/git.log"
  assert_contains "-c http.https://github.com/.extraHeader=AUTHORIZATION: basic" "${TEST_DIR}/git.log"
}

test_submodule_update_retries_without_depth_when_shallow_fetch_fails() {
  print_header "Submodule update retries without depth when shallow fetch fails"
  TESTS_RUN=$((TESTS_RUN + 1))
  rm -rf "${TEST_DIR}"
  TEST_DIR="$(mktemp -d /tmp/init-submodules-test-XXXXXX)"
  setup_fake_git

  PATH="${TEST_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${TEST_DIR}/repo" \
  MOCK_GIT_FAIL_SHALLOW_UPDATE="1" \
  bash "${TARGET_SCRIPT}"

  assert_contains "submodule update --recursive --force --depth 1" "${TEST_DIR}/git.log"
  assert_contains "submodule update --recursive --force" "${TEST_DIR}/git.log"
}

test_non_azure_submodule_update_has_no_extraheader() {
  print_header "Non-Azure submodule update does not inject Azure auth"
  TESTS_RUN=$((TESTS_RUN + 1))
  rm -rf "${TEST_DIR}"
  TEST_DIR="$(mktemp -d /tmp/init-submodules-test-XXXXXX)"
  setup_fake_git

  PATH="${TEST_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${TEST_DIR}/repo" \
  bash "${TARGET_SCRIPT}"

  if grep -Fq -- "http.https://dev.azure.com/.extraheader" "${TEST_DIR}/git.log"; then
    print_fail "Unexpected Azure auth header in non-Azure run"
  else
    print_pass "No Azure auth header added outside Azure"
  fi
}

main() {
  test_azure_submodule_update_uses_per_command_headers
  test_azure_falls_back_to_github_when_mirror_is_unavailable
  test_submodule_update_retries_without_depth_when_shallow_fetch_fails
  test_non_azure_submodule_update_has_no_extraheader

  echo "Tests run: ${TESTS_RUN}"
  echo "Tests passed: ${TESTS_PASSED}"
  echo "Tests failed: ${TESTS_FAILED}"

  if [[ "${TESTS_FAILED}" -ne 0 ]]; then
    exit 1
  fi
}

main "$@"
