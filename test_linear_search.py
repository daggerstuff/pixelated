#!/usr/bin/env python3
import json
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

api_key = os.environ.get("LINEAR_API_KEY", "").strip()
headers = {"Content-Type": "application/json", "Authorization": api_key}

# Check IssueIDComparator type
query1 = """query { __type(name: "IssueIDComparator") { name inputFields { name type { name kind } } } }"""

# Try querying by number + team
query2 = """query {
  issues(filter: { number: { eq: 500 }, team: { id: { eq: "52861523-9089-49a3-8be5-4032d68cb55a" } } }) {
    nodes {
      id
      identifier
      title
      state { id name type }
      updatedAt
    }
  }
}"""

for label, query in [("IssueIDComparator", query1), ("number+team filter", query2)]:
    print(f"--- {label} ---")
    req = Request(
        "https://api.linear.app/graphql", data=json.dumps({"query": query}).encode(), headers=headers, method="POST"
    )
    try:
        resp = urlopen(req, timeout=15)
        data = json.loads(resp.read())
        errors = data.get("errors")
        if errors:
            for e in errors:
                print(f"  Error: {e.get('message', str(e))}")
        else:
            print(f"  OK: {json.dumps(data['data'], indent=2)[:500]}")
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  HTTP {e.code}: {body}")
    print()
