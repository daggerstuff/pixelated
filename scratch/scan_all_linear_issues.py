import os
import sys
import json

sys.path.insert(0, "/home/vivi/pixelated")

from scripts.task_sync.provider_bridge import export_linear_issues
from scripts.task_sync.tri_sync import parse_sync_metadata

print("Fetching all Linear issues...")
os.environ["LINEAR_TEAM_ID"] = "52861523-9089-49a3-8be5-4032d68cb55a"
linear_issues = export_linear_issues()
print(f"Fetched {len(linear_issues)} issues.")

adhd_issues = []
for issue in linear_issues:
    desc = issue.get("description") or ""
    clean, meta = parse_sync_metadata(desc)
    jira_key = meta.get("jira")
    if jira_key and jira_key.startswith("ADHD-"):
        adhd_issues.append((issue, jira_key))

print(f"Found {len(adhd_issues)} Linear issues linked to ADHD.")
# Group by project to see if they belong to any specific projects
project_counts = {}
for issue, jira_key in adhd_issues:
    p = issue.get("project")
    p_name = p.get("name") if p else "None"
    project_counts[p_name] = project_counts.get(p_name, 0) + 1

print("\nGrouping by Linear project name:")
for name, count in sorted(project_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {name}: {count}")

# Print first 5 ADHD linked issues
print("\nFirst 5 ADHD linked issues:")
for issue, jira_key in adhd_issues[:5]:
    p = issue.get("project")
    p_name = p.get("name") if p else "None"
    print(f"  ID: {issue['id']} | Title: {issue['title']} | Jira: {jira_key} | Project: {p_name}")
