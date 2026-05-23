import os
import sys
import json

sys.path.insert(0, "/home/vivi/pixelated")

from scripts.task_sync.provider_bridge import _linear_graphql_query, _extract_graphql_payload

# Find teams
teams_query = """
query {
  teams {
    nodes {
      id
      name
      key
    }
  }
}
"""

print("=== TEAMS ===")
res = _linear_graphql_query(teams_query)
data = _extract_graphql_payload(res)
teams = data.get("teams", {}).get("nodes", [])
for team in teams:
    print(f"Team ID: {team['id']} | Name: {team['name']} | Key: {team['key']}")

# Find projects
projects_query = """
query {
  projects {
    nodes {
      id
      name
      teams {
        nodes {
          id
          name
        }
      }
    }
  }
}
"""

print("\n=== PROJECTS ===")
res = _linear_graphql_query(projects_query)
data = _extract_graphql_payload(res)
projects = data.get("projects", {}).get("nodes", [])
for project in projects:
    team_names = [t["name"] for t in project.get("teams", {}).get("nodes", [])]
    print(f"Project ID: {project['id']} | Name: {project['name']} | Teams: {team_names}")
