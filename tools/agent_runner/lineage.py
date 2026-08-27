"""Agent Lineage & Provenance Graph Tracker (inspired by Exo)."""

from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("agent_runner.lineage")


@dataclass
class LineageNode:
    node_id: str
    node_type: str  # "spec", "project", "ticket", "worktree", "delegation", "pr", "memory"
    title: str
    metadata: dict[str, Any] = field(default_factory=dict)
    parent_ids: list[str] = field(default_factory=list)
    children_ids: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LineageTracker:
    """Manages an append-only provenance graph linking specs, tickets, worktrees, PRs, and memories."""

    def __init__(self, storage_path: str | None = None):
        default_path = os.path.expanduser("~/.local/state/agent-runner/lineage_graph.json")
        self.storage_path = os.path.abspath(storage_path or default_path)
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        self._lock = threading.Lock()
        self._nodes: dict[str, LineageNode] = {}
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.storage_path):
            return
        try:
            with open(self.storage_path, encoding="utf-8") as f:
                data = json.load(f)
                for node_id, raw in data.get("nodes", {}).items():
                    self._nodes[node_id] = LineageNode(
                        node_id=raw["node_id"],
                        node_type=raw["node_type"],
                        title=raw["title"],
                        metadata=raw.get("metadata", {}),
                        parent_ids=raw.get("parent_ids", []),
                        children_ids=raw.get("children_ids", []),
                        created_at=raw.get("created_at", ""),
                    )
        except Exception as e:
            logger.warning("Could not load lineage graph: %s", e)

    def _save(self) -> None:
        try:
            temp_path = f"{self.storage_path}.tmp"
            data = {"nodes": {nid: asdict(node) for nid, node in self._nodes.items()}}
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(temp_path, self.storage_path)
        except Exception as e:
            logger.warning("Could not persist lineage graph: %s", e)

    def record_node(
        self,
        node_id: str,
        node_type: str,
        title: str,
        metadata: dict[str, Any] | None = None,
        parent_id: str | None = None,
    ) -> LineageNode:
        """Create or update a node in the lineage graph."""
        with self._lock:
            if node_id in self._nodes:
                node = self._nodes[node_id]
                node.title = title
                if metadata:
                    node.metadata.update(metadata)
            else:
                node = LineageNode(
                    node_id=node_id,
                    node_type=node_type,
                    title=title,
                    metadata=metadata or {},
                )
                self._nodes[node_id] = node

            if parent_id and parent_id != node_id:
                if parent_id not in node.parent_ids:
                    node.parent_ids.append(parent_id)
                if parent_id in self._nodes and node_id not in self._nodes[parent_id].children_ids:
                    self._nodes[parent_id].children_ids.append(node_id)

            self._save()
            return node

    def link_nodes(self, parent_id: str, child_id: str) -> None:
        """Establish a directed parent -> child edge."""
        with self._lock:
            if parent_id in self._nodes and child_id not in self._nodes[parent_id].children_ids:
                self._nodes[parent_id].children_ids.append(child_id)
            if child_id in self._nodes and parent_id not in self._nodes[child_id].parent_ids:
                self._nodes[child_id].parent_ids.append(parent_id)
            self._save()

    def get_node(self, node_id: str) -> LineageNode | None:
        with self._lock:
            return self._nodes.get(node_id)

    def get_all_nodes(self) -> list[LineageNode]:
        with self._lock:
            return list(self._nodes.values())

    def export_mermaid_lineage(self, root_id: str | None = None) -> str:
        """Export the lineage graph as a Mermaid diagram."""
        with self._lock:
            lines = ["```mermaid", "flowchart TD"]
            type_icons = {
                "spec": "📄",
                "project": "📁",
                "ticket": "🎫",
                "worktree": "🌿",
                "delegation": "🤝",
                "pr": "🚀",
                "memory": "🧠",
            }

            nodes_to_show = self._nodes.values()
            if root_id and root_id in self._nodes:
                relevant_ids = set()
                queue = [root_id]
                while queue:
                    curr = queue.pop(0)
                    relevant_ids.add(curr)
                    if curr in self._nodes:
                        queue.extend(self._nodes[curr].children_ids)
                nodes_to_show = [n for n in self._nodes.values() if n.node_id in relevant_ids]

            for node in nodes_to_show:
                icon = type_icons.get(node.node_type, "🔹")
                clean_title = node.title.replace('"', "'")[:35]
                clean_id = node.node_id.replace("-", "_").replace(":", "_").replace("/", "_")
                lines.append(f'    {clean_id}["{icon} {node.node_id}: {clean_title}"]')
                for parent_id in node.parent_ids:
                    if not root_id or parent_id in [n.node_id for n in nodes_to_show]:
                        clean_parent = parent_id.replace("-", "_").replace(":", "_").replace("/", "_")
                        lines.append(f"    {clean_parent} --> {clean_id}")

            lines.append("```")
            return "\n".join(lines)
