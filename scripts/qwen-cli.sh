#!/usr/bin/env bash
set -euo pipefail

# Qwen3 terminal CLI for your OpenAI-compatible endpoint (LiteLLM)
# Requirements:
#   - export QWEN_API_KEY=... (required)
#   - export QWEN_API_BASE=http://209.208.79.191:8080/v1 (optional; default below)
#   - jq installed
# Usage:
#   scripts/qwen-cli.sh "Your prompt here"
#   echo "prompt" | scripts/qwen-cli.sh
#   scripts/qwen-cli.sh --stream "Long generation"
#   scripts/qwen-cli.sh --system "You are a helpful code assistant" "Prompt"
#   scripts/qwen-cli.sh --file path/to/file.py "Review this file"
#   scripts/qwen-cli.sh --repl

API_BASE=${QWEN_API_BASE:-"http://209.208.79.191:8080/v1"}
MODEL=${QWEN_MODEL:-"qwen3-coder"}
SYSTEM=${QWEN_SYSTEM:-""}
STREAM=0
FILE_INPUT=""
REPL=0

print_help() {
  cat <<EOF
Usage: qwen-cli.sh [options] [prompt]
Options:
  --stream                 Stream tokens to stdout
  --system "text"          Add a system prompt
  --file <path>            Include file contents in the user prompt
  --model <name>           Override model (default: $MODEL)
  --repl                   Interactive multi-turn chat
  -h, --help               Show help
Environment:
  QWEN_API_KEY (required), QWEN_API_BASE (default: $API_BASE), QWEN_MODEL
EOF
}

if [[ -z "${QWEN_API_KEY:-}" ]]; then
  echo "ERROR: QWEN_API_KEY is not set." >&2
  exit 1
fi

args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stream) STREAM=1; shift ;;
    --system) SYSTEM="$2"; shift 2 ;;
    --file) FILE_INPUT="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --repl) REPL=1; shift ;;
    -h|--help) print_help; exit 0 ;;
    *) args+=("$1"); shift ;;
  esac
done

get_prompt() {
  local base_prompt
  if [[ ${#args[@]} -gt 0 ]]; then
    base_prompt="${args[*]}"
  else
    base_prompt=$(cat)
  fi

  if [[ -n "$FILE_INPUT" ]]; then
    if [[ -f "$FILE_INPUT" ]]; then
      local file_content
      file_content=$(cat "$FILE_INPUT")
      base_prompt+=$'\n\n[FILE '"$FILE_INPUT"$']\n'"$file_content"
    else
      echo "WARN: --file '$FILE_INPUT' not found" >&2
    fi
  fi
  echo "$base_prompt"
}

make_payload() {
  local prompt
  prompt=$(get_prompt)
  if [[ -n "$SYSTEM" ]]; then
    jq -cn --arg m "$MODEL" --arg s "$SYSTEM" --arg p "$prompt" \
      '{model:$m, messages:[{role:"system", content:$s},{role:"user", content:$p}]}'
  else
    jq -cn --arg m "$MODEL" --arg p "$prompt" \
      '{model:$m, messages:[{role:"user", content:$p}]}'
  fi
}

chat_once() {
  local payload
  payload=$(make_payload)
  if [[ $STREAM -eq 1 ]]; then
    curl -sS "$API_BASE/chat/completions" \
      -H "Authorization: Bearer $QWEN_API_KEY" \
      -H 'Content-Type: application/json' \
      -d "$payload" | jq -r '.choices[0].message.content // .error.message'
  else
    curl -sS "$API_BASE/chat/completions" \
      -H "Authorization: Bearer $QWEN_API_KEY" \
      -H 'Content-Type: application/json' \
      -d "$payload" | jq -r '.choices[0].message.content // .error.message'
  fi
}

repl_loop() {
  local history_json
  history_json='[]'
  if [[ -n "$SYSTEM" ]]; then
    history_json=$(jq -cn --arg s "$SYSTEM" '[{"role":"system","content":$s}]')
  fi
  echo "Entering REPL (Ctrl-C to exit)"
  while true; do
    read -rp $'\nYou> ' line || break
    local prompt="$line"
    if [[ -n "$FILE_INPUT" && -f "$FILE_INPUT" ]]; then
      prompt+=$'\n\n[FILE '"$FILE_INPUT"$']\n'"$(cat "$FILE_INPUT")"
    fi
    history_json=$(jq --arg p "$prompt" '. + [{"role":"user","content":$p}]' <<< "$history_json")
    local payload=$(jq -cn --arg m "$MODEL" --argjson msgs "$history_json" '{model:$m, messages:$msgs}')
    local resp=$(curl -sS "$API_BASE/chat/completions" \
      -H "Authorization: Bearer $QWEN_API_KEY" \
      -H 'Content-Type: application/json' \
      -d "$payload")
    local content=$(jq -r '.choices[0].message.content // .error.message' <<< "$resp")
    echo -e "Assistant> $content"
    history_json=$(jq --arg c "$content" '. + [{"role":"assistant","content":$c}]' <<< "$history_json")
  done
}

if [[ $REPL -eq 1 ]]; then
  repl_loop
else
  chat_once
fi
