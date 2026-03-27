#!/usr/bin/env bash
set -euo pipefail

SONAR_POLLING_TIMEOUT_SEC="${SONAR_POLLING_TIMEOUT_SEC:-300}"
SONAR_POLL_INTERVAL_SEC="${SONAR_POLL_INTERVAL_SEC:-5}"
WORKSPACE_DIR="${BUILD_SOURCESDIRECTORY:-$(pwd)}"

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "##vso[task.logissue type=error]Required command not found: ${command_name}" >&2
    exit 1
  fi
}

require_env() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    echo "##vso[task.logissue type=error]Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
}

json_field() {
  local key_path="$1"
  node -e '
    const fs = require("fs");
    const keyPath = process.argv[1].split(".");
    const input = fs.readFileSync(0, "utf8");
    const data = JSON.parse(input);
    let value = data;
    for (const key of keyPath) {
      if (value == null || !(key in value)) {
        process.exit(2);
      }
      value = value[key];
    }
    if (typeof value === "object") {
      process.stdout.write(JSON.stringify(value));
    } else {
      process.stdout.write(String(value));
    }
  ' "${key_path}"
}

read_property() {
  local property_name="$1"
  local file_path="$2"
  sed -n "s/^${property_name}=//p" "${file_path}" | head -n 1
}

find_report_task_file() {
  if [[ -n "${SONAR_SCANNER_REPORTTASKFILE:-}" && -f "${SONAR_SCANNER_REPORTTASKFILE}" ]]; then
    printf '%s\n' "${SONAR_SCANNER_REPORTTASKFILE}"
    return 0
  fi

  find "${WORKSPACE_DIR}" \
    \( -path '*/.scannerwork/report-task.txt' -o -path '*/.sonarqube/out/.sonar/report-task.txt' -o -name 'report-task.txt' \) \
    -type f \
    | head -n 1
}

poll_ce_task() {
  local ce_task_url="$1"
  local attempts=$((SONAR_POLLING_TIMEOUT_SEC / SONAR_POLL_INTERVAL_SEC))
  local response=""
  local status=""
  local analysis_id=""
  local attempt=0

  while (( attempt <= attempts )); do
    response="$(curl -fsS -u "${SONAR_TOKEN}:" "${ce_task_url}")"
    status="$(printf '%s' "${response}" | json_field 'task.status')"

    case "${status}" in
      SUCCESS)
        analysis_id="$(printf '%s' "${response}" | json_field 'task.analysisId')"
        printf '%s\n' "${analysis_id}"
        return 0
        ;;
      PENDING|IN_PROGRESS)
        sleep "${SONAR_POLL_INTERVAL_SEC}"
        ;;
      CANCELED|FAILED)
        echo "##vso[task.logissue type=error]Sonar CE task failed with status ${status}." >&2
        exit 1
        ;;
      *)
        echo "##vso[task.logissue type=error]Unexpected Sonar CE task status: ${status}" >&2
        exit 1
        ;;
    esac

    attempt=$((attempt + 1))
  done

  echo "##vso[task.logissue type=error]Timed out waiting for Sonar analysis completion after ${SONAR_POLLING_TIMEOUT_SEC}s." >&2
  exit 1
}

main() {
  require_command curl
  require_command node
  require_env SONAR_TOKEN

  local report_task_file
  report_task_file="$(find_report_task_file)"
  if [[ -z "${report_task_file}" || ! -f "${report_task_file}" ]]; then
    echo "##vso[task.logissue type=error]Could not locate Sonar scanner report-task.txt under ${WORKSPACE_DIR}." >&2
    exit 1
  fi

  local server_url ce_task_url ce_task_id project_key
  server_url="$(read_property serverUrl "${report_task_file}")"
  ce_task_url="$(read_property ceTaskUrl "${report_task_file}")"
  ce_task_id="$(read_property ceTaskId "${report_task_file}")"
  project_key="$(read_property projectKey "${report_task_file}")"

  if [[ -z "${ce_task_url}" && -n "${server_url}" && -n "${ce_task_id}" ]]; then
    ce_task_url="${server_url%/}/api/ce/task?id=${ce_task_id}"
  fi

  if [[ -z "${ce_task_url}" ]]; then
    echo "##vso[task.logissue type=error]report-task.txt is missing ceTaskUrl/ceTaskId." >&2
    exit 1
  fi

  echo "Waiting for Sonar analysis to complete for ${project_key:-unknown project}..."
  local analysis_id
  analysis_id="$(poll_ce_task "${ce_task_url}")"

  local quality_gate_url quality_gate_response quality_gate_status
  quality_gate_url="${server_url%/}/api/qualitygates/project_status?analysisId=${analysis_id}"
  quality_gate_response="$(curl -fsS -u "${SONAR_TOKEN}:" "${quality_gate_url}")"
  quality_gate_status="$(printf '%s' "${quality_gate_response}" | json_field 'projectStatus.status')"

  echo "Quality Gate status: ${quality_gate_status}"
  echo "##vso[task.setvariable variable=SONAR_QUALITY_GATE_STATUS]${quality_gate_status}"

  case "${quality_gate_status}" in
    OK)
      echo "Quality Gate passed: ${quality_gate_status}"
      ;;
    WARN|ERROR|NONE)
      echo "##vso[task.logissue type=error]Quality Gate failed: ${quality_gate_status}" >&2
      exit 1
      ;;
    *)
      echo "##vso[task.logissue type=error]Unexpected Quality Gate status: ${quality_gate_status}" >&2
      exit 1
      ;;
  esac
}

main "$@"
