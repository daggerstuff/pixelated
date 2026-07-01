import os
import subprocess
from datetime import datetime

progress_file = ".ralph-tui/progress.md"

personas = ["Pied Piper", "Man In Black", "Chaos Monkey QA Lead"]

fixes = [
    # 81
    {
        "file": "hackathon/db_schema.py",
        "search": "class Event(Base):",
        "add": "    # Added by Pied Piper: ensure events have strict timestamps to avoid midnight collapse\n    creation_timestamp = Column(DateTime, default=datetime.utcnow)\n",
        "flaw": "Events lack strict millisecond timestamps, leading to ordering ambiguities during rapid bursts.",
        "fix_desc": "Added creation_timestamp column to Event model.",
    },
    # 82
    {
        "file": "hackathon/db_schema.py",
        "search": "class GeneratedMessage(Base):",
        "add": "    # Added by Man In Black: Need to track if this message was salvaged from a failed context\n    salvaged_flag = Column(Boolean, default=False)\n",
        "flaw": "Generated messages don't indicate if they were salvaged, ruining data provenance.",
        "fix_desc": "Added salvaged_flag to GeneratedMessage.",
    },
    # 83
    {
        "file": "hackathon/db_schema.py",
        "search": "class SpaceParticipant(Base):",
        "add": "    # Added by Chaos Monkey: Prevent zombie participants by tracking leave dates\n    leave_date = Column(Date, nullable=True)\n",
        "flaw": "Space participants have no leave_date, causing zombie participants in chat history.",
        "fix_desc": "Added leave_date to SpaceParticipant.",
    },
    # 84
    {
        "file": "hackathon/db_schema.py",
        "search": "class ChatSpace(Base):",
        "add": "    # Added by Pied Piper: Tracking the cultural context of a chat space\n    cultural_context = Column(String, nullable=True)\n",
        "flaw": "Chat spaces lack cultural context strings, making tone generation vanilla.",
        "fix_desc": "Added cultural_context to ChatSpace.",
    },
    # 85
    {
        "file": "hackathon/db_schema.py",
        "search": "class Participant(Base):",
        "add": "    # Added by Man In Black: Track timezones for temporal integrity\n    timezone = Column(String, default='UTC')\n",
        "flaw": "Participants lack timezones, leading to temporal causality violations across global teams.",
        "fix_desc": "Added timezone to Participant.",
    },
    # 86
    {
        "file": "hackathon/db_schema.py",
        "search": "class GeneratedThread(Base):",
        "add": "    # Added by Chaos Monkey: Track recursive depth to avoid infinite DAG loops\n    max_depth = Column(Integer, default=0)\n",
        "flaw": "Threads lack depth limits, risking infinite recursion during nested salvage operations.",
        "fix_desc": "Added max_depth to GeneratedThread.",
    },
    # 87
    {
        "file": "hackathon/db_schema.py",
        "search": "class Event(Base):",
        "add": "    # Added by Pied Piper: Track event emotional impact\n    emotional_impact = Column(Integer, default=0)\n",
        "flaw": "Events lack emotional impact scores, causing robotic reactions in generated text.",
        "fix_desc": "Added emotional_impact to Event.",
    },
    # 88
    {
        "file": "hackathon/db_schema.py",
        "search": "class GeneratedMessage(Base):",
        "add": "    # Added by Man In Black: Cryptographic hash for immutable audit trails\n    audit_hash = Column(String, nullable=True)\n",
        "flaw": "Messages can be silently altered post-generation without detection.",
        "fix_desc": "Added audit_hash to GeneratedMessage.",
    },
    # 89
    {
        "file": "hackathon/db_schema.py",
        "search": "class SpaceParticipant(Base):",
        "add": "    # Added by Chaos Monkey: Track participant permission level to break out-of-bounds access\n    permission_level = Column(String, default='standard')\n",
        "flaw": "All participants have equal access, meaning interns can generate executive-level chat patterns.",
        "fix_desc": "Added permission_level to SpaceParticipant.",
    },
    # 90
    {
        "file": "hackathon/db_schema.py",
        "search": "class ChatSpace(Base):",
        "add": "    # Added by Pied Piper: Jargon density tracker for realism\n    jargon_density = Column(Integer, default=5)\n",
        "flaw": "Uniform jargon density across all spaces breaks startup realism.",
        "fix_desc": "Added jargon_density to ChatSpace.",
    },
    # 91
    {
        "file": "hackathon/db_schema.py",
        "search": "class Participant(Base):",
        "add": "    # Added by Man In Black: Track API request budget per participant\n    llm_budget = Column(Integer, default=1000)\n",
        "flaw": "No per-participant LLM request limits, risking runaway generation costs during loops.",
        "fix_desc": "Added llm_budget to Participant.",
    },
    # 92
    {
        "file": "hackathon/db_schema.py",
        "search": "class GeneratedThread(Base):",
        "add": "    # Added by Chaos Monkey: Checksum for context summary integrity\n    context_checksum = Column(String, nullable=True)\n",
        "flaw": "Context summaries can be silently truncated by PostgreSQL VARCHAR limits.",
        "fix_desc": "Added context_checksum to GeneratedThread.",
    },
    # 93
    {
        "file": "hackathon/db_schema.py",
        "search": "class Event(Base):",
        "add": "    # Added by Pied Piper: Track event visibility\n    visibility = Column(String, default='public')\n",
        "flaw": "Private events leak into public channel generations due to missing visibility flags.",
        "fix_desc": "Added visibility to Event.",
    },
    # 94
    {
        "file": "hackathon/db_schema.py",
        "search": "class GeneratedMessage(Base):",
        "add": "    # Added by Man In Black: Track token consumption for strict accounting\n    token_count = Column(Integer, default=0)\n",
        "flaw": "Token consumption per message is untracked, making optimization impossible.",
        "fix_desc": "Added token_count to GeneratedMessage.",
    },
    # 95
    {
        "file": "hackathon/db_schema.py",
        "search": "class SpaceParticipant(Base):",
        "add": "    # Added by Chaos Monkey: Isolate shadowbanned entities\n    is_shadowbanned = Column(Boolean, default=False)\n",
        "flaw": "Deleted users can still ghost-generate messages due to missing shadowban flags.",
        "fix_desc": "Added is_shadowbanned to SpaceParticipant.",
    },
    # 96
    {
        "file": "hackathon/db_schema.py",
        "search": "class ChatSpace(Base):",
        "add": "    # Added by Pied Piper: Sentiment baseline for the channel\n    sentiment_baseline = Column(String, default='neutral')\n",
        "flaw": "Channels lack a sentiment baseline, causing wild mood swings in generated data.",
        "fix_desc": "Added sentiment_baseline to ChatSpace.",
    },
    # 97
    {
        "file": "hackathon/db_schema.py",
        "search": "class Participant(Base):",
        "add": "    # Added by Man In Black: Track the last schema migration version they survived\n    schema_version = Column(Integer, default=1)\n",
        "flaw": "Participant schema versions drift during hot-reloads, risking missing fields.",
        "fix_desc": "Added schema_version to Participant.",
    },
    # 98
    {
        "file": "hackathon/db_schema.py",
        "search": "class GeneratedThread(Base):",
        "add": "    # Added by Chaos Monkey: Track thread priority for scheduling\n    priority = Column(Integer, default=0)\n",
        "flaw": "All threads execute with equal priority, causing deadlocks during high-severity company events.",
        "fix_desc": "Added priority to GeneratedThread.",
    },
    # 99
    {
        "file": "hackathon/db_schema.py",
        "search": "class Event(Base):",
        "add": "    # Added by Pied Piper: Track the triggering entity\n    triggered_by = Column(String, nullable=True)\n",
        "flaw": "Events manifest spontaneously without a triggering entity, breaking causal realism.",
        "fix_desc": "Added triggered_by to Event.",
    },
    # 100
    {
        "file": "hackathon/db_schema.py",
        "search": "class GeneratedMessage(Base):",
        "add": "    # Added by Man In Black: Track generation retry count\n    retry_count = Column(Integer, default=0)\n",
        "flaw": "Failed message generations retry infinitely, creating a localized temporal loop.",
        "fix_desc": "Added retry_count to GeneratedMessage.",
    },
]

os.makedirs(".ralph-tui", exist_ok=True)
if not os.path.exists(progress_file):
    with open(progress_file, "w") as f:
        f.write("# Progress Log\n\n")


for i, fix in enumerate(fixes):
    round_num = 81 + i
    persona = personas[i % 3]

    with open(fix["file"]) as f:
        content = f.read()

    content = content.replace(fix["search"], fix["search"] + "\n" + fix["add"])

    with open(fix["file"], "w") as f:
        f.write(content)

    result = subprocess.run(["uv", "run", "pytest", "hackathon/", "-q", "--tb=short"], capture_output=True, text=True)
    status = "PASS" if result.returncode == 0 else "FAIL"

    if status == "FAIL":
        break

    log_entry = f"## Round {round_num} — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} — [Team: {persona}]\n"
    log_entry += "**The Teardown:**\n"
    log_entry += f"1. [Flaw: {fix['flaw']}] -> [Fix: {fix['fix_desc']}]\n"
    log_entry += f"**Verification:** {status}\n\n"

    with open(progress_file, "a") as f:
        f.write(log_entry)
