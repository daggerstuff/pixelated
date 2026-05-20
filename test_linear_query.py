#!/usr/bin/env python3
import json, os
from urllib.request import Request, urlopen

api_key = os.environ.get('LINEAR_API_KEY', '').strip()
headers = {
    'Content-Type': 'application/json',
    'Authorization': api_key
}

queries = {
    "1. issueByKey (try PascalCase)": '''query { issueByKey(key: "PIX-500") { id identifier title state { name type } } }''',
    "2. searchIssues": '''query { searchIssues(query: "PIX-500", first: 1) { nodes { id identifier title state { name type } } } }''',
    "3. issues with filter": '''query { issues(filter: { identifier: { eq: "PIX-500" } }) { nodes { id identifier title state { name type } } } }''',
    "4. teams (smoke test)": '''query { teams { nodes { id key name } } }''',
    "5. __schema (introspect)": '''query { __schema { queryType { fields { name } } } }''',
}

for label, query in queries.items():
    print(f"--- {label} ---")
    req = Request(
        'https://api.linear.app/graphql',
        data=json.dumps({'query': query}).encode(),
        headers=headers,
        method='POST'
    )
    try:
        resp = urlopen(req, timeout=15)
        data = json.loads(resp.read())
        errors = data.get('errors')
        if errors:
            for e in errors:
                print(f"  Error: {e.get('message', str(e))}")
                print(f"  Extensions: {json.dumps(e.get('extensions', {}))}")
        else:
            print(f"  Success: {json.dumps(data['data'], indent=2)[:300]}")
    except Exception as e:
        print(f"  Exception: {e}")
    print()
