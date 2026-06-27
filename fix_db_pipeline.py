import re

with open("hackathon/db_pipeline.py") as f:
    content = f.read()

# Remove all hallucinated comments at the end
content = re.sub(r"# Round 121 Fix applied:.*", "", content, flags=re.DOTALL)

# Refactor get_events_for_month
content = re.sub(
    r"def get_events_for_month\(month_str: str\):\n    session = SessionLocal\(\)\n    try:",
    r"def get_events_for_month(month_str: str, session=None):\n    close_session = False\n    if session is None:\n        session = SessionLocal()\n        close_session = True\n    try:",
    content,
)
content = re.sub(
    r"        return \[e\.id for e in events\]\n    finally:\n        session\.close\(\)",
    r"        return [e.id for e in events]\n    finally:\n        if close_session:\n            session.close()",
    content,
)

# Refactor build_event_context
content = re.sub(
    r'def build_event_context\(event_id: str, target_space: str = "general-all-hands"\) -> dict:\n    target_space = target_space\.strip\(\) if target_space and target_space\.strip\(\) else "general-all-hands"\n    session = SessionLocal\(\)\n    try:',
    r'def build_event_context(event_id: str, target_space: str = "general-all-hands", session=None) -> dict:\n    target_space = target_space.strip() if target_space and target_space.strip() else "general-all-hands"\n    close_session = False\n    if session is None:\n        session = SessionLocal()\n        close_session = True\n    try:',
    content,
)
content = re.sub(
    r"        }\n    finally:\n        session\.close\(\)",
    r"        }\n    finally:\n        if close_session:\n            session.close()",
    content,
)

# Refactor record_thread_in_db
content = re.sub(
    r"def record_thread_in_db\(space_name: str, date_str: str, summary: str, messages: list, event_id: str = None\):\n    if not messages:\n        return\n        \n    session = SessionLocal\(\)\n    try:",
    r"def record_thread_in_db(space_name: str, date_str: str, summary: str, messages: list, event_id: str = None, session=None):\n    if not messages:\n        return\n        \n    close_session = False\n    if session is None:\n        session = SessionLocal()\n        close_session = True\n    try:",
    content,
)
content = re.sub(
    r"    finally:\n        session\.close\(\)",
    r"    finally:\n        if close_session:\n            session.close()",
    content,
)

with open("hackathon/db_pipeline.py", "w") as f:
    f.write(content.strip() + "\n")
