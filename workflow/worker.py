#!/usr/bin/env python3
"""
Double-blind labeling workflow for Phase 1.3 annotation.

Features:
- Load sample annotations from JSON.
- Assign each annotation to two random annotators (opaque IDs).
- Store annotations with primary label, secondary tags, justification.
- Flag safety-trigger annotations for senior review.
- Compute a mock Cohen's Kappa on a built-in validation set.
- Write audit logs to log/audit.log.
- Use SQLite (state.db) for persistent state.
"""

import json
import sqlite3
import os
import random
import string
import datetime
import subprocess
from collections import defaultdict

# --------------------------- Paths ---------------------------
CONFIG_PATH = "/home/vivi/pixelated/workflow/config.yaml"
SAMPLE_DATA_PATH = "/home/vivi/pixelated/workflow/sample_data/annotations.json"
DB_PATH = "/home/vivi/pixelated/workflow/state.db"
LOG_PATH = "/home/vivi/pixelated/workflow/log/audit.log"

# --------------------------- Safety Triggers ---------------------------
SAFETY_TRIGGERS = {"suicidal", "self-harm", "harm to others", "weapon", "plan"}

# --------------------------- Logging ---------------------------
def log_event(event_id: str, message: str):
    timestamp = datetime.datetime.utcnow().isoformat()
    entry = json.dumps({"event_id": event_id, "timestamp": timestamp, "message": message})
    with open(LOG_PATH, "a") as f:
        f.write(entry + "\n")

# --------------------------- Opaque IDs ---------------------------
def generate_opaque_id(length: int = 8) -> str:
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(random.choice(alphabet) for _ in range(length))

# --------------------------- Schema Setup ---------------------------
CREATE_SCHEMA = """
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    primary_label TEXT NOT NULL,
    secondary_tags TEXT,
    justification TEXT,
    annotator_a TEXT NOT NULL,
    annotator_b TEXT NOT NULL,
    safety_flag BOOLEAN NOT NULL,
    reviewed_by_senior BOOLEAN DEFAULT 0
);
CREATE TABLE IF NOT EXISTS annotators (
    opaque_id TEXT PRIMARY KEY,
    real_name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kappa_metrics (
    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    kappa REAL NOT NULL
);
COMMIT;
"""

INSERT_ANNOTATOR = "INSERT OR IGNORE INTO annotators (opaque_id, real_name) VALUES (?,?);"
INSERT_ANNOTATION = """
INSERT OR REPLACE INTO annotations (
    id, text, primary_label, secondary_tags,
    justification, annotator_a, annotator_b, safety_flag
) VALUES (?,?,?,?,?,?,?,?);
"""
INSERT_KAPPA = """
INSERT OR REPLACE INTO kappa_metrics (timestamp, kappa)
VALUES (?,?);
"""

# --------------------------- Sample Data ---------------------------
def load_sample_data() -> list:
    with open(SAMPLE_DATA_PATH, "r") as f:
        return json.load(f)

def contains_safety_trigger(text: str) -> bool:
    lowered = text.lower()
    return any(kw in lowered for kw in SAFETY_TRIGGERS)

# --------------------------- DB Operations ---------------------------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(CREATE_SCHEMA)
    conn.commit()
    log_event("db_init", "SQLite schema ensured")
    conn.close()

def register_annotator(real_name: str) -> str:
    opaque = generate_opaque_id()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(INSERT_ANNOTATOR, (opaque, real_name))
    conn.commit()
    log_event("annotator_register", f"{opaque} – {real_name}")
    conn.close()
    return opaque

def get_random_annotator_pair():
    """Return two distinct opaque IDs; create them if not enough yet."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT opaque_id FROM annotators")
    existing = [row[0] for row in cur.fetchall()]
    while len(existing) < 2:
        new_id = generate_opaque_id()
        conn.execute(INSERT_ANNOTATOR, (new_id, f"Annot-{new_id}"))
        conn.commit()
        existing.append(new_id)
    pair = random.sample(existing, 2)
    conn.close()
    return pair

def store_annotation(item: dict, a1: str, a2: str, safety_flag: bool):
    """Persist a single annotation record."""
    secondary_tags_json = json.dumps(item.get("secondary_tags", []))
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        INSERT_ANNOTATION,
        (
            item["id"],
            item["text"],
            item.get("primary_label", "Unlabeled"),
            secondary_tags_json,
            "Placeholder justification",
            a1,
            a2,
            int(safety_flag),
        ),
    )
    conn.commit()
    log_event("annotation_store", f"id={item['id']} safety={safety_flag}")
    conn.close()

# --------------------------- Validation & Kappa ---------------------------
def compute_kappa_on_validation():
    """Return a mock Kappa value (e.g., 0.85) to indicate alignment."""
    return 0.85

def store_kappa(kappa: float):
    ts = datetime.datetime.utcnow().isoformat()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(INSERT_KAPPA, (ts, kappa))
    conn.commit()
    log_event("kappa_update", f"Kappa={kappa:.3f}")

# --------------------------- Safety Flagging ---------------------------
def flag_safety_triggers():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, text FROM annotations WHERE safety_flag=0")
    rows = cur.fetchall()
    for uid, txt in rows:
        if contains_safety_trigger(txt):
            cur.execute("UPDATE annotations SET safety_flag=1 WHERE id=?", (uid,))
            log_event("safety_flag", f"Item {uid} flagged for senior review")
    conn.commit()
    conn.close()

# --------------------------- Main Workflow ---------------------------
def main():
    # 1. Load sample data
    samples = load_sample_data()
    log_event("import_sample_data", f"Loaded {len(samples)} items")

    # 2. Ensure DB & annotators exist
    init_db()
    for i in range(5):
        register_annotator(f"Prof-{i+1}")

    # 3. Assign each sample to two random annotators
    pairs = [get_random_annotator_pair() for _ in range(len(samples))]
    for idx, item in enumerate(samples):
        a1, a2 = pairs[idx]
        safety = contains_safety_trigger(item.get("text", ""))
        store_annotation(item, a1, a2, safety)
        if safety:
            flag_safety_triggers()

    # 4. Compute mock Kappa on validation slice
    if len(samples) > 0:
        kappa = compute_kappa_on_validation()
        store_kappa(kappa)
        log_event("workflow_complete", f"Workflow finished; Kappa={kappa:.3f}")

# --------------------------- Entry Point ---------------------------
if __name__ == "__main__":
    main()