#!/usr/bin/env bash
# A git commit-msg hook that uses the Eve Advisor Agent as an intelligent gate.
# Put this in .git/hooks/commit-msg and make it executable (chmod +x)

# 1. Grab the user's intent from the commit message
COMMIT_MSG_FILE=$1
INTENT=$(cat "$COMMIT_MSG_FILE")

# 2. Grab the actual staged code changes
DIFF=$(git diff --cached --no-color)

if [ -z "$DIFF" ]; then
  exit 0 # Nothing to review
fi

echo "🧠 Advisor Agent is reviewing your changes against your intent..."

# 3. Construct the prompt for the Advisor Agent
PROMPT="
You are acting as an intelligent pre-commit hook. 
The developer is trying to commit code. 

**Their stated intent (Commit Message):**
$INTENT

**The Code Changes (Git Diff):**
$DIFF

**Your Task:**
Review the code changes specifically against their stated intent.
- Does the code actually do what they claim?
- Did they miss a critical opportunity or edge case based on that intent?
- Did they introduce a bug?

If the commit is fundamentally flawed, misses the intent, or introduces a critical bug, reply starting with EXACTLY the word 'STOP_COMMIT', followed by a punchy, direct explanation (e.g., 'You just fucked up big right there. You claimed to add billing, but you forgot to handle failed webhooks.').

If it looks solid, reply starting with EXACTLY the word 'PROCEED', followed by a brief encouraging remark or a minor non-blocking nitpick.
"

# 4. Escape the prompt for JSON
JSON_PAYLOAD=$(jq -n --arg content "$PROMPT" '{"messages":[{"role":"user","content":$content}]}')

# 5. Send to the locally running Advisor Agent (assumes it's running on port 3000)
# We hit the /eve/v1/session/pre-commit-review endpoint
RESPONSE=$(curl -s -X POST http://localhost:3000/eve/v1/session/pre-commit-review \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

# Extract the agent's reply from the Eve framework response format
# Eve returns server-sent events or a specific JSON structure depending on the channel config.
# If using the standard REST channel, we can parse the text. For simplicity in bash, we'll use a basic jq parse.
REPLY=$(echo "$RESPONSE" | jq -r '.messages[-1].content // .text // "PROCEED"')

# 6. Evaluate the decision
if [[ "$REPLY" == STOP_COMMIT* ]]; then
  echo -e "\n🛑 \033[0;31mADVISOR AGENT BLOCKED THE COMMIT\033[0m"
  # Print everything after 'STOP_COMMIT'
  echo "$REPLY" | sed 's/^STOP_COMMIT//'
  echo -e "\nFix your code or intent, then try committing again."
  exit 1
else
  echo -e "\n✅ \033[0;32mADVISOR AGENT APPROVED\033[0m"
  echo "$REPLY" | sed 's/^PROCEED//'
  exit 0
fi
