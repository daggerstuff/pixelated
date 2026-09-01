"""Linear GraphQL API Client for Multi-Agent Coordination."""

from __future__ import annotations

import logging
import os
from typing import Any

import requests

from tools.agent_runner.models import LinearComment, LinearIssue, LinearTeam

logger = logging.getLogger("agent_runner.client")

LINEAR_GRAPHQL_ENDPOINT = "https://api.linear.app/graphql"


class LinearClient:
    """Production client communicating with Linear GraphQL API."""

    def __init__(self, api_key: str | None = None):
        self.api_key = os.environ.get("LINEAR_API_KEY", "") if api_key is None else api_key
        if not self.api_key:
            raise ValueError("LINEAR_API_KEY is not set. Provide api_key or set env var.")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": self.api_key,
                "Content-Type": "application/json",
            }
        )
        self._team_cache: dict[str, LinearTeam] = {}
        self._label_cache: dict[str, dict[str, str]] = {}  # team_id -> {label_name -> label_id}

    def execute_gql(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute arbitrary GraphQL query or mutation."""
        payload = {"query": query, "variables": variables or {}}
        resp = self.session.post(LINEAR_GRAPHQL_ENDPOINT, json=payload, timeout=30)
        if resp.status_code != 200:
            raise RuntimeError(f"Linear GraphQL HTTP {resp.status_code}: {resp.text}")

        data = resp.json()
        if "errors" in data:
            raise RuntimeError(f"Linear GraphQL Errors: {data['errors']}")
        return data.get("data", {})

    def resolve_team(self, team_key: str) -> LinearTeam:
        """Fetch team ID and state mapping by key (e.g. 'PIX')."""
        if team_key in self._team_cache:
            return self._team_cache[team_key]

        query = """
        query($teamKey: String!) {
            teams(filter: { key: { eq: $teamKey } }) {
                nodes {
                    id
                    key
                    name
                    states {
                        nodes {
                            id
                            name
                            type
                        }
                    }
                }
            }
        }
        """
        data = self.execute_gql(query, {"teamKey": team_key})
        nodes = data.get("teams", {}).get("nodes", [])
        if not nodes:
            raise ValueError(f"Linear Team with key '{team_key}' not found.")

        raw_team = nodes[0]
        state_map = {s["name"]: s["id"] for s in raw_team.get("states", {}).get("nodes", [])}

        team = LinearTeam(
            id=raw_team["id"],
            key=raw_team["key"],
            name=raw_team["name"],
            states=state_map,
        )
        self._team_cache[team_key] = team
        return team

    def get_or_create_label(self, team_id: str, label_name: str) -> str:
        """Find or create a label in a team (case-insensitively)."""
        if team_id not in self._label_cache:
            self._label_cache[team_id] = {}

        for existing_name, lid in self._label_cache[team_id].items():
            if existing_name.lower() == label_name.lower():
                return lid

        query = """
        query($teamId: ID!) {
            issueLabels(filter: { team: { id: { eq: $teamId } } }) {
                nodes {
                    id
                    name
                }
            }
        }
        """
        data = self.execute_gql(query, {"teamId": team_id})
        nodes = data.get("issueLabels", {}).get("nodes", [])
        for n in nodes:
            self._label_cache[team_id][n["name"]] = n["id"]

        for existing_name, lid in self._label_cache[team_id].items():
            if existing_name.lower() == label_name.lower():
                return lid

        # Create label
        create_mutation = """
        mutation($teamId: String!, $name: String!) {
            issueLabelCreate(input: { teamId: $teamId, name: $name }) {
                success
                issueLabel {
                    id
                    name
                }
            }
        }
        """
        try:
            create_data = self.execute_gql(create_mutation, {"teamId": team_id, "name": label_name})
            label_id = create_data.get("issueLabelCreate", {}).get("issueLabel", {}).get("id")
            if label_id:
                self._label_cache[team_id][label_name] = label_id
                return label_id
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                # Re-fetch and return matched ID
                refetch = self.execute_gql(query, {"teamId": team_id})
                for n in refetch.get("issueLabels", {}).get("nodes", []):
                    self._label_cache[team_id][n["name"]] = n["id"]
                    if n["name"].lower() == label_name.lower():
                        return n["id"]
            raise

        raise RuntimeError(f"Failed to create label '{label_name}' for team {team_id}")

    def get_issues_by_state_and_label(
        self,
        team_key: str,
        state_name: str,
        label_name: str | None = None,
        limit: int = 20,
    ) -> list[LinearIssue]:
        """Query open issues matching team, state, and optional label."""
        team = self.resolve_team(team_key)
        state_id = team.states.get(state_name)
        if not state_id:
            logger.warning("State '%s' not found for team '%s'", state_name, team_key)
            return []

        query = """
        query($teamId: ID!, $stateId: ID!, $first: Int!) {
            issues(
                filter: {
                    team: { id: { eq: $teamId } }
                    state: { id: { eq: $stateId } }
                }
                first: $first
                orderBy: createdAt
            ) {
                nodes {
                    id
                    identifier
                    title
                    description
                    priority
                    url
                    state {
                        id
                        name
                    }
                    labels {
                        nodes {
                            name
                        }
                    }
                }
            }
        }
        """
        data = self.execute_gql(query, {"teamId": team.id, "stateId": state_id, "first": limit})
        nodes = data.get("issues", {}).get("nodes", [])

        results = []
        for n in nodes:
            labels = [lbl["name"] for lbl in n.get("labels", {}).get("nodes", [])]
            if label_name and label_name not in labels:
                continue

            results.append(
                LinearIssue(
                    id=n["id"],
                    identifier=n["identifier"],
                    title=n["title"],
                    description=n.get("description"),
                    state_id=n.get("state", {}).get("id"),
                    state_name=n.get("state", {}).get("name"),
                    labels=labels,
                    priority=n.get("priority"),
                    url=n.get("url", ""),
                )
            )
        return results

    def get_issue_comments(self, issue_identifier: str, limit: int = 50) -> tuple[str, list[LinearComment]]:
        """Get issue ID and all comments for an issue identifier (e.g. PIX-4609)."""
        query = """
        query($identifier: String!, $first: Int!) {
            issue(id: $identifier) {
                id
                identifier
                comments(first: $first, orderBy: createdAt) {
                    nodes {
                        id
                        body
                        createdAt
                        user {
                            name
                            isMe
                        }
                    }
                }
            }
        }
        """
        data = self.execute_gql(query, {"identifier": issue_identifier, "first": limit})
        issue_data = data.get("issue")
        if not issue_data:
            raise ValueError(f"Issue '{issue_identifier}' not found in Linear.")

        issue_id = issue_data["id"]
        comments = []
        for c in issue_data.get("comments", {}).get("nodes", []):
            author = c.get("user", {}).get("name", "Unknown") if c.get("user") else "System"
            comments.append(
                LinearComment(
                    id=c["id"],
                    body=c.get("body", ""),
                    created_at=c["createdAt"],
                    author_name=author,
                )
            )
        return issue_id, comments

    def post_comment(self, issue_id: str, body: str) -> str:
        """Post a comment to an issue."""
        mutation = """
        mutation($issueId: String!, $body: String!) {
            commentCreate(input: { issueId: $issueId, body: $body }) {
                success
                comment {
                    id
                }
            }
        }
        """
        data = self.execute_gql(mutation, {"issueId": issue_id, "body": body})
        comment_id = data.get("commentCreate", {}).get("comment", {}).get("id")
        if not comment_id:
            raise RuntimeError(f"Failed to post comment on issue {issue_id}")
        return comment_id

    def set_issue_state(self, issue_id: str, state_id: str) -> None:
        """Transition an issue to a new state."""
        mutation = """
        mutation($issueId: String!, $stateId: String!) {
            issueUpdate(id: $issueId, input: { stateId: $stateId }) {
                success
            }
        }
        """
        self.execute_gql(mutation, {"issueId": issue_id, "stateId": state_id})

    def add_label_to_issue(self, issue_id: str, label_id: str) -> None:
        """Add a label to an issue."""
        query = """
        query($id: String!) {
            issue(id: $id) {
                labels {
                    nodes {
                        id
                    }
                }
            }
        }
        """
        data = self.execute_gql(query, {"id": issue_id})
        existing_labels = [lbl["id"] for lbl in data.get("issue", {}).get("labels", {}).get("nodes", [])]
        if label_id in existing_labels:
            return

        new_labels = [*existing_labels, label_id]
        mutation = """
        mutation($id: String!, $labelIds: [String!]!) {
            issueUpdate(id: $id, input: { labelIds: $labelIds }) {
                success
            }
        }
        """
        self.execute_gql(mutation, {"id": issue_id, "labelIds": new_labels})

    def create_project(self, team_id: str, name: str, description: str = "") -> dict[str, str]:
        """Create a new Linear Project for a team."""
        mutation = """
        mutation($teamIds: [String!]!, $name: String!, $description: String) {
            projectCreate(input: { teamIds: $teamIds, name: $name, description: $description }) {
                success
                project {
                    id
                    name
                    url
                }
            }
        }
        """
        data = self.execute_gql(mutation, {"teamIds": [team_id], "name": name, "description": description})
        proj = data.get("projectCreate", {}).get("project", {})
        if not proj or not proj.get("id"):
            raise RuntimeError(f"Failed to create Linear Project '{name}'")
        return {"id": proj["id"], "name": proj["name"], "url": proj.get("url", "")}

    def create_issue(
        self,
        team_id: str,
        title: str,
        description: str = "",
        state_id: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> LinearIssue:
        """Create a new issue in Linear."""
        inp: dict[str, Any] = {
            "teamId": team_id,
            "title": title,
            "description": description,
        }
        if state_id:
            inp["stateId"] = state_id
        if extra:
            if "priority" in extra and extra["priority"] is not None:
                inp["priority"] = extra["priority"]
            if extra.get("label_ids"):
                inp["labelIds"] = extra["label_ids"]
            if extra.get("project_id"):
                inp["projectId"] = extra["project_id"]

        mutation = """
        mutation($input: IssueCreateInput!) {
            issueCreate(input: $input) {
                success
                issue {
                    id
                    identifier
                    title
                    description
                    url
                    state {
                        id
                        name
                    }
                    labels {
                        nodes {
                            name
                        }
                    }
                }
            }
        }
        """
        data = self.execute_gql(mutation, {"input": inp})
        raw = data.get("issueCreate", {}).get("issue", {})
        if not raw or not raw.get("id"):
            raise RuntimeError(f"Failed to create issue '{title}'")

        labels = [lbl["name"] for lbl in raw.get("labels", {}).get("nodes", [])]
        return LinearIssue(
            id=raw["id"],
            identifier=raw["identifier"],
            title=raw["title"],
            description=raw.get("description"),
            state_id=raw.get("state", {}).get("id"),
            state_name=raw.get("state", {}).get("name"),
            labels=labels,
            url=raw.get("url", ""),
        )

    def find_or_create_coordination_ticket(
        self,
        team_key: str,
        title: str = "Multi-Agent Coordination & Architecture Discussion",
        create_if_missing: bool = True,
    ) -> str:
        """Find existing coordination ticket or create one with 'coordination' label."""
        team = self.resolve_team(team_key)
        query = """
        query($teamId: ID!, $title: String!) {
            issues(
                filter: {
                    team: { id: { eq: $teamId } }
                    title: { eq: $title }
                }
                first: 1
            ) {
                nodes {
                    id
                    identifier
                }
            }
        }
        """
        data = self.execute_gql(query, {"teamId": team.id, "title": title})
        nodes = data.get("issues", {}).get("nodes", [])
        if nodes:
            return nodes[0]["identifier"]

        if not create_if_missing:
            raise ValueError(f"Coordination ticket '{title}' not found in team '{team_key}'.")

        coord_label_id = self.get_or_create_label(team.id, "coordination")
        todo_state_id = team.states.get("Todo") or team.states.get("Triage")

        created = self.create_issue(
            team_id=team.id,
            title=title,
            description=(
                "# 🧠 Multi-Agent Autonomous Nervous System\n\n"
                "This ticket acts as the shared blackboard, deliberation channel, and consensus hub for autonomous agents.\n"
                "Agents post proposals, debate architecture, vote on consensus, and broadcast system events here."
            ),
            state_id=todo_state_id,
            extra={"label_ids": [coord_label_id], "priority": 1},
        )
        logger.info("Created new Coordination ticket %s for team %s", created.identifier, team_key)
        return created.identifier
