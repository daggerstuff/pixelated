#!/usr/bin/env bash
# Shared helpers for persona-regeneration jobs.

log_info() {
  echo "ℹ️  $*"
}

log_warning() {
  echo "⚠️  $*"
}

send_slack_notification() {
  local webhook_url="${SLACK_WEBHOOK_URL:-}"
  local title="$1"
  local message="$2"

  if [[ -z "${webhook_url}" ]]; then
    return 0
  fi

  if ! command -v curl >/dev/null; then
    log_warning "curl is required for Slack webhook notifications but is not available."
    return 0
  fi

  if ! command -v python3 >/dev/null; then
    log_warning "python3 is required for Slack payload escaping but is not available."
    return 0
  fi

  local payload
  payload="$(
    python3 - "${title}" "${message}" <<'PY'
import json
import sys

title = sys.argv[1]
message = sys.argv[2]
print(json.dumps({"text": f"{title}\\n{message}"}))
PY
  )"

  if ! curl -fsS -X POST \
    -H 'Content-Type: application/json' \
    -d "${payload}" \
    "${webhook_url}" \
    >/tmp/slack_webhook.log 2>&1; then
    log_warning "Slack webhook request failed. See /tmp/slack_webhook.log"
  fi
}

s3_object_exists() {
  local bucket="$1"
  local key="$2"

  if command -v aws >/dev/null; then
    if aws s3api head-object --bucket "${bucket}" --key "${key}" --endpoint-url "${S3_ENDPOINT}" >/dev/null 2>&1; then
      return 0
    fi
    return 1
  fi

  if ! command -v python3 >/dev/null; then
    return 2
  fi

  python3 - "${bucket}" "${key}" "${S3_ENDPOINT}" "${S3_REGION}" <<'PY'
import os
import sys
import json

bucket, key, endpoint, region = sys.argv[1:5]

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

session = boto3.session.Session(
    aws_access_key_id=os.environ["OVH_S3_ACCESS_KEY"],
    aws_secret_access_key=os.environ["OVH_S3_SECRET_KEY"],
)
client = session.client(
    "s3",
    endpoint_url=endpoint,
    region_name=region,
    config=Config(signature_version="s3v4"),
)

try:
    client.head_object(Bucket=bucket, Key=key)
except ClientError:
    raise SystemExit(1)
except Exception:
    raise SystemExit(2)
raise SystemExit(0)
PY
}

load_env_file() {
  if [[ -f ".env" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ = ]]; then
        local key
        local value
        key=$(echo "$line" | cut -d= -f1)
        value=$(echo "$line" | cut -d= -f2- | sed -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')
        export "$key"="$value"
      fi
    done < .env
  fi
}

preflight_check_env() {
  local key="$1"
  local value="$2"
  local label="$3"

  if [[ -z "$value" ]]; then
    log_warning "Optional ${label} (${key}) is not set."
  else
    log_info "Configured ${label}: ${key}=${value}"
  fi
}

resolve_python() {
  local candidate="$1"
  local -a candidates
  local resolved

  if [[ -n "$candidate" ]] && [[ -x "$candidate" ]]; then
    echo "$candidate"
    return 0
  fi

  candidates=(
    "/app/.venv/bin/python"
    "/opt/venv/bin/python"
  )

  for python_candidate in "${candidates[@]}"; do
    resolved="$(command -v "${python_candidate}" || true)"
    if [[ -n "$resolved" ]] && [[ -x "$resolved" ]]; then
      echo "$resolved"
      return 0
    fi
  done

  return 1
}

python_has_torch() {
  local python_path="$1"
  "${python_path}" - <<'PY'
import importlib.util
raise SystemExit(0 if importlib.util.find_spec("torch") else 1)
PY
}
