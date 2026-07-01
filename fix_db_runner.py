with open("hackathon/db_runner.py") as f:
    content = f.read()

content = content.replace(
    "from hackathon.db_pipeline import build_event_context, record_thread_in_db, get_events_for_month",
    "from hackathon.db_pipeline import build_event_context, record_thread_in_db, get_events_for_month, SessionLocal",
)

# Update generate_month
old_gen = """def generate_month(month: str):
    print(f"Generating for {month}...")
    ollama_url = os.environ.get("OLLAMA_URL")
    dry_run = not bool(ollama_url)
    if dry_run:
        print("Warning: OLLAMA_URL not set. Running in dry-run mode.")

    event_ids = get_events_for_month(month)
    anti_slop = load_anti_slop()

    for event_id in event_ids:
        pre_flight_context = build_event_context(event_id)
        if not pre_flight_context:
            continue

        space_name = determine_space(pre_flight_context)
        context = build_event_context(event_id, target_space=space_name)"""

new_gen = """def generate_month(month: str):
    print(f"Generating for {month}...")
    ollama_url = os.environ.get("OLLAMA_URL")
    dry_run = not bool(ollama_url)
    if dry_run:
        print("Warning: OLLAMA_URL not set. Running in dry-run mode.")

    session = SessionLocal()
    try:
        event_ids = get_events_for_month(month, session=session)
        anti_slop = load_anti_slop()

        for event_id in event_ids:
            pre_flight_context = build_event_context(event_id, session=session)
            if not pre_flight_context:
                continue

            space_name = determine_space(pre_flight_context)
            context = build_event_context(event_id, target_space=space_name, session=session)"""

content = content.replace(old_gen, new_gen)

content = content.replace(
    "record_thread_in_db(space_name, context['date'], f\"Discussion on: {context['title']}\", messages, event_id=event_id)",
    "record_thread_in_db(space_name, context['date'], f\"Discussion on: {context['title']}\", messages, event_id=event_id, session=session)",
)

content = content.replace(
    "record_thread_in_db(space_name, context['date'], context['title'], messages, event_id=event_id)",
    "record_thread_in_db(space_name, context['date'], context['title'], messages, event_id=event_id, session=session)",
)

content = content.replace(
    '    print("Month generation complete.")',
    '    print("Month generation complete.")\n    finally:\n        session.close()',
)

with open("hackathon/db_runner.py", "w") as f:
    f.write(content)
