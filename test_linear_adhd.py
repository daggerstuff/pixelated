import os
import sys

sys.path.insert(0, os.getcwd())

from scripts.task_sync.provider_bridge import export_linear_issues, resolve_linear_project_id, resolve_linear_team_id

try:
    print("Linear team ID:", resolve_linear_team_id())
    print("Linear project ID:", resolve_linear_project_id())
    print("Exporting Linear issues...")
    issues = export_linear_issues()
    print(f"Successfully retrieved {len(issues)} issues from Linear.")

    # Let's inspect the first 10 issues
    for issue in issues[:10]:
        print(f"ID: {issue.get('id')}")
        print(f"Title: {issue.get('title')}")
        print(
            f"State: {issue.get('state', {}).get('name') if isinstance(issue.get('state'), dict) else issue.get('state')}"
        )
        print(f"Description (first 100 chars): {str(issue.get('description'))[:100]}")
        print("-" * 50)
except Exception:
    import traceback

    traceback.print_exc()
