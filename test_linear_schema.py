#!/usr/bin/env python3
import json, os
from urllib.request import Request, urlopen

api_key = os.environ.get('LINEAR_API_KEY', '').strip()
headers = {'Content-Type': 'application/json', 'Authorization': api_key}

# Simple query - just get field names
query = '''query { __schema { queryType { fields { name } } } }'''

req = Request('https://api.linear.app/graphql',
    data=json.dumps({'query': query}).encode(), headers=headers, method='POST')
resp = urlopen(req, timeout=15)
data = json.loads(resp.read())

fields = data.get('data', {}).get('__schema', {}).get('queryType', {}).get('fields', [])
for f in fields:
    name = f['name']
    if 'issue' in name.lower() or 'search' in name.lower():
        print(f'  ** {name} **')
    else:
        print(f'  {name}')
