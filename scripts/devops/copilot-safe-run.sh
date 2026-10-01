#!/usr/bin/env bash
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Usage: copilot-safe-run.sh <copilot-command...>"
  echo "Example: copilot-safe-run.sh copilot <args>"
  exit 1
fi

COMMAND=("$@")
DEFAULT_NEMOTRON_MODEL="nvidia/z-ai/glm-5.3-flash"
DEFAULT_MODEL_SEQUENCE="nvidia/z-ai/glm-5.3-flash nvidia/meta/muse-glimmer-30b nvidia/z-ai/glm-5.3"

_9router_api_key() {
  python3 - "$HOME/.9router/db/data.sqlite" <<'PY' 2>/dev/null
import sqlite3, sys
try:
    c = sqlite3.connect(sys.argv[1])
    row = c.execute("SELECT key FROM apiKeys WHERE isActive=1 ORDER BY createdAt DESC LIMIT 1").fetchone()
    if row and row[0]:
        print(row[0])
except Exception:
    pass
PY
}

if [[ -z "${COPILOT_PROVIDER_BASE_URL:-}" && -f "$HOME/.9router/db/data.sqlite" ]]; then
  export COPILOT_PROVIDER_BASE_URL="http://127.0.0.1:20128/v1"
  export COPILOT_PROVIDER_TYPE="${COPILOT_PROVIDER_TYPE:-openai}"
  if [[ -z "${COPILOT_PROVIDER_API_KEY:-}" ]]; then
    export COPILOT_PROVIDER_API_KEY="$(_9router_api_key)"
  fi
fi

_copilot_safe_is_forbidden_model() {
  local candidate="$1"
  [[ -z "$candidate" || "$candidate" == "gpt-5.4-mini" || "$candidate" == *qwen* || "$candidate" == *Qwen* || "$candidate" == *glm-5.2* || "$candidate" == *minimax-m3* || "$candidate" == *deepseek-v4-flash ]]
}

_copilot_safe_sanitize_model() {
  local candidate="$1"
  if _copilot_safe_is_forbidden_model "$candidate"; then
    echo "$DEFAULT_NEMOTRON_MODEL"
    return
  fi
  echo "$candidate"
}

HAS_CLI_MODEL=0
CLI_MODEL=""
CLI_PROVIDER_MODEL_ID=""

sanitize_model_flags() {
  local -n __output_ref="$1"
  shift
  local input=("$@")
  local output=()
  local arg
  local skip_next=0
  local index

  for index in "${!input[@]}"; do
    arg="${input[$index]}"

    if [[ $skip_next -eq 1 ]]; then
      skip_next=0
      continue
    fi

    case "$arg" in
      --model=*)
        HAS_CLI_MODEL=1
        CLI_MODEL="$(_copilot_safe_sanitize_model "${arg#--model=}")"
        ;;
      --model)
        HAS_CLI_MODEL=1
        if [[ $((index + 1)) -lt ${#input[@]} ]]; then
          CLI_MODEL="$(_copilot_safe_sanitize_model "${input[$((index + 1))]}")"
          skip_next=1
        fi
        ;;
      --provider-model-id=*)
        CLI_PROVIDER_MODEL_ID="$(_copilot_safe_sanitize_model "${arg#--provider-model-id=}")"
        ;;
      --provider-model-id)
        if [[ $((index + 1)) -lt ${#input[@]} ]]; then
          CLI_PROVIDER_MODEL_ID="$(_copilot_safe_sanitize_model "${input[$((index + 1))]}")"
          skip_next=1
        fi
        ;;
      *)
        output+=("$arg")
        ;;
    esac
  done

  __output_ref=("${output[@]}")
}

_sanitized_command=()
sanitize_model_flags _sanitized_command "${COMMAND[@]}"
COMMAND=("${_sanitized_command[@]}")
unset _sanitized_command

if [[ ${#COMMAND[@]} -eq 0 ]]; then
  echo "copilot-safe-run: command contains only model flags; provide a Copilot command to run."
  exit 1
fi

_copilot_safe_sanitize_model_sequence() {
  local raw_sequence="$1"
  local token normalized
  local output=""

  if [[ -z "$raw_sequence" ]]; then
    echo "$DEFAULT_MODEL_SEQUENCE"
    return
  fi

  for token in ${raw_sequence//,/ }; do
    normalized="$(_copilot_safe_sanitize_model "$token")"
    if [[ -z "$normalized" ]]; then
      continue
    fi
    if [[ " $output " != *" $normalized "* ]]; then
      output="${output:+$output }$normalized"
    fi
  done

  if [[ -z "${output// }" ]]; then
    echo "$DEFAULT_MODEL_SEQUENCE"
    return
  fi

  echo "$output"
}

declare -a CANDIDATE_MODELS=()
declare -a CANDIDATE_PROVIDER_MODELS=()

if [[ -n "${CLI_MODEL:-}" ]]; then
  CANDIDATE_MODELS+=("$CLI_MODEL")
fi

DETERMINE_MODELS="$(_copilot_safe_sanitize_model_sequence "${COPILOT_MODEL_SEQUENCE:-${COPILOT_MODEL:-$DEFAULT_MODEL_SEQUENCE}}")"
for token in ${DETERMINE_MODELS//,/ }; do
  if [[ ! " ${CANDIDATE_MODELS[*]:-} " =~ [[:space:]]${token}[[:space:]] ]]; then
    CANDIDATE_MODELS+=("$token")
  fi
done

if [[ ${#CANDIDATE_MODELS[@]} -eq 0 || -z "${CANDIDATE_MODELS[0]:-}" ]]; then
  CANDIDATE_MODELS=("$DEFAULT_NEMOTRON_MODEL")
fi

if [[ -n "${CLI_PROVIDER_MODEL_ID:-}" ]]; then
  CANDIDATE_PROVIDER_MODELS+=("$CLI_PROVIDER_MODEL_ID")
fi

DETERMINE_PROVIDER_MODELS="$(_copilot_safe_sanitize_model_sequence "${COPILOT_PROVIDER_MODEL_SEQUENCE:-${COPILOT_PROVIDER_MODEL_ID:-${COPILOT_MODEL:-$DEFAULT_MODEL_SEQUENCE}}}")"
for token in ${DETERMINE_PROVIDER_MODELS//,/ }; do
  if [[ ! " ${CANDIDATE_PROVIDER_MODELS[*]:-} " =~ [[:space:]]${token}[[:space:]] ]]; then
    CANDIDATE_PROVIDER_MODELS+=("$token")
  fi
done

if [[ ${#CANDIDATE_PROVIDER_MODELS[@]} -eq 0 || -z "${CANDIDATE_PROVIDER_MODELS[0]:-}" ]]; then
  CANDIDATE_PROVIDER_MODELS=("${CANDIDATE_MODELS[0]}")
fi

MAX_ATTEMPTS="${COPILOT_SAFE_MAX_ATTEMPTS:-2}"
BASE_DELAY_SECONDS="${COPILOT_SAFE_RETRY_DELAY_SECONDS:-4}"
if ! [[ "${MAX_ATTEMPTS}" =~ ^[0-9]+$ && "${BASE_DELAY_SECONDS}" =~ ^[0-9]+$ ]]; then
  echo "copilot-safe-run: COPILOT_SAFE_MAX_ATTEMPTS and COPILOT_SAFE_RETRY_DELAY_SECONDS must be non-negative integers." >&2
  exit 1
fi
if [[ "${MAX_ATTEMPTS}" -eq 0 ]]; then
  echo "copilot-safe-run: COPILOT_SAFE_MAX_ATTEMPTS must be greater than 0." >&2
  exit 1
fi

is_immediate_fallback_error() {
  local text="$1"
  local lower
  lower="$(printf '%s' "$text" | tr '[:upper:]' '[:lower:]')"
  [[ "$lower" == *"410"* ]] || [[ "$lower" == *"gone"* ]] || \
  [[ "$lower" == *"404"* ]] || [[ "$lower" == *"not found"* ]] || \
  [[ "$lower" == *"no longer available"* ]] || [[ "$lower" == *"end of life"* ]]
}

is_retriable_error() {
  local text="$1"
  local lower
  lower="$(printf '%s' "$text" | tr '[:upper:]' '[:lower:]')"
  is_immediate_fallback_error "$text" || \
  [[ "$lower" == *"rate limit"* ]] || [[ "$lower" == *"429"* ]] || \
  [[ "$lower" == *"502"* ]] || [[ "$lower" == *"503"* ]] || [[ "$lower" == *"504"* ]] || \
  [[ "$lower" == *"service unavailable"* ]] || [[ "$lower" == *"bad gateway"* ]] || \
  [[ "$lower" == *"gateway timeout"* ]] || [[ "$lower" == *"sessionmodelerror"* ]] || \
  [[ "$lower" == *"overloaded"* ]] || [[ "$lower" == *"econnrefused"* ]] || \
  [[ "$lower" == *"connection refused"* ]]
}

for idx in "${!CANDIDATE_MODELS[@]}"; do
  model="${CANDIDATE_MODELS[$idx]}"
  provider_model="${CANDIDATE_PROVIDER_MODELS[$idx]:-${CANDIDATE_PROVIDER_MODELS[0]}}"

  run_cmd=("${COMMAND[@]}")
  if [[ $HAS_CLI_MODEL -eq 1 ]]; then
    run_cmd+=("--model=$model")
  fi

  attempts=0
  while [[ $attempts -lt $MAX_ATTEMPTS ]]; do
    attempts=$((attempts + 1))
    output="$(env COPILOT_MODEL="$model" \
      COPILOT_PROVIDER_MODEL_ID="$provider_model" \
      COPILOT_PROVIDER_WIRE_MODEL="$model" \
      "${run_cmd[@]}" 2>&1)"
    exit_code=$?
    if [[ ${exit_code} -eq 0 ]]; then
      echo "copilot-safe-run: success with model '$model' (provider id: '$provider_model')"
      printf '%s\n' "$output"
      exit 0
    fi

    if ! is_retriable_error "$output"; then
      printf '%s\n' "$output" >&2
      exit "$exit_code"
    fi

    if is_immediate_fallback_error "$output"; then
      if [[ $((idx + 1)) -lt ${#CANDIDATE_MODELS[@]} ]]; then
        next_model="${CANDIDATE_MODELS[$((idx + 1))]}"
        next_provider="${CANDIDATE_PROVIDER_MODELS[$((idx + 1))]:-${CANDIDATE_PROVIDER_MODELS[0]}}"
        echo "copilot-safe-run: model '$model' is unavailable (410/404), switching to fallback model '$next_model' (provider id: '$next_provider')" >&2
        continue 2
      else
        echo "copilot-safe-run: model '$model' is unavailable and no fallback models remain." >&2
        printf '%s\n' "$output" >&2
        exit "$exit_code"
      fi
    fi

    if [[ $attempts -lt $MAX_ATTEMPTS ]]; then
      delay=$((BASE_DELAY_SECONDS * (attempts * attempts)))
      echo "copilot-safe-run: transient error detected using model '$model' (provider id: '$provider_model'), retrying in ${delay}s (attempt ${attempts}/${MAX_ATTEMPTS})" >&2
      sleep "$delay"
      continue
    fi

    if [[ $((idx + 1)) -lt ${#CANDIDATE_MODELS[@]} ]]; then
      next_model="${CANDIDATE_MODELS[$((idx + 1))]}"
      next_provider="${CANDIDATE_PROVIDER_MODELS[$((idx + 1))]:-${CANDIDATE_PROVIDER_MODELS[0]}}"
      echo "copilot-safe-run: switching to fallback model '$next_model' (provider id: '$next_provider') due to repeated errors" >&2
      continue 2
    fi

    echo "copilot-safe-run: no fallback models left after failures." >&2
    printf '%s\n' "$output" >&2
    exit "$exit_code"
  done
done

echo "copilot-safe-run: all models exhausted after retries."
exit 1
