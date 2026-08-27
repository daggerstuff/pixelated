"""Unit tests for SensorHookEngine."""

import os
import tempfile

from tools.agent_runner.models import AgentConfig, LinearIssue
from tools.agent_runner.sensor_hooks import SensorHookEngine


def test_pre_flight_and_post_flight_sensors():
    with tempfile.TemporaryDirectory() as tmp_dir:
        agent = AgentConfig(name="test_agent", label="agent:test", cmd=["git"])
        issue = LinearIssue(id="1", identifier="PIX-1", title="Test Task")

        pre_report = SensorHookEngine.run_pre_flight_checks(tmp_dir, agent, issue)
        assert pre_report.passed is True
        assert "git" in pre_report.environment_info

        scratch_file = os.path.join(tmp_dir, "leftover.scratch")
        with open(scratch_file, "w") as f:
            f.write("scratch")

        post_report = SensorHookEngine.run_post_flight_sensors(tmp_dir)
        assert post_report.passed is True
