#!/usr/bin/env python3
"""Cross-reference beads issues against Linear to find status discrepancies."""
import json, os, re, sys
from urllib.request import Request, urlopen

api_key = os.environ.get('LINEAR_API_KEY', '').strip()

# Collect all open/in_progress beads issues with Linear refs
linear_issues = []
with open('.beads/issues.jsonl') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        issue = json.loads(line)
        status = issue.get('status', '')
        if status not in ('open', 'in_progress'):
            continue
        ext_ref = issue.get('external_ref', '')
        if 'linear.app' in str(ext_ref):
            match = re.search(r'/issue/([A-Z]+-\d+)', ext_ref)
            if match:
                linear_issues.append({
                    'beads_id': issue.get('id'),
                    'beads_status': status,
                    'linear_key': match.group(1),
                    'title': issue.get('title', '')[:100]
                })

print(f"Found {len(linear_issues)} open/in_progress beads issues with Linear refs")
print()

if not linear_issues:
    sys.exit(0)

headers = {
    'Content-Type': 'application/json',
    'Authorization': api_key
}

discrepancies = []
not_found = []
total = len(linear_issues)

for i, item in enumerate(linear_issues, 1):
    key = item['linear_key']
    # Use issue(id:) which is the non-deprecated Linear GraphQL query for fetching by identifier
    query = '''query($id: String!) {
  issue(id: $id) {
    id
    identifier
    title
    state { id name type }
    updatedAt
  }
}'''

    req = Request(
        'https://api.linear.app/graphql',
        data=json.dumps({'query': query, 'variables': {'id': key}}).encode(),
        headers=headers,
        method='POST'
    )
    try:
        resp = urlopen(req, timeout=15)
        data = json.loads(resp.read())
        errors = data.get('errors')
        if errors:
            not_found.append({'key': key, 'errors': errors})
            if i % 25 == 0 or i == total:
                print(f"  Progress: {i}/{total} (not found: {len(not_found)})", file=sys.stderr)
            continue

        linear_issue = data.get('data', {}).get('issue')
        beads_status = item['beads_status']

        if linear_issue:
            linear_state = linear_issue.get('state', {})
            linear_state_name = linear_state.get('name', 'unknown')
            linear_state_type = linear_state.get('type', 'unknown')

            # Map Linear state type to beads status convention
            if linear_state_type == 'started':
                expected_beads = 'in_progress'
            elif linear_state_type in ('unstarted', 'backlog', 'triage'):
                expected_beads = 'open'
            elif linear_state_type in ('completed', 'canceled'):
                expected_beads = 'closed'
            else:
                expected_beads = 'unknown'

            if beads_status != expected_beads:
                discrepancies.append({
                    'key': key,
                    'title': item['title'],
                    'beads_status': beads_status,
                    'linear_state': linear_state_name,
                    'linear_type': linear_state_type,
                    'expected_beads': expected_beads
                })
        else:
            not_found.append({'key': key, 'errors': [{'message': 'Issue not found'}]})
    except Exception as e:
        not_found.append({'key': key, 'error': str(e)})

    if i % 25 == 0 or i == total:
        print(f"  Progress: {i}/{total}", file=sys.stderr)

print()
print("=== RESULTS ===")
print(f"Total beads issues checked: {total}")
print(f"Discrepancies found: {len(discrepancies)}")
print(f"Not found/errors: {len(not_found)}")
print()

if discrepancies:
    print(f"{'Key':<15} {'Beads Status':<18} {'→ Expected':<18} {'Linear State':<25} {'Title'}")
    print("-" * 120)
    for d in discrepancies:
        print(f"{d['key']:<15} {d['beads_status']:<18} {d['expected_beads']:<18} {d['linear_state']:<25} {d['title'][:50]}")
    
    print()
    print("SUMMARY BY CATEGORY:")
    cat = {}
    for d in discrepancies:
        key = f"{d['beads_status']} → {d['expected_beads']}"
        cat[key] = cat.get(key, 0) + 1
    for change, count in sorted(cat.items(), key=lambda x: -x[1]):
        print(f"  {change}: {count} issues")

if not_found:
    print(f"\nNOT FOUND ({len(not_found)}):")
    # Show a few samples
    for nf in not_found[:5]:
        err_msg = nf.get('errors', nf.get('error', 'unknown'))
        if isinstance(err_msg, list):
            err_msg = '; '.join(e.get('message', str(e)) for e in err_msg)
        print(f"  {nf['key']}: {err_msg}")
    if len(not_found) > 5:
        print(f"  ... and {len(not_found) - 5} more")
