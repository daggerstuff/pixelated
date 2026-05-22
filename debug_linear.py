#!/usr/bin/env python3
import json
import os
from urllib.request import Request, urlopen

key = os.environ.get("LINEAR_API_KEY", "").strip()
print(f"Key length: {len(key)}")
print(f"Key prefix: {key[:20]}...")
print(f"Key suffix: ...{key[-10:]}")
print(f"Contains spaces: {' ' in key}")
print(f"Contains newlines: {'\\n' in key}")

# Try Linear API with correct auth
query = "query { viewer { id name email } }"
headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}

req = Request(
    "https://api.linear.app/graphql", data=json.dumps({"query": query}).encode(), headers=headers, method="POST"
)

try:
    resp = urlopen(req, timeout=15)
    data = json.loads(resp.read())
    print(f"\nResponse: {json.dumps(data, indent=2)}")
    viewer = data.get("data", {}).get("viewer")
    if viewer:
        print(f"\nConnected as: {viewer.get('name')} ({viewer.get('email')})")
    else:
        errors = data.get("errors")
        if errors:
            print(f"\nErrors: {json.dumps(errors, indent=2)}")
except Exception as e:
    print(f"\nException: {e}")
    if hasattr(e, "read"):
        body = e.read().decode("utf-8", errors="replace")
        print(f"Response body: {body[:500]}")
