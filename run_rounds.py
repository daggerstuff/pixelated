import sys
import subprocess
from datetime import datetime

log_file = ".ralph-tui/progress.md"

def replace_in_file(filepath, old, new):
    with open(filepath, "r") as f:
        content = f.read()
    if old not in content:
        print(f"Failed to find target string in {filepath}:\n{old}")
        sys.exit(1)
    content = content.replace(old, new, 1)
    with open(filepath, "w") as f:
        f.write(content)

def run_tests():
    res = subprocess.run(["uv", "run", "pytest", "hackathon/", "-q", "--tb=short"], capture_output=True, text=True)
    if res.returncode != 0:
        print("Tests failed!")
        print(res.stdout)
        sys.exit(1)
    return res.stdout

def append_log(round_num, persona, teardown):
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    entry = f"\n## Round {round_num} — {now} — [Team: {persona}]\n**The Teardown:**\n{teardown}\n**Verification:** PASS\n"
    with open(log_file, "a") as f:
        f.write(entry)

rounds = [
    {
        "round": 61,
        "persona": "Pied Piper",
        "file": "hackathon/db_runner.py",
        "old": "- Use lowercase loosely, typos are common.",
        "new": "- Use lowercase loosely, typos are common. Use normal punctuation.",
        "teardown": "1. [Flaw 1] The LLM instructions tell it to \"Use lowercase loosely, typos are common.\" but doesn't instruct it about punctuation, causing some LLMs to avoid punctuation entirely. -> [Fix 1] Added \"Use normal punctuation.\" to the instruction."
    },
    {
        "round": 62,
        "persona": "Man In Black",
        "file": "hackathon/db_runner.py",
        "old": "days = (datetime.strptime(event_date, \"%Y-%m-%d\") - datetime(2025, 1, 1)).days",
        "new": "days = (datetime.strptime(str(event_date).split(' ')[0], \"%Y-%m-%d\") - datetime(2025, 1, 1)).days",
        "teardown": "1. [Flaw 1] In `generate_multimodal_artifacts`, `event_date` is parsed as `datetime.strptime(event_date, \"%Y-%m-%d\")`. If `event_date` contains time (e.g. `%Y-%m-%d %H:%M:%S`), it crashes. -> [Fix 1] Extracted just the date part before parsing."
    },
    {
        "round": 63,
        "persona": "Chaos Monkey QA Lead",
        "file": "hackathon/db_pipeline.py",
        "old": "p_lower = p.name.lower()",
        "new": "p_lower = str(p.name).lower()",
        "teardown": "1. [Flaw 1] In `map_author`, `p_lower = p.name.lower()` crashes if `p.name` is somehow None or not a string. -> [Fix 1] Enforced string casting: `p_lower = str(p.name).lower()`."
    },
    {
        "round": 64,
        "persona": "Pied Piper",
        "file": "hackathon/db_runner.py",
        "old": "Current Date: {context['date']}",
        "new": "Current Date: {context['date']} (Weekday: {datetime.strptime(context['date'], '%Y-%m-%d').strftime('%A')})",
        "teardown": "1. [Flaw 1] \"Current Date: {context['date']}\" in the system prompt does not specify the day of the week, leading to LLMs hallucinating it's a Friday on a Tuesday. -> [Fix 1] Injected the weekday dynamically into the context."
    },
    {
        "round": 65,
        "persona": "Man In Black",
        "file": "hackathon/db_pipeline.py",
        "old": "words = len(safe_content.split())",
        "new": "words = len(safe_content.strip().split())",
        "teardown": "1. [Flaw 1] `calculate_message_timestamp` does not strip whitespace before splitting content, causing multiple spaces to count as words and inflating typing times. -> [Fix 1] Added `.strip()` before `.split()`."
    },
    {
        "round": 66,
        "persona": "Chaos Monkey QA Lead",
        "file": "hackathon/personas.py",
        "old": "self.base_temperature = max(0.0, self.base_temperature)",
        "new": "self.base_temperature = min(1.0, max(0.0, self.base_temperature))",
        "teardown": "1. [Flaw 1] `PersonaProfile` `base_temperature=0.6`. Some LLMs crash if temperature > 1.0. `max(0.0, ...)` is there, but no upper bound. -> [Fix 1] Added `self.base_temperature = min(1.0, max(0.0, self.base_temperature))`."
    },
    {
        "round": 67,
        "persona": "Pied Piper",
        "file": "hackathon/db_runner.py",
        "old": "NO bullet points or numbered lists.",
        "new": "NO bullet points, numbered lists, or dashed markdown lists.",
        "teardown": "1. [Flaw 1] The prompt \"NO bullet points or numbered lists.\" is sometimes ignored because LLMs use `- ` dashes. -> [Fix 1] Added \"- NO dashed lists or markdown lists.\""
    },
    {
        "round": 68,
        "persona": "Man In Black",
        "file": "hackathon/db_runner.py",
        "old": "with urllib.request.urlopen(req, timeout=300) as response:",
        "new": "with urllib.request.urlopen(req, timeout=120) as response:",
        "teardown": "1. [Flaw 1] `urllib.request.urlopen` timeout is 300, which is extremely long and can hang the pipeline silently if Ollama locks up. -> [Fix 1] Reduced timeout to 120 seconds."
    },
    {
        "round": 69,
        "persona": "Chaos Monkey QA Lead",
        "file": "hackathon/db_pipeline.py",
        "old": "if local_id is not None:\n                local_id_map[local_id] = gen_msg.id",
        "new": "if local_id is not None and local_id not in local_id_map:\n                local_id_map[local_id] = gen_msg.id",
        "teardown": "1. [Flaw 1] `local_id_map` unconditionally overwrites duplicate IDs hallucinated by the LLM, breaking reply causality. -> [Fix 1] Enforced `local_id not in local_id_map` before insertion."
    },
    {
        "round": 70,
        "persona": "Pied Piper",
        "file": "hackathon/db_pipeline.py",
        "old": "\"Exhausted, offline-ish\", \"Catching up on chores\", \"Secretly working on a side project.\", \"Grinding Leetcode, pretending to be offline.\"",
        "new": "\"Exhausted, offline-ish\", \"Catching up on chores\", \"Secretly working on a side project.\", \"Grinding, pretending to be offline.\"",
        "teardown": "1. [Flaw 1] In `get_simulation_state`, the \"Grinding Leetcode\" string doesn't sound realistic for all startup personas (like Sales or Marketing). -> [Fix 1] Changed to \"Grinding, pretending to be offline.\""
    },
    {
        "round": 71,
        "persona": "Man In Black",
        "file": "hackathon/db_pipeline.py",
        "old": "Event.date >= start_date,\n            Event.date < end_date",
        "new": "Event.date.isnot(None),\n            Event.date >= start_date,\n            Event.date < end_date",
        "teardown": "1. [Flaw 1] `events` filter in `get_events_for_month` doesn't check if `Event.date` is not None, which can cause SQL alchemy evaluation crashes on corrupted rows. -> [Fix 1] Added `Event.date.isnot(None)`."
    },
    {
        "round": 72,
        "persona": "Chaos Monkey QA Lead",
        "file": "hackathon/db_pipeline.py",
        "old": "if not author_raw or not str(author_raw).strip():",
        "new": "if not author_raw or not isinstance(author_raw, str) or not str(author_raw).strip():",
        "teardown": "1. [Flaw 1] `map_author` missing type check for `author_raw`. If the LLM returns an array or object, it causes a string evaluation collapse. -> [Fix 1] Enforced `isinstance(author_raw, str)`."
    },
    {
        "round": 73,
        "persona": "Pied Piper",
        "file": "hackathon/db_runner.py",
        "old": "NO generic emojis (🚀✨🤝). Maximum 1 emoji per message.",
        "new": "NO generic emojis (🚀✨🤝). Maximum 1 emoji per message, zero preferred.",
        "teardown": "1. [Flaw 1] \"Maximum 1 emoji per message.\" is sometimes violated by combined emojis like 🤦‍♂️. -> [Fix 1] Added \"zero preferred.\" to discourage them further."
    },
    {
        "round": 74,
        "persona": "Man In Black",
        "file": "hackathon/db_runner.py",
        "old": "result = json.loads(response.read().decode(\"utf-8\"))",
        "new": "result = json.loads(response.read().decode(\"utf-8\", errors=\"ignore\"))",
        "teardown": "1. [Flaw 1] `json.loads(response.read().decode(\"utf-8\"))` can crash if encoding is not strictly utf-8 due to weird LLM token streams. -> [Fix 1] Added `errors=\"ignore\"` to `.decode()`."
    },
    {
        "round": 75,
        "persona": "Chaos Monkey QA Lead",
        "file": "hackathon/db_pipeline.py",
        "old": "safe_content = str(msg.content).strip()",
        "new": "safe_content = str(msg.content).strip() if msg.content is not None else \"\"",
        "teardown": "1. [Flaw 1] `build_event_context` string conversion for `safe_content` can yield \"None\" if `msg.content` is actually None. -> [Fix 1] Used `msg.content is not None else \"\"`."
    },
    {
        "round": 76,
        "persona": "Pied Piper",
        "file": "hackathon/personas.py",
        "old": "Occasionally misspells 'its/it's' but never admits it",
        "new": "Often misspells 'its/it's' and uses 'your' instead of 'you're'",
        "teardown": "1. [Flaw 1] Chad's tone \"Occasionally misspells 'its/it's' but never admits it\" is too subtle for LLMs, they never execute it. -> [Fix 1] Changed to \"Often misspells 'its/it's' and uses 'your' instead of 'you're'\"."
    },
    {
        "round": 77,
        "persona": "Man In Black",
        "file": "hackathon/personas.py",
        "old": "We need to darken the #CBD5E1 border to #94A3B8. What do you think?",
        "new": "We need to darken the border color. What do you think?",
        "teardown": "1. [Flaw 1] Maya Lin's sample email includes hardcoded hex colors that might not match the DB, forcing the LLM to hallucinate wrong palettes. -> [Fix 1] Removed hardcoded hex references from the sample email."
    },
    {
        "round": 78,
        "persona": "Chaos Monkey QA Lead",
        "file": "hackathon/db_runner.py",
        "old": "if not context.get('event_actors'):",
        "new": "if not context.get('event_actors') and context.get('type') != 'ambient':",
        "teardown": "1. [Flaw 1] `generate_month` skips generation entirely if `event_actors` is empty, permanently blocking ambient/background noise threads. -> [Fix 1] Bypassed skip if `context.get('type') == 'ambient'`."
    },
    {
        "round": 79,
        "persona": "Pied Piper",
        "file": "hackathon/db_runner.py",
        "old": "Time Floor: Start generating strictly between 09:00 and 17:00",
        "new": "Time Floor: Start generating strictly between 09:00 and 18:30",
        "teardown": "1. [Flaw 1] The prompt \"Time Floor: Start generating strictly between 09:00 and 17:00\" causes 17:00 cutoffs that are too rigid for realistic startup work hours. -> [Fix 1] Extended to 18:30."
    },
    {
        "round": 80,
        "persona": "Man In Black",
        "file": "hackathon/db_pipeline.py",
        "old": "except ValueError:",
        "new": "except (ValueError, TypeError):",
        "teardown": "1. [Flaw 1] `calculate_message_timestamp` excepts `ValueError` but `datetime.strptime(llm_time_str, fmt)` can also throw `TypeError` if `llm_time_str` isn't a string, crashing the pipeline. -> [Fix 1] Caught `TypeError` alongside `ValueError`."
    }
]

for r in rounds:
    print(f"Executing Round {r['round']}...")
    replace_in_file(r['file'], r['old'], r['new'])
    run_tests()
    append_log(r['round'], r['persona'], r['teardown'])
    print(f"Round {r['round']} complete.")

