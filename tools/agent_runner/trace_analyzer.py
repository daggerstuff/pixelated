"""Active Trace Analyzer and Anomaly Extractor for LangSmith and local traces."""

from __future__ import annotations

import json
import logging
import os
import subprocess
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("agent_runner.trace_analyzer")

try:
    from dotenv import load_dotenv  # type: ignore[import-untyped]

    load_dotenv(override=True)
except ImportError:
    pass

try:
    from langsmith import Client as LangSmithClient  # type: ignore[import-untyped]
except ImportError:
    LangSmithClient = None


@dataclass
class TraceSummary:
    trace_id: str
    name: str
    run_type: str
    status: str
    start_time: str
    end_time: str | None
    latency_ms: float
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    tool_calls_count: int
    has_errors: bool
    error_message: str | None = None
    child_runs: list[dict[str, Any]] = field(default_factory=list)
    anomalies: list[str] = field(default_factory=list)


class TraceAnalyzer:
    """Actively inspects, parses, and evaluates LangSmith execution traces for anomaly detection and quality gating."""

    def __init__(self, project_name: str | None = None):
        self.project_name = project_name or os.environ.get("LANGSMITH_PROJECT", "tracer")
        self.client = None
        if LangSmithClient and os.environ.get("LANGSMITH_API_KEY"):
            try:
                self.client = LangSmithClient()
            except Exception as e:
                logger.debug("Could not initialize LangSmith Python Client: %s", e)

    def fetch_recent_traces(self, limit: int = 10) -> list[dict[str, Any]]:
        """Fetch recent execution traces using LangSmith Client or CLI."""
        traces = []
        if self.client:
            try:
                runs = list(self.client.list_runs(project_name=self.project_name, execution_order=1, limit=limit))
                for r in runs:
                    traces.append(
                        {
                            "id": str(r.id),
                            "name": r.name,
                            "run_type": r.run_type,
                            "status": r.status,
                            "start_time": r.start_time.isoformat() if r.start_time else None,
                            "end_time": r.end_time.isoformat() if r.end_time else None,
                            "total_tokens": r.total_tokens or 0,
                            "error": r.error,
                            "inputs": r.inputs,
                            "outputs": r.outputs,
                        }
                    )
                return traces
            except Exception as e:
                logger.debug("LangSmith SDK list_runs failed, falling back to CLI: %s", e)

        # Fallback to langsmith CLI
        try:
            res = subprocess.run(
                ["langsmith", "run", "list", "--project", self.project_name, "--limit", str(limit), "--format", "json"],
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
            if res.returncode == 0 and res.stdout.strip():
                data = json.loads(res.stdout)
                if isinstance(data, list):
                    return data
                if isinstance(data, dict) and "runs" in data:
                    return data["runs"]
        except Exception as e:
            logger.debug("LangSmith CLI list failed: %s", e)

        return traces

    def analyze_ticket_trace(self, ticket_identifier: str) -> TraceSummary | None:
        """Find and analyze trace for a specific ticket identifier."""
        traces = self.fetch_recent_traces(limit=25)
        matched = None
        for t in traces:
            name = t.get("name", "")
            inputs_str = json.dumps(t.get("inputs", {}))
            if ticket_identifier in name or ticket_identifier in inputs_str:
                matched = t
                break

        if not matched:
            return None

        return self.evaluate_trace_payload(matched)

    def evaluate_trace_payload(self, trace_data: dict[str, Any]) -> TraceSummary:
        """Inspect trace payload for anomalies, hollow execution, error patterns, and token usage."""
        trace_id = str(trace_data.get("id", trace_data.get("trace_id", "unknown")))
        name = trace_data.get("name", "Unknown-Run")
        run_type = trace_data.get("run_type", "chain")
        status = trace_data.get("status", "completed")
        start_time = str(trace_data.get("start_time", ""))
        end_time = str(trace_data.get("end_time", "")) if trace_data.get("end_time") else None

        prompt_tokens = trace_data.get("prompt_tokens", 0) or 0
        completion_tokens = trace_data.get("completion_tokens", 0) or 0
        total_tokens = trace_data.get("total_tokens", prompt_tokens + completion_tokens) or 0

        error_msg = trace_data.get("error")
        has_errors = bool(error_msg) or status in ("error", "failed")

        anomalies: list[str] = []

        # Anomaly Check 1: Tool invocation audit
        tool_calls = trace_data.get("child_runs", []) or []
        tool_count = sum(1 for c in tool_calls if c.get("run_type") == "tool")

        outputs = str(trace_data.get("outputs", ""))

        # Anomaly Check 2: Fake / Mock cheating detection in output
        if "seededRandom" in outputs or "Math.random" in outputs:
            anomalies.append("Detected pseudo-random / mock data generator in execution output")

        # Anomaly Check 3: Zero modifications or hollow execution
        if ("0 files changed" in outputs or "No files to format-check" in outputs) and "feat(" in outputs:
            anomalies.append("Zero file modifications detected despite feature delivery claim")

        # Anomaly Check 4: Anti-suppression bypasses
        if any(bad in outputs for bad in ["@ts-ignore", "@ts-nocheck", "# noqa", "# type: ignore"]):
            anomalies.append("Detected forbidden anti-suppression comments in execution output")

        if has_errors:
            anomalies.append(f"Execution failed with error: {error_msg}")

        return TraceSummary(
            trace_id=trace_id,
            name=name,
            run_type=run_type,
            status=status,
            start_time=start_time,
            end_time=end_time,
            latency_ms=0.0,
            total_tokens=total_tokens,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            tool_calls_count=tool_count,
            has_errors=has_errors,
            error_message=error_msg,
            anomalies=anomalies,
        )
