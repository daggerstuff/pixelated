#!/usr/bin/env bash
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Usage: copilot-safe-run.sh <copilot-command...>"
  echo "Example: copilot-safe-run.sh copilot <args>"
  exit 1
fi

COMMAND=("$@")
DEFAULT_NEMOTRON_MODEL="groq/openai/gpt-oss-120b"

_copilot_safe_is_forbidden_model() {
  local candidate="$1"
  [[ "$candidate" == "gpt-5.4-mini" || "$candidate" == *qwen* ]]
}

_copilot_safe_sanitize_model() {
  local candidate="$1"
  if _copilot_safe_is_forbidden_model "$candidate"; then
    echo "$DEFAULT_NEMOTRON_MODEL"
    return
  fi
  echo "$candidate"
}

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
      output+=("$(_copilot_safe_sanitize_model "$arg")")
      continue
    fi

    case "$arg" in
      --model=*)
        output+=("--model=$(_copilot_safe_sanitize_model "${arg#--model=}")")
        ;;
      --provider-model-id=*)
        output+=("--provider-model-id=$(_copilot_safe_sanitize_model "${arg#--provider-model-id=}")")
        ;;
      --model|--provider-model-id)
        output+=("$arg")
        skip_next=1
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
    echo "$DEFAULT_NEMOTRON_MODEL"
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
    echo "$DEFAULT_NEMOTRON_MODEL"
    return
  fi

  echo "$output"
}

DETERMINE_MODELS="$(_copilot_safe_sanitize_model_sequence "${COPILOT_MODEL_SEQUENCE:-${COPILOT_MODEL:-$DEFAULT_NEMOTRON_MODEL}}")"
DETERMINE_PROVIDER_MODELS="$(_copilot_safe_sanitize_model_sequence "${COPILOT_PROVIDER_MODEL_SEQUENCE:-${COPILOT_PROVIDER_MODEL_ID:-${COPILOT_MODEL:-$DEFAULT_NEMOTRON_MODEL}}}")"

for token in ${DETERMINE_MODELS//,/ }; do
  CANDIDATE_MODELS+=("$token")
done
if [[ ${#CANDIDATE_MODELS[@]} -eq 0 || -z "${CANDIDATE_MODELS[0]}" ]]; then
  CANDIDATE_MODELS=("${COPILOT_MODEL:-$DEFAULT_NEMOTRON_MODEL}")
fi

for token in ${DETERMINE_PROVIDER_MODELS//,/ }; do
  CANDIDATE_PROVIDER_MODELS+=("$token")
done
if [[ ${#CANDIDATE_PROVIDER_MODELS[@]} -eq 0 || -z "${CANDIDATE_PROVIDER_MODELS[0]}" ]]; then
  CANDIDATE_PROVIDER_MODELS=("${COPILOT_PROVIDER_MODEL_ID:-${CANDIDATE_MODELS[0]}}")
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

is_rate_limit_error() {
  local text="$1"
  local lower
  lower="$(printf '%s' "$text" | tr '[:upper:]' '[:lower:]')"
  [[ "$lower" == *"rate limit"* ]] || [[ "$lower" == *"429"* ]] || [[ "$lower" == *"sessionmodelerror"* ]]
}

for idx in "${!CANDIDATE_MODELS[@]}"; do
  model="${CANDIDATE_MODELS[$idx]}"
  provider_model="${CANDIDATE_PROVIDER_MODELS[$idx]:-${CANDIDATE_PROVIDER_MODELS[0]}}"

  attempts=0
  while [[ $attempts -lt $MAX_ATTEMPTS ]]; do
    attempts=$((attempts + 1))
    output="$(env COPILOT_MODEL="$model" COPILOT_PROVIDER_MODEL_ID="$provider_model" \
      "${COMMAND[@]}" 2>&1)"
    exit_code=$?
    if [[ ${exit_code} -eq 0 ]]; then
      echo "copilot-safe-run: success with model '$model' (provider id: '$provider_model')"
      printf '%s\n' "$output"
      exit 0
    fi
    if ! is_rate_limit_error "$output"; then
      printf '%s\n' "$output" >&2
      exit "$exit_code"
    fi

    if [[ $attempts -lt $MAX_ATTEMPTS ]]; then
      delay=$((BASE_DELAY_SECONDS * (attempts * attempts)))
      echo "copilot-safe-run: rate-limit detected using model '$model' (provider id: '$provider_model'), retrying in ${delay}s (attempt ${attempts}/${MAX_ATTEMPTS})" >&2
      sleep "$delay"
      continue
    fi

    if [[ $((idx + 1)) -lt ${#CANDIDATE_MODELS[@]} ]]; then
      next_model="${CANDIDATE_MODELS[$((idx + 1))]}"
      next_provider="${CANDIDATE_PROVIDER_MODELS[$((idx + 1))]:-${CANDIDATE_PROVIDER_MODELS[0]}}"
      echo "copilot-safe-run: switching to fallback model '$next_model' (provider id: '$next_provider') due to repeated rate-limit errors" >&2
      continue 2
    fi

    echo "copilot-safe-run: no fallback models left after rate-limit failures." >&2
    printf '%s\n' "$output" >&2
    exit "$exit_code"
  done
done

echo "copilot-safe-run: all models exhausted after retries."
exit 1
