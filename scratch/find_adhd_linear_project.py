import os
import sys
import json

sys.path.insert(0, "/home/vivi/pixelated")

from scripts.task_sync.provider_bridge import _linear_graphql_query, _extract_graphql_payload
from scripts.task_sync.tri_sync import parse_sync_metadata

# Let's query all issues (first 100) and inspect their metadata for Jira key
query = """
query {
  issues(first: 100) {
    nodes {
      id
      title
      description
      project {
        id
        name
      }
      team {
        id
        name
      }
    }
  }
}
"""

res = _linear_graphql_query(query)
data = _extract_graphql_payload(res)
issues = data.get("issues", {}).get("nodes", [])

print("Scanning issues for ADHD links...")
found = 0
for issue in issues:
    desc = issue.get("description") or ""
    clean_body, meta = parse_sync_metadata(desc)
    jira_key = meta.get("jira")
    if jira_key and jira_key.startswith("ADHD-"):
        print(f"Issue: {issue['id']} | Title: {issue['title']}")
        print(f"  Jira link: {jira_key}")
        print(f"  Project: {issue['project']}")
        print(f"  Team: {issue['team']}")
        found += 1
        if found >= 5:
            break
if found == 0:
    print("No ADHD linked issues found in the first 100 issues.")
