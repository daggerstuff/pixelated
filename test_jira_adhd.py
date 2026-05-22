import os
import sys

# Import provider bridge or task_sync jira helper
sys.path.insert(0, os.getcwd())
os.environ["JIRA_PROJECT_KEY"] = "ADHD"

from scripts.task_sync.provider_bridge import export_jira_issues

try:
    print("Exporting Jira issues for project ADHD...")
    issues = export_jira_issues()
    print(f"Successfully retrieved {len(issues)} issues from Jira project ADHD.")

    # Let's inspect the first 5 issues
    for issue in issues[:5]:
        fields = issue.get("fields", {})
        print(f"Key: {issue.get('key')}")
        print(f"Title: {fields.get('summary')}")
        print(f"Status: {fields.get('status', {}).get('name')}")
        desc = fields.get("description")
        if desc:
            # description might be ADF or string
            print(f"Description (first 100 chars): {str(desc)[:100]}")
        print("-" * 50)
except Exception:
    import traceback

    traceback.print_exc()
