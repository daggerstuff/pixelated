#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--tool amp|claude] [max_iterations]

set -e

# Parse arguments
TOOL="amp" # Default to amp for backwards compatibility
MAX_ITERATIONS=10

while [[ $# -gt 0 ]]; do
	case $1 in
	--tool)
		TOOL="$2"
		shift 2
		;;
	--tool=*)
		TOOL="${1#*=}"
		shift
		;;
	*)
		# Assume it's max_iterations if it's a number
		if [[ $1 =~ ^[0-9]+$ ]]; then
			MAX_ITERATIONS="$1"
		fi
		shift
		;;
	esac
done
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

filter_agent_output() {
	local raw_output="$1"
	AGENT_OUTPUT_SANITIZE_INPUT="${raw_output}" python3 "${SCRIPT_DIR}/../utils/sanitize_agent_output.py"
}

is_task_complete() {
	local filtered_output="$1"
	local raw_output="$2"

	if echo "${filtered_output}" | grep -q "__RALPH_PROMISE_COMPLETE__"; then
		return 0
	fi
	if echo "${filtered_output}" | grep -qiE "^[[:space:]]*COMPLETE[[:space:]]*$"; then
		return 0
	fi
	echo "${raw_output}" | grep -qiE "<[Pp][Rr][Oo][Mm][Ii][Ss][Ee]>[[:space:]]*COMPLETE[[:space:]]*</[Pp][Rr][Oo][Mm][Ii][Ss][Ee]>"
}

log_completion() {
	local iteration="$1"
	local max_iterations="$2"

	echo ""
	echo "Ralph completed all tasks!"
	echo "Completed at iteration ${iteration} of ${max_iterations}"
}

# Validate tool choice
if [[ ${TOOL} != "amp" && ${TOOL} != "claude" ]]; then
	echo "Error: Invalid tool '${TOOL}'. Must be 'amp' or 'claude'."
	exit 1
fi
PRD_FILE="${SCRIPT_DIR}/prd.json"
PROGRESS_FILE="${SCRIPT_DIR}/progress.txt"
ARCHIVE_DIR="${SCRIPT_DIR}/archive"
LAST_BRANCH_FILE="${SCRIPT_DIR}/.last-branch"

# Archive previous run if branch changed
if [[ -f ${PRD_FILE} ]] && [[ -f ${LAST_BRANCH_FILE} ]]; then
	CURRENT_BRANCH=$(jq -r '.branchName // empty' "${PRD_FILE}" 2>/dev/null || echo "")
	LAST_BRANCH=$(cat "${LAST_BRANCH_FILE}" 2>/dev/null || echo "")

	if [[ -n ${CURRENT_BRANCH} ]] && [[ -n ${LAST_BRANCH} ]] && [[ ${CURRENT_BRANCH} != "${LAST_BRANCH}" ]]; then
		# Archive the previous run
		DATE=$(date +%Y-%m-%d)
		# Strip "ralph/" prefix from branch name for folder
		FOLDER_NAME=${LAST_BRANCH#ralph/}
		ARCHIVE_FOLDER="${ARCHIVE_DIR}/${DATE}-${FOLDER_NAME}"

		echo "Archiving previous run: ${LAST_BRANCH}"
		mkdir -p "${ARCHIVE_FOLDER}"
		[[ -f ${PRD_FILE} ]] && cp "${PRD_FILE}" "${ARCHIVE_FOLDER}/"
		[[ -f ${PROGRESS_FILE} ]] && cp "${PROGRESS_FILE}" "${ARCHIVE_FOLDER}/"
		echo "   Archived to: ${ARCHIVE_FOLDER}"

		# Reset progress file for new run
		{
			echo "# Ralph Progress Log"
			STARTED_DATE=$(date)
			echo "Started: ${STARTED_DATE}"
			echo "---"
		} >"${PROGRESS_FILE}"
	fi
fi

# Track current branch
if [[ -f ${PRD_FILE} ]]; then
	CURRENT_BRANCH=$(jq -r '.branchName // empty' "${PRD_FILE}" 2>/dev/null || echo "")
	if [[ -n ${CURRENT_BRANCH} ]]; then
		echo "${CURRENT_BRANCH}" >"${LAST_BRANCH_FILE}"
	fi
fi

# Initialize progress file if it doesn't exist
if [[ ! -f ${PROGRESS_FILE} ]]; then
	{
		echo "# Ralph Progress Log"
		STARTED_DATE=$(date)
		echo "Started: ${STARTED_DATE}"
		echo "---"
	} >"${PROGRESS_FILE}"
fi
AMP_PROFILE="${SCRIPT_DIR}/amp-permission-profile.json"
AMP_ARGS=()
if [[ -f ${AMP_PROFILE} ]]; then
	AMP_ARGS+=(--permission-profile "${AMP_PROFILE}")
fi

echo "Starting Ralph - Tool: ${TOOL} - Max iterations: ${MAX_ITERATIONS}"

for i in $(seq 1 "${MAX_ITERATIONS}"); do
	echo ""
	echo "==============================================================="
	echo "  Ralph Iteration ${i} of ${MAX_ITERATIONS} (${TOOL})"
	echo "==============================================================="

	# Run the selected tool with the ralph prompt
	if [[ ${TOOL} == "amp" ]]; then
		OUTPUT=$(amp "${AMP_ARGS[@]}" <"${SCRIPT_DIR}/prompt.md" 2>&1) || true
		FILTERED_OUTPUT="$(filter_agent_output "${OUTPUT}")"
		printf '%s\n' "${FILTERED_OUTPUT}"
	else
		# Claude Code: use --dangerously-skip-permissions for autonomous operation, --print for output
		OUTPUT=$(claude --dangerously-skip-permissions --print <"${SCRIPT_DIR}/CLAUDE.md" 2>&1) || true
		FILTERED_OUTPUT="$(filter_agent_output "${OUTPUT}")"
		printf '%s\n' "${FILTERED_OUTPUT}"
	fi

	# Check for completion signal
	if is_task_complete "${FILTERED_OUTPUT}" "${OUTPUT}"; then
		log_completion "${i}" "${MAX_ITERATIONS}"
		exit 0
	fi

	echo "Iteration ${i} complete. Continuing..."
	sleep 2
done

echo ""
echo "Ralph reached max iterations (${MAX_ITERATIONS}) without completing all tasks."
echo "Check ${PROGRESS_FILE} for status."
exit 1
