import datetime
import json
import os
import sqlite3
import uuid

db_path = os.path.expanduser("~/.9router/db/data.sqlite")
conn = sqlite3.connect(db_path)
cur = conn.cursor()


def add_provider(provider_id, api_key, name=None):
    if not name:
        name = provider_id.capitalize()

    cur.execute("SELECT id FROM providerConnections WHERE provider = ?", (provider_id,))
    if cur.fetchone():
        print(f"Provider {provider_id} already exists.")
        return

    now = datetime.datetime.utcnow().isoformat() + "Z"
    data = json.dumps({"apiKey": api_key})

    cur.execute(
        """
    INSERT INTO providerConnections (id, provider, authType, name, priority, isActive, data, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (str(uuid.uuid4()), provider_id, "apiKey", name, 1, 1, data, now, now),
    )
    print(f"Added provider: {name}")


# Populate keys dict from secure source before running.
# keys = {}

conn.commit()
conn.close()
