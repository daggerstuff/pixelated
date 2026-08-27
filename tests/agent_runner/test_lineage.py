"""Unit tests for LineageTracker."""

import os
import tempfile

from tools.agent_runner.lineage import LineageTracker


def test_lineage_provenance_graph():
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = os.path.join(tmp_dir, "lineage.json")
        tracker = LineageTracker(storage_path=storage)

        # 1. Record spec node
        tracker.record_node("SPEC-1", "spec", "FHIR Encryption Spec")

        # 2. Record project node linked to spec
        tracker.record_node("PROJ-1", "project", "EHR Project", parent_id="SPEC-1")

        # 3. Record ticket node linked to project
        tracker.record_node("PIX-10", "ticket", "Implement Crypto", parent_id="PROJ-1")

        # 4. Record PR node linked to ticket
        tracker.record_node("https://github.com/org/repo/pull/1", "pr", "PR #1", parent_id="PIX-10")

        # Verify hierarchy
        spec = tracker.get_node("SPEC-1")
        assert spec is not None
        assert "PROJ-1" in spec.children_ids

        ticket = tracker.get_node("PIX-10")
        assert ticket is not None
        assert "PROJ-1" in ticket.parent_ids
        assert "https://github.com/org/repo/pull/1" in ticket.children_ids

        # Verify mermaid export
        mermaid = tracker.export_mermaid_lineage()
        assert "```mermaid" in mermaid
        assert "SPEC_1 --> PROJ_1" in mermaid
        assert "PROJ_1 --> PIX_10" in mermaid
