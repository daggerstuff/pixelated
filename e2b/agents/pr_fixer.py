import re
import os
import logging
from typing import Optional, Any
from openai import OpenAI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PRFixerAgent:
    """
    An intelligent agent that uses LLMs to generate code fixes based on PR comments.
    """

    def __init__(self, model: str | None = None):
        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.base_url = os.environ.get("OPENAI_BASE_URL")

        if not self.api_key:
            logger.warning("OPENAI_API_KEY not found. Agent will fail to semantic fix.")

        # Prioritize: Arg > NVIDIA_OPENAI_MODEL > OPENAI_MODEL > fallback
        self.model = model or os.getenv("NVIDIA_OPENAI_MODEL") or os.getenv("OPENAI_MODEL")

        # Smart fallback based on endpoint
        if not self.model:
            if self.base_url and "nvidia" in self.base_url:
                self.model = "meta/llama-3.1-405b-instruct"
            else:
                self.model = "gpt-4o"

        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url) if self.api_key else None

    def fix(
        self, file_path: str, file_content: str, issue_description: str
    ) -> tuple[Optional[str], dict[str, Any]]:
        """
        Generates a fixed version of the file content based on the issue description.

        Args:
            file_path: The path to the file being fixed (for context).
            file_content: The original content of the file.
            issue_description: The instruction or comment describing what needs to be fixed.

        Returns:
            A tuple of (fixed_content, usage_stats).
            fixed_content is None if the fix failed.
            usage_stats is a dict containing token usage info.
        """
        if not self.client:
            logger.error("Cannot fix: OpenAI client not initialized.")
            return None, {}

        logger.info(f"Agent reasoning on {file_path} with instruction: {issue_description}")

        system_prompt = f"""You are an elite Software Engineer Agent tasked with fixing code in a PR.
Your goal is to analyzing the request, reason about the fix, and then return the COMPLETE, CORRECTED file content.

## Constitutional Rules (SAFETY FIRST)
1. **NO DESTRUCTIVE EDITS**: Do NOT remove unrelated code or comments. Only modify what is necessary.
2. **NO HALLUCINATIONS**: Do NOT invent new imports or functions unless explicitly asked.
3. **SECURITY**: Do NOT introduce secrets or disable security checks.
4. **SYNTAX**: The output code MUST be syntactically correct Python/JS/TS (based on file extension).

## Output Format
You MUST provide your response in the following strict XML format:

<thinking>
1. Analyze the Issue: ...
2. Audit the File: ...
3. Plan the Fix: ...
</thinking>

<code>
[PUT THE COMPLETE FIXED FILE CONTENT HERE - NO MARKDOWN BACKTICKS]
</code>

## Context
File: {file_path}
"""

        examples_prompt = """
## Examples

### Example 1: Good Fix
User: Fix the typo in the logger.
Input File: `logger.info("Staring process")`
Output:
<thinking>
1. Issue: Typo "Staring" -> "Starting".
2. Location: Line 1.
3. Plan: Correct the string literal.
</thinking>
<code>
logger.info("Starting process")
</code>

### Example 2: Bad Fix (Avoid this)
User: Remove the print statement.
Input File:
def foo():
    print("debugging")
    return True
Output:
<code>
def foo():
    return True
</code>
(FAIL: Missing <thinking> block and context analysis)
"""

        user_prompt = f"""
## Task
Original File Content:
```
{file_content}
```

Instruction/Issue:
{issue_description}

Please provide the fixed file content following the XML format.
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt + examples_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,  # Near-deterministic
            )

            raw_content = response.choices[0].message.content
            usage = response.usage

            stats = {
                "prompt_tokens": usage.prompt_tokens,
                "completion_tokens": usage.completion_tokens,
                "total_tokens": usage.total_tokens,
            }

            # Simple XML Parsing
            code_match = re.search(r"<code>(.*?)</code>", raw_content, re.DOTALL)

            if code_match:
                return code_match.group(1).strip(), stats

            logger.warning(
                f"Agent output malformed (missing <code> tags). Raw: {raw_content[:200]}..."
            )
            return None, stats

        except Exception as e:
            logger.error(f"Agent failed to generate fix: {e}")
            return None, {"error": str(e)}
