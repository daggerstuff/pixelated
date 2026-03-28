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
TARGET_SCRIPT="${PROJECT_ROOT}/scripts/devops/check-sonar-quality-gate.sh"
TEST_DIR="$(mktemp -d /tmp/sonar-quality-gate-test-XXXXXX)"

print_header() { echo -e "${BLUE}[TEST]${NC} $1"; }
print_pass() { echo -e "${GREEN}[PASS]${NC} $1"; TESTS_PASSED=$((TESTS_PASSED + 1)); }
print_fail() { echo -e "${RED}[FAIL]${NC} $1"; TESTS_FAILED=$((TESTS_FAILED + 1)); }

cleanup() {
  rm -rf "${TEST_DIR}"
}
trap cleanup EXIT

reset_test_dir() {
  rm -rf "${TEST_DIR}"
  TEST_DIR="$(mktemp -d /tmp/sonar-quality-gate-test-XXXXXX)"
  mkdir -p "${TEST_DIR}/bin" "${TEST_DIR}/workspace/.scannerwork"
}

setup_report_task() {
  cat > "${TEST_DIR}/workspace/.scannerwork/report-task.txt" <<'EOF'
projectKey=slimshadyme_pixelated
serverUrl=https://sonarcloud.io
dashboardUrl=https://sonarcloud.io/dashboard?id=slimshadyme_pixelated
ceTaskId=task-123
ceTaskUrl=https://sonarcloud.io/api/ce/task?id=task-123
EOF
}

setup_fake_curl_success() {
  cat > "${TEST_DIR}/bin/curl" <<EOF
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "\$*" >> "${TEST_DIR}/curl.log"

case "\$*" in
  *"/api/ce/task?id=task-123"*)
    printf '%s\n' '{"task":{"id":"task-123","status":"SUCCESS","analysisId":"analysis-123"}}'
    ;;
  *"/api/qualitygates/project_status?analysisId=analysis-123"*)
    printf '%s\n' '{"projectStatus":{"status":"OK"}}'
    ;;
  *)
    printf 'unexpected curl invocation: %s\n' "\$*" >&2
    exit 1
    ;;
esac
EOF
  chmod +x "${TEST_DIR}/bin/curl"
}

setup_fake_curl_failure() {
  cat > "${TEST_DIR}/bin/curl" <<EOF
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "\$*" >> "${TEST_DIR}/curl.log"

case "\$*" in
  *"/api/ce/task?id=task-123"*)
    printf '%s\n' '{"task":{"id":"task-123","status":"SUCCESS","analysisId":"analysis-123"}}'
    ;;
  *"/api/qualitygates/project_status?analysisId=analysis-123"*)
    printf '%s\n' '{"projectStatus":{"status":"ERROR","conditions":[{"metricKey":"reliability_rating","status":"ERROR"}]}}'
    ;;
  *)
    printf 'unexpected curl invocation: %s\n' "\$*" >&2
    exit 1
    ;;
esac
EOF
  chmod +x "${TEST_DIR}/bin/curl"
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

test_quality_gate_passes_when_sonar_reports_ok() {
  print_header "Quality gate passes when Sonar returns OK"
  TESTS_RUN=$((TESTS_RUN + 1))
  reset_test_dir
  setup_report_task
  setup_fake_curl_success

  if PATH="${TEST_DIR}/bin:${PATH}" \
    SONAR_TOKEN="test-token" \
    BUILD_SOURCESDIRECTORY="${TEST_DIR}/workspace" \
    bash "${TARGET_SCRIPT}" >"${TEST_DIR}/stdout.log" 2>"${TEST_DIR}/stderr.log"; then
    print_pass "Script exited successfully"
  else
    print_fail "Script should have succeeded"
  fi

  assert_contains "Quality Gate passed: OK" "${TEST_DIR}/stdout.log"
}

test_quality_gate_fails_when_sonar_reports_error() {
  print_header "Quality gate fails when Sonar returns ERROR"
  TESTS_RUN=$((TESTS_RUN + 1))
  reset_test_dir
  setup_report_task
  setup_fake_curl_failure

  if PATH="${TEST_DIR}/bin:${PATH}" \
    SONAR_TOKEN="test-token" \
    BUILD_SOURCESDIRECTORY="${TEST_DIR}/workspace" \
    bash "${TARGET_SCRIPT}" >"${TEST_DIR}/stdout.log" 2>"${TEST_DIR}/stderr.log"; then
    print_fail "Script should have failed"
  else
    print_pass "Script failed as expected"
  fi

  assert_contains "Quality Gate failed: ERROR" "${TEST_DIR}/stderr.log"
}

main() {
  test_quality_gate_passes_when_sonar_reports_ok
  test_quality_gate_fails_when_sonar_reports_error

  echo "Tests run: ${TESTS_RUN}"
  echo "Tests passed: ${TESTS_PASSED}"
  echo "Tests failed: ${TESTS_FAILED}"

  if [[ "${TESTS_FAILED}" -ne 0 ]]; then
    exit 1
  fi
}

main "$@"
