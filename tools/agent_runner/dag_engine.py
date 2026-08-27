"""Directed Acyclic Graph (DAG) Task Engine with flexible key-value token parsing."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from tools.agent_runner.client import LinearClient

logger = logging.getLogger("agent_runner.dag")


@dataclass
class TaskGraphNode:
    key: str
    title: str
    description: str = ""
    agent_label: str = ""
    priority: int = 2
    dependencies: list[str] = field(default_factory=list)
    labels: list[str] = field(default_factory=list)


class DAGEngine:
    """Parses, validates, and checks dependency satisfaction for structured multi-task DAGs."""

    @staticmethod
    def _parse_task_line(line: str) -> TaskGraphNode | None:
        """Parse a single markdown list item into a TaskGraphNode regardless of token ordering."""
        clean = re.sub(r"^[\s*\->\+]+", "", line).strip()
        if not clean or ":" not in clean:
            return None

        # Extract depends: [...] and labels: [...]
        depends_match = re.search(r"depends:\s*\[(.*?)\]", clean, re.IGNORECASE)
        dependencies: list[str] = []
        if depends_match:
            deps_raw = depends_match.group(1).strip()
            if deps_raw:
                dependencies = [d.strip() for d in deps_raw.split(",") if d.strip()]
            clean = clean[: depends_match.start()] + clean[depends_match.end() :]

        labels_match = re.search(r"labels:\s*\[(.*?)\]", clean, re.IGNORECASE)
        labels: list[str] = []
        if labels_match:
            lbls_raw = labels_match.group(1).strip()
            if lbls_raw:
                labels = [lbl.strip() for lbl in lbls_raw.split(",") if lbl.strip()]
            clean = clean[: labels_match.start()] + clean[labels_match.end() :]

        # Tokenize remaining comma-separated pairs
        tokens = [t.strip() for t in clean.split(",") if t.strip()]
        kv_map: dict[str, str] = {}
        for token in tokens:
            if ":" in token:
                k, v = token.split(":", 1)
                kv_map[k.strip().lower()] = v.strip()

        key = kv_map.get("id") or kv_map.get("key")
        title = kv_map.get("title")
        if not key or not title:
            # Fallback legacy regex pattern
            legacy = re.match(
                r"(?:id:\s*)?([A-Za-z0-9_\-]+)\s*\|\s*([^|]+)(?:\|\s*agent:\s*([^|]+))?(?:\|\s*priority:\s*(\d+))?",
                clean,
                re.IGNORECASE,
            )
            if legacy:
                key = legacy.group(1).strip()
                title = legacy.group(2).strip()
                agent = legacy.group(3).strip() if legacy.group(3) else ""
                prio = int(legacy.group(4)) if legacy.group(4) else 2
                return TaskGraphNode(
                    key=key, title=title, agent_label=agent, priority=prio, dependencies=dependencies, labels=labels
                )
            return None

        agent_val = kv_map.get("agent", "")
        if agent_val and not agent_val.startswith("agent:"):
            agent_val = f"agent:{agent_val}"

        prio_val = 2
        if "priority" in kv_map:
            try:
                prio_val = int(kv_map["priority"])
            except ValueError:
                prio_val = 2

        return TaskGraphNode(
            key=key,
            title=title,
            agent_label=agent_val,
            priority=prio_val,
            dependencies=dependencies,
            labels=labels,
        )

    @classmethod
    def parse_task_graph(cls, text: str) -> list[TaskGraphNode]:
        """Extract all TaskGraphNode entries from a TASK_GRAPH: block."""
        nodes: list[TaskGraphNode] = []
        if not text:
            return nodes

        graph_match = re.search(r"TASK_GRAPH:\s*\n((?:[ \t]*[-*]\s*[^\n]+\n?)+)", text, re.IGNORECASE)
        if not graph_match:
            return nodes

        block = graph_match.group(1)
        for line in block.splitlines():
            node = cls._parse_task_line(line)
            if node:
                nodes.append(node)

        return nodes

    @staticmethod
    def is_dependency_satisfied(
        dependencies: list[str],
        client: LinearClient,
        _team_key: str = "",
        completed_state_names: tuple[str, ...] = ("Done", "In Review"),
    ) -> bool:
        """Check if all parent dependency tickets are in a completed state."""
        if not dependencies:
            return True

        for dep_ref in dependencies:
            try:
                issue_id, _ = client.get_issue_comments(dep_ref, limit=1)
                # Query state of dependency issue
                query = "query($id: String!) { issue(id: $id) { state { name } } }"
                data = client.execute_gql(query, {"id": issue_id})
                state_name = data.get("issue", {}).get("state", {}).get("name")
                if state_name not in completed_state_names:
                    return False
            except Exception as e:
                logger.warning("Error checking dependency '%s': %s", dep_ref, e)
                return False

        return True
