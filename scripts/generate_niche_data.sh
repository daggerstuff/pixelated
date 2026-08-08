#!/bin/bash
#
# Generate niche category training data with strict quality controls
# - Runs 20-30 samples per batch per category
# - Built-in validation filters out bad samples
# - Tracks progress to avoid re-generation
# - Auto-restart on failure
# - Post-processing to create clean consolidated dataset

set -euo pipefail

# Configuration
SDG_RUN_MODE="${SDG_RUN_MODE:-stable}"
BATCH_SIZE="${SDG_BATCH_SIZE:-25}"
MAX_RETRIES="${SDG_MAX_RETRIES:-6}"
BATCH_DELAY="${SDG_BATCH_DELAY:-8}"
CATEGORY_DELAY="${SDG_CATEGORY_DELAY:-20}"
API_RETRY_BASE_DELAY="${SDG_API_RETRY_BASE_DELAY:-8}"
API_RETRY_MAX_DELAY="${SDG_API_RETRY_MAX_DELAY:-120}"
COMMAND_TIMEOUT="${SDG_COMMAND_TIMEOUT:-900}"
NEMO_ENDPOINTS="${NVIDIA_API_ENDPOINTS:-https://integrate.api.nvidia.com/v1}"
NEMO_MODELS="${NVIDIA_MODEL_LIST:-nvidia/llama-3.3-nemotron-super-49b-v1}"
SDG_THERAPIST_STYLE_PROFILE="${SDG_THERAPIST_STYLE_PROFILE:-warm_professional}"
SDG_STYLE_AUDIT_PROFILES="${SDG_STYLE_AUDIT_PROFILES:-$SDG_THERAPIST_STYLE_PROFILE}"
SDG_STYLE_AUDIT_LIMIT="${SDG_STYLE_AUDIT_LIMIT:-120}"
SDG_RUN_STYLE_AUDIT="${SDG_RUN_STYLE_AUDIT:-true}"
OUTPUT_DIR="/home/vivi/pixelated/ai/data/therapeutic"
SDG_STYLE_AUDIT_SUMMARY_PATH="${SDG_STYLE_AUDIT_SUMMARY_PATH:-${OUTPUT_DIR}/style_audit_summary.json}"
LOG_FILE="/home/vivi/pixelated/ai/data/therapeutic/generation.log"
AI_DIR="/home/vivi/pixelated/ai"
STATE_FILE="/home/vivi/pixelated/ai/data/therapeutic/.generation_state"

# Categories to generate (derived from sdg_pipeline.py NICHE_CATEGORIES keys)
CATEGORIES=(
  "dissociation"
  "somatic_therapy"
  "attachment_disorders"
  "narcissistic_abuse_recovery"
  "complicated_grief"
  "eating_disorders"
  "ocd_intrusive_thoughts"
  "personality_disorders"
  "neurodivergent"
  "cultural_religious"
  "addiction"
  "clinical_literature"
  "cot_reasoning"
  "cptsd_trauma"
  "general_counseling"
  "long_running_therapy"
  "roleplay_simulation"
  "safety_guardrails"
  "therapeutic_expertise"
  "video_transcripts"
  "voice_persona"
)

# Target per category (higher to account for stricter validation filtering)
TARGET_PER_CATEGORY=160

# Get API key
if [ -z "${NVIDIA_API_KEY:-}" ] && [ -f .env ]; then
  export NVIDIA_API_KEY="$(grep -m1 -E '^NVIDIA_API_KEY=' .env 2>/dev/null | sed -E "s/^NVIDIA_API_KEY=//; s/^['\"]//; s/['\"]$//")"
fi
export NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"

if [ -z "$NVIDIA_API_KEY" ]; then
  echo "ERROR: NVIDIA_API_KEY not set"
  exit 1
fi

# Logging function
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

_split_csv() {
  local input="$1"
  local -n out="$2"
  local entry
  IFS=',' read -ra out <<< "$input"
  for i in "${!out[@]}"; do
    entry="${out[$i]}"
    entry="${entry#"${entry%%[![:space:]]*}"}"
    out[$i]="${entry%"${entry##*[![:space:]]}"}"
  done
}

_split_csv "$NEMO_ENDPOINTS" API_ENDPOINTS
_split_csv "$NEMO_MODELS" API_MODELS

UV_CMD=(uv run --active --project "$AI_DIR")

apply_run_profile() {
  case "$SDG_RUN_MODE" in
    throughput)
      if [ -z "${SDG_BATCH_SIZE:-}" ]; then
        BATCH_SIZE=30
      fi
      if [ -z "${SDG_MAX_RETRIES:-}" ]; then
        MAX_RETRIES=4
      fi
      if [ -z "${SDG_BATCH_DELAY:-}" ]; then
        BATCH_DELAY=4
      fi
      if [ -z "${SDG_CATEGORY_DELAY:-}" ]; then
        CATEGORY_DELAY=8
      fi
      if [ -z "${SDG_API_RETRY_BASE_DELAY:-}" ]; then
        API_RETRY_BASE_DELAY=5
      fi
      if [ -z "${SDG_API_RETRY_MAX_DELAY:-}" ]; then
        API_RETRY_MAX_DELAY=60
      fi
      if [ -z "${SDG_COMMAND_TIMEOUT:-}" ]; then
        COMMAND_TIMEOUT=900
      fi
      ;;
    conservative)
      if [ -z "${SDG_BATCH_SIZE:-}" ]; then
        BATCH_SIZE=20
      fi
      if [ -z "${SDG_MAX_RETRIES:-}" ]; then
        MAX_RETRIES=8
      fi
      if [ -z "${SDG_BATCH_DELAY:-}" ]; then
        BATCH_DELAY=12
      fi
      if [ -z "${SDG_CATEGORY_DELAY:-}" ]; then
        CATEGORY_DELAY=30
      fi
      if [ -z "${SDG_API_RETRY_BASE_DELAY:-}" ]; then
        API_RETRY_BASE_DELAY=12
      fi
      if [ -z "${SDG_API_RETRY_MAX_DELAY:-}" ]; then
        API_RETRY_MAX_DELAY=240
      fi
      if [ -z "${SDG_COMMAND_TIMEOUT:-}" ]; then
        COMMAND_TIMEOUT=1200
      fi
      ;;
    stable|*)
      ;;
  esac
}

api_backoff_sleep() {
  local attempt="$1"
  local delay=$((API_RETRY_BASE_DELAY * (2 ** (attempt - 1))))
  if ((delay > API_RETRY_MAX_DELAY)); then
    delay=$API_RETRY_MAX_DELAY
  fi
  local jitter=$((RANDOM % 10))
  delay=$((delay + jitter))
  log "Retrying in ${delay}s (attempt ${attempt}/${MAX_RETRIES})"
  sleep "$delay"
}

# Initialize state file if not exists
init_state() {
  if [ ! -f "$STATE_FILE" ]; then
    log "Initializing state file..."
    for cat in "${CATEGORIES[@]}"; do
      echo "${cat}=0" >> "$STATE_FILE"
    done
  fi
}

# Get current count for a category
get_count() {
  local cat=$1
  grep "^${cat}=" "$STATE_FILE" | cut -d= -f2
}

# Update count for a category
update_count() {
  local cat=$1
  local count=$2
  sed -i "s/^${cat}=.*/${cat}=${count}/" "$STATE_FILE"
}

# Check if category is complete
is_complete() {
  local cat=$1
  local current=$(get_count "$cat")
  [ "$current" -ge "$TARGET_PER_CATEGORY" ]
}

# Generate a batch for a category
run_generation_command() {
  local cat=$1
  local batch=$2
  local output_file=$3
  local endpoint=$4
  local model=$5

  (cd "$AI_DIR" && timeout "$COMMAND_TIMEOUT" "${UV_CMD[@]}" python -m training.sdg_pipeline \
    --scenario niche_category \
    --category "$cat" \
    --target_count "$batch" \
    --output_path "$output_file" \
    --nemo_endpoint "$endpoint" \
    --nemo_api_key "$NVIDIA_API_KEY" \
    --nemo_model "$model" \
    --max_iterations 50 \
    --style_profile "$SDG_THERAPIST_STYLE_PROFILE") 2>&1 | tee -a "$LOG_FILE"
  local status="${PIPESTATUS[0]}"
  if [ "$status" -eq 124 ]; then
    log "Timeout after ${COMMAND_TIMEOUT}s for ${cat} with endpoint=${endpoint}, model=${model}"
  fi
  return "$status"
}

generate_batch() {
  local cat=$1
  local current=$(get_count "$cat")
  local remaining=$((TARGET_PER_CATEGORY - current))

  if [ "$remaining" -le 0 ]; then
    return 1 # Already complete
  fi

  local batch=$BATCH_SIZE
  if [ "$remaining" -lt "$batch" ]; then
    batch=$remaining
  fi

  local output_file="${OUTPUT_DIR}/${cat}_batch_${current}.jsonl"

  log "Generating batch for ${cat}: ${current}/${TARGET_PER_CATEGORY} (batch size: ${batch})"

  local gen_exit=1
  local success=false
  local endpoint
  local model
  local attempt

  for endpoint in "${API_ENDPOINTS[@]}"; do
    for model in "${API_MODELS[@]}"; do
      for ((attempt = 1; attempt <= MAX_RETRIES; attempt += 1)); do
        if run_generation_command "$cat" "$batch" "$output_file" "$endpoint" "$model"; then
          gen_exit=0
          success=true
          break 3
        fi

        log "Generation attempt ${attempt}/${MAX_RETRIES} failed for ${cat} with endpoint=${endpoint}, model=${model}"
        api_backoff_sleep "$attempt"
      done
      if [ "$success" = true ]; then
        break
      fi
    done
    if [ "$success" = true ]; then
      break
    fi
  done

  if [ "$success" = false ]; then
    log "ERROR: Generation failed for ${cat} across all configured endpoints/models"
  fi

  if [ "$gen_exit" -ne 0 ]; then
    return 1
  fi

  # Verify the output file was created and has content
  if [ -f "$output_file" ] && [ -s "$output_file" ]; then
    local generated=$(wc -l < "$output_file")
    local new_count=$((current + generated))
    update_count "$cat" "$new_count"
    log "Completed ${cat} batch: ${generated} valid samples (total: ${new_count}/${TARGET_PER_CATEGORY})"
    return 0
  else
    log "ERROR: Output file empty or missing for ${cat}"
    return 1
  fi
}

# Post-processing: consolidate and create final dataset
post_process() {
  log "Post-processing: consolidating all batches..."

  # Concatenate all batch files
  cat "${OUTPUT_DIR}"/*_batch_*.jsonl > "${OUTPUT_DIR}/niche_categories_raw.jsonl" 2>/dev/null || true

  # Count total
  local total=$(wc -l < "${OUTPUT_DIR}/niche_categories_raw.jsonl" 2>/dev/null || echo "0")
  log "Raw dataset: ${total} samples"

  # Create final clean dataset — apply upgraded validation and deduplication
  (cd "$AI_DIR" && "${UV_CMD[@]}" python - << PYEOF
import json
from training.sdg_pipeline import validate_sample, _check_deduplication

raw_path = "${OUTPUT_DIR}/niche_categories_raw.jsonl"
out_path = "${OUTPUT_DIR}/niche_categories_1000.jsonl"

with open(raw_path) as f:
    records = [json.loads(l) for l in f if l.strip()]

valid = []
rejected = {}
existing = []
for r in records:
    ok, reason = validate_sample(r)
    if not ok:
        rejected[reason] = rejected.get(reason, 0) + 1
        continue
    ok2, reason2 = _check_deduplication(r, existing)
    if not ok2:
        rejected[reason2] = rejected.get(reason2, 0) + 1
        continue
    valid.append(r)
    existing.append(r)

with open(out_path, 'w') as f:
    for r in valid:
        f.write(json.dumps(r) + chr(10))

print("Filtered: {} -> {} ({} rejected)".format(len(records), len(valid), len(records) - len(valid)))
for reason, count in sorted(rejected.items(), key=lambda x: -x[1])[:5]:
    print("  {}: {}".format(reason, count))
PYEOF
  ) 2>&1 | tee -a "$LOG_FILE"

  # Style audit on final dataset
  if [ "$SDG_RUN_STYLE_AUDIT" = "true" ]; then
    _split_csv "$SDG_STYLE_AUDIT_PROFILES" STYLE_AUDIT_PROFILES
    for profile in "${STYLE_AUDIT_PROFILES[@]}"; do
      if [ -z "$profile" ]; then
        continue
      fi

      local audit_output="${OUTPUT_DIR}/style_audit_${profile}.json"
      (cd "$AI_DIR" && "${UV_CMD[@]}" python -m training.sdg_pipeline \
        --scenario niche_category \
        --output_path "${OUTPUT_DIR}/niche_categories_1000.jsonl" \
        --style_audit \
        --style_profile "$profile" \
        --style_audit_limit "$SDG_STYLE_AUDIT_LIMIT" \
        --style_audit_output "$audit_output") 2>&1 | tee -a "$LOG_FILE"
    done
  fi

  summarize_style_audits

  # Create category distribution report
  (cd "$AI_DIR" && "${UV_CMD[@]}" python - << 'PYEOF'
import json
from collections import Counter

with open('/home/vivi/pixelated/ai/data/therapeutic/niche_categories_1000.jsonl') as f:
    samples = [json.loads(l) for l in f if l.strip()]

categories = Counter(s.get('category') for s in samples)

with open('/home/vivi/pixelated/ai/data/therapeutic/category_report.json', 'w') as f:
    json.dump(dict(categories), f, indent=2)

total = sum(categories.values())
print(f"Final dataset: {total} samples across {len(categories)} categories")
for cat, count in sorted(categories.items()):
    print(f"  {cat}: {count}")
PYEOF
) 2>&1 | tee -a "$LOG_FILE"

  log "Post-processing complete"
}

summarize_style_audits() {
  if [ "$SDG_RUN_STYLE_AUDIT" != "true" ]; then
    return 0
  fi

  _split_csv "$SDG_STYLE_AUDIT_PROFILES" STYLE_AUDIT_PROFILES
  if [ ${#STYLE_AUDIT_PROFILES[@]} -eq 1 ] && [ -z "${STYLE_AUDIT_PROFILES[0]}" ]; then
    log "Skipping style audit summary: no profiles configured"
    return 0
  fi

  (cd "$AI_DIR" && OUTPUT_DIR="$OUTPUT_DIR" \
    SDG_STYLE_AUDIT_PROFILES="$SDG_STYLE_AUDIT_PROFILES" \
    SDG_STYLE_AUDIT_SUMMARY_PATH="$SDG_STYLE_AUDIT_SUMMARY_PATH" \
    "${UV_CMD[@]}" python - << PYEOF
import json
import os

from pathlib import Path

output_dir = Path(os.environ["OUTPUT_DIR"])
profiles = [p.strip() for p in os.environ.get("SDG_STYLE_AUDIT_PROFILES", "").split(",") if p.strip()]
summary_path = Path(os.environ.get("SDG_STYLE_AUDIT_SUMMARY_PATH", str(output_dir / "style_audit_summary.json")))

leaderboard = []
missing = []

for profile in profiles:
    path = output_dir / f"style_audit_{profile}.json"
    if not path.exists():
        missing.append(profile)
        continue
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
        leaderboard.append(report)
    except json.JSONDecodeError:
        missing.append(profile)

leaderboard.sort(key=lambda item: item.get("pass_rate", 0), reverse=True)

for rank, report in enumerate(leaderboard, start=1):
    profile = report.get("style_profile", "")
    pass_rate = report.get("pass_rate", 0)
    total = report.get("total_samples", 0)
    failed = report.get("failed", 0)
    passed = report.get("passed", 0)
    print(f"[{rank}] {profile}: pass_rate={pass_rate:.2%}, passed={passed}, failed={failed}, total={total}")
    for top in report.get("top_rejections", [])[:3]:
        reason = top.get("reason", "")
        count = top.get("count", 0)
        if reason:
            print(f"    - {reason}: {count}")

for profile in missing:
    print(f"[missing] {profile}: no valid audit report found")

summary = {
    "profiles": profiles,
    "leaderboard": leaderboard,
    "missing_profiles": missing,
}

summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
print(f"Style audit summary written: {summary_path}")
print("Style audit leaderboard (pass rate):")
for rank, report in enumerate(leaderboard, start=1):
    print(f"{rank}. {report.get('style_profile', 'unknown')} — {report.get('pass_rate', 0):.2%}")
PYEOF
  ) 2>&1 | tee -a "$LOG_FILE"
}

# Main loop with retry logic
main() {
  mkdir -p "$OUTPUT_DIR"
  touch "$LOG_FILE"
  apply_run_profile
  log "Run profile: ${SDG_RUN_MODE}"
  init_state

  log "Starting data generation..."
  log "Target: ${TARGET_PER_CATEGORY} samples per category (after filtering)"
  log "Categories: ${#CATEGORIES[@]}"

  local stall_count=0
  local max_stalls=5

  while true; do
  local all_complete=true
  local made_progress=false

    for cat in "${CATEGORIES[@]}"; do
      if is_complete "$cat"; then
        continue
      fi

      all_complete=false

      if generate_batch "$cat"; then
        made_progress=true
        stall_count=0
      else
        log "ERROR: Batch failed for ${cat} after trying all configured providers"
        stall_count=$((stall_count + 1))
      fi

      # Delay between categories
      sleep $BATCH_DELAY
    done

    # Check if all complete
    if [ "$all_complete" = true ]; then
      log "All categories complete!"
      break
    fi

    # Check for stall
    if [ "$made_progress" = false ]; then
      stall_count=$((stall_count + 1))
      log "No progress, stall count: ${stall_count}/${max_stalls}"

      if [ $stall_count -ge $max_stalls ]; then
        log "ERROR: Too many stalls, exiting"
        exit 1
      fi

      sleep 30
    fi
  done

  # Post-process
  post_process
}

# Handle interrupt
trap 'log "Interrupted by user"; exit 0' INT TERM

# Run main
main
