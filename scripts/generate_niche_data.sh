#!/bin/bash
#
# Generate niche category training data with strict quality controls
# - Runs 20-30 samples per batch per category
# - Built-in validation filters out bad samples
# - Tracks progress to avoid re-generation
# - Auto-restart on failure
# - Post-processing to create clean consolidated dataset

set -e

# Configuration
BATCH_SIZE=25
MAX_RETRIES=5
BATCH_DELAY=8
CATEGORY_DELAY=20
OUTPUT_DIR="/home/vivi/pixelated/data/therapeutic"
LOG_FILE="/home/vivi/pixelated/data/therapeutic/generation.log"
AI_DIR="/home/vivi/pixelated/ai"
REPO_DIR="/home/vivi/pixelated"
STATE_FILE="/home/vivi/pixelated/data/therapeutic/.generation_state"

# Categories to generate
CATEGORIES=(
  "dissociation"
  "somatic_therapy"
  "attachment_disorders"
  "narcissistic_abuse_recovery"
  "complicated_grief"
  "eating_disorders"
  "ocd_intrusive_thoughts"
  "personality_disorders"
  "neurodivergent_mental_health"
  "cultural_religious_contexts"
)

# Target per category (higher to account for stricter validation filtering)
TARGET_PER_CATEGORY=160

# Get API key
export NVIDIA_API_KEY="${NVIDIA_API_KEY:-$(grep NVIDIA_API_KEY .env 2>/dev/null | head -1 | cut -d"'" -f2)}"

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

  # Run the generation from ai/ subproject directory
  cd "$AI_DIR"
  uv run python -m training.sdg_pipeline \
    --scenario niche_category \
    --category "$cat" \
    --target_count "$batch" \
    --output_path "$output_file" \
    --nemo_endpoint https://integrate.api.nvidia.com/v1 \
    --nemo_api_key "$NVIDIA_API_KEY" \
    --nemo_model nvidia/llama-3.3-nemotron-super-49b-v1 \
    --max_iterations 50 \
    2>&1 | tee -a "$LOG_FILE"
  local gen_exit=$?
  cd "$REPO_DIR"

  if [ "$gen_exit" -ne 0 ]; then
    log "ERROR: Generation failed for ${cat}"
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
  cd "$AI_DIR"
  uv run python -c "
import json, sys
from training.sdg_pipeline import validate_sample, _check_deduplication

raw_path = '${OUTPUT_DIR}/niche_categories_raw.jsonl'
out_path = '${OUTPUT_DIR}/niche_categories_1000.jsonl'

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

print(f'Filtered: {len(records)} -> {len(valid)} ({len(records)-len(valid)} rejected)')
for reason, count in sorted(rejected.items(), key=lambda x: -x[1])[:5]:
    print(f'  {reason}: {count}')
" 2>&1 | tee -a "$LOG_FILE"
  cd "$REPO_DIR"

  # Create category distribution report
  python3 << 'PYEOF'
import json
from collections import Counter

with open('/home/vivi/pixelated/data/therapeutic/niche_categories_1000.jsonl') as f:
    samples = [json.loads(l) for l in f if l.strip()]

categories = Counter(s.get('category') for s in samples)

with open('/home/vivi/pixelated/data/therapeutic/category_report.json', 'w') as f:
    json.dump(dict(categories), f, indent=2)

total = sum(categories.values())
print(f"Final dataset: {total} samples across {len(categories)} categories")
for cat, count in sorted(categories.items()):
    print(f"  {cat}: {count}")
PYEOF

  log "Post-processing complete"
}

# Main loop with retry logic
main() {
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

      local retries=0
      local success=false

      while [ $retries -lt $MAX_RETRIES ] && [ "$success" = false ]; do
        if generate_batch "$cat"; then
          success=true
          made_progress=true
          stall_count=0
        else
          retries=$((retries + 1))
          log "Retry ${retries}/${MAX_RETRIES} for ${cat}"
          sleep 5
        fi
      done

      if [ "$success" = false ]; then
        log "ERROR: Max retries exceeded for ${cat}"
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
