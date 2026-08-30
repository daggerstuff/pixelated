"""CLI entrypoint for the Linear Multi-Agent Coordination Runner."""

from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import sys

from tools.agent_runner.client import LinearClient
from tools.agent_runner.config_loader import load_config
from tools.agent_runner.coordinator import MultiAgentCoordinator
from tools.agent_runner.dashboard import ClusterDashboard
from tools.agent_runner.event_bus import EventBus
from tools.agent_runner.lineage import LineageTracker
from tools.agent_runner.project_initializer import SpecProjectInitializer
from tools.agent_runner.self_evolution import SelfEvolutionEngine
from tools.agent_runner.skeptic import SkepticReviewer
from tools.agent_runner.state_manager import StateManager
from tools.agent_runner.triage import AutoTriageEngine

# Automatically load .env if present
try:
    from dotenv import load_dotenv  # type: ignore[import-untyped]

    load_dotenv(override=True)
except ImportError:
    pass

logger = logging.getLogger("agent_runner.cli")


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def resolve_config_path(explicit_path: str | None = None) -> str:
    if explicit_path and os.path.exists(explicit_path):
        return os.path.abspath(explicit_path)

    candidates = [
        os.path.join(os.getcwd(), "config", "agent_runner_config.json"),
        os.path.join(os.getcwd(), "agent_runner_config.json"),
        os.path.expanduser("~/.config/agent_runner/config.json"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)

    return os.path.abspath(candidates[0])


def cmd_run(args: argparse.Namespace) -> int:
    setup_logging(args.verbose)
    cfg_path = resolve_config_path(args.config)
    logger.info("Loading configuration from: %s", cfg_path)
    config = load_config(cfg_path)

    client = LinearClient()
    state_mgr = StateManager(args.state)
    coordinator = MultiAgentCoordinator(config, client, state_mgr)

    if args.once:
        logger.info("Running single coordinator evaluation tick...")
        stats = coordinator.tick()
        print("\n==================================================")
        print(" Evaluation Tick Complete:")
        print(f"   • Tickets Triaged:          {stats['triaged']}")
        print(f"   • Tickets Processed:        {stats['tickets_processed']}")
        print(f"   • Skeptic Reviews Spawned:  {stats['skeptic_tickets_spawned']}")
        print(f"   • Stale Claims Reclaimed:   {stats['stale_reclaimed']}")
        print("==================================================")
        return 0

    coordinator.run_loop()
    return 0


def cmd_triage(args: argparse.Namespace) -> int:
    setup_logging(args.verbose)
    cfg_path = resolve_config_path(args.config)
    config = load_config(cfg_path)
    client = LinearClient()
    state_mgr = StateManager(args.state)

    triage_engine = AutoTriageEngine(client, config, state_mgr)
    total = 0
    for p in config.projects:
        total += triage_engine.process_triage_for_project(p)

    print(f"Auto-triage completed. Triaged {total} tickets.")
    return 0


def cmd_skeptic(args: argparse.Namespace) -> int:
    setup_logging(args.verbose)
    cfg_path = resolve_config_path(args.config)
    config = load_config(cfg_path)
    client = LinearClient()
    state_mgr = StateManager(args.state)

    skeptics = [a for a in config.agents if a.watch == "coordination"]
    if not skeptics:
        print("No skeptic agents configured (watch: 'coordination').")
        return 1

    reviewer = SkepticReviewer(client, config, state_mgr)
    total_spawned = 0
    for p in config.projects:
        for sk in skeptics:
            total_spawned += reviewer.process_skeptic_for_project(p, sk)

    print(f"Skeptic review pass completed. Spawned {total_spawned} tickets.")
    return 0


def cmd_doctor(args: argparse.Namespace) -> int:
    print("==================================================")
    print(" 🩺 Linear Agent Runner Doctor & Diagnostic Audit")
    print("==================================================")

    # 1. Check LINEAR_API_KEY
    api_key = os.environ.get("LINEAR_API_KEY")
    if not api_key:
        print("❌ LINEAR_API_KEY: Not found in environment or .env file.")
    else:
        masked = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else "***"
        print(f"✅ LINEAR_API_KEY: Present ({masked})")
        try:
            client = LinearClient(api_key)
            user_data = client.execute_gql("query { viewer { id name email } }")
            viewer = user_data.get("viewer", {})
            print(f"   Authenticated as: {viewer.get('name')} <{viewer.get('email')}>")
        except Exception as e:
            print(f"❌ Linear API Connection Failed: {e}")

    # 2. Check Config File
    cfg_path = resolve_config_path(args.config)
    if os.path.exists(cfg_path):
        print(f"✅ Config File: Found at {cfg_path}")
        try:
            cfg = load_config(cfg_path)
            print(f"   Server Label: {cfg.server_label}")
            print(f"   Projects:     {', '.join([p.team_key for p in cfg.projects])}")
            print(f"   Agents:       {', '.join([a.name for a in cfg.agents])}")
        except Exception as e:
            print(f"❌ Config Validation Failed: {e}")
    else:
        print(f"⚠️ Config File: Not found at {cfg_path}. Run 'init-config' to generate.")

    # 3. Check CLI tools
    for tool in ["git", "gh", "pnpm", "uv", "opencode", "claude", "mastracode", "fx", "agy"]:
        path = shutil.which(tool)
        status = f"✅ Found ({path})" if path else "⚠️ Not found in PATH"
        print(f"   Tool '{tool}': {status}")

    print("==================================================")
    return 0


def cmd_init_config(args: argparse.Namespace) -> int:
    cfg_path = resolve_config_path(args.config)
    if os.path.exists(cfg_path):
        print(f"Config file already exists at: {cfg_path}")
        return 0

    os.makedirs(os.path.dirname(cfg_path), exist_ok=True)
    template = {
        "server_label": f"srv:{os.uname().nodename.split('.')[0]}",
        "poll_seconds": 60,
        "triage_state": "Triage",
        "ready_state": "Todo",
        "active_state": "In Progress",
        "done_state": "In Review",
        "max_concurrent_workers": 4,
        "enable_git_branching": True,
        "enable_git_pr_creation": True,
        "enable_foresight_memory": True,
        "enable_langchain_tracing": True,
        "langchain_project": "linear-agent-runner",
        "verification": {
            "enabled": True,
            "auto_repair": True,
            "max_repair_attempts": 2,
            "commands": ["uv run pytest tests/agent_runner/ -q"],
            "timeout_seconds": 300,
            "block_on_suppression": True,
        },
        "guardrails": {
            "phi_redaction": True,
            "secret_leak_prevention": True,
            "anti_suppression_enforcement": True,
        },
        "projects": [
            {
                "team_key": "PIX",
                "default_repo": "main",
                "coordination_title": "Multi-Agent Coordination & Architecture Discussion",
                "repos": {"main": os.getcwd()},
                "auto_create_coordination_ticket": True,
            }
        ],
        "triage_rules": [
            {
                "keywords": ["security", "hipaa", "audit", "auth", "phi", "rbac", "encryption"],
                "preferred_agent": "agy",
                "required_role": "security_sentinel",
                "additional_labels": ["security"],
            },
            {
                "keywords": ["refactor", "bug", "fix", "feature", "backend", "api", "endpoint", "split", "version"],
                "preferred_agent": "opencode",
                "required_role": "backend_engineer",
            },
        ],
        "agents": [
            {
                "name": "opencode",
                "label": "agent:opencode",
                "role": "backend_engineer",
                "cmd": ["opencode", "run", "{prompt_file}"],
                "capabilities": ["code", "refactor", "feature", "backend", "frontend"],
            },
            {
                "name": "agy",
                "label": "agent:agy",
                "role": "security_sentinel",
                "cmd": ["agy", "--print", "{prompt_file}", "--dangerously-skip-permissions"],
                "capabilities": ["architecture", "review", "security", "design", "audit", "testing"],
            },
        ],
    }

    with open(cfg_path, "w", encoding="utf-8") as f:
        json.dump(template, f, indent=2)

    print(f"✅ Generated initial configuration at: {cfg_path}")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    state_mgr = StateManager(args.state)
    metrics = state_mgr.get_metrics()
    claims = state_mgr.get_active_claims()
    print("==================================================")
    print(" 📊 Linear Multi-Agent Runner Status")
    print("==================================================")
    print(f" Active Claims: {len(claims)}")
    for t_id, c in claims.items():
        print(f"   • {t_id} -> {c.get('agent')} on {c.get('server')}")
    print("\n Execution Metrics:")
    for k, v in metrics.items():
        print(f"   • {k}: {v}")
    print("==================================================")
    return 0


def cmd_dashboard(args: argparse.Namespace) -> int:
    cfg_path = resolve_config_path(args.config)
    config = load_config(cfg_path)
    state_mgr = StateManager(args.state)
    dashboard = ClusterDashboard(config, state_mgr)
    print(dashboard.render_text())
    return 0


def cmd_events(args: argparse.Namespace) -> int:
    event_bus = EventBus()
    events = event_bus.replay_recent_events(limit=args.limit or 25)
    print("==================================================")
    print(" 📜 Recent State Events (Immutable Ledger)")
    print("==================================================")
    if not events:
        print("No events recorded yet.")
        return 0
    for ev in events:
        ts = ev.timestamp_utc[11:19] if len(ev.timestamp_utc) >= 19 else "00:00:00"
        print(f"[{ts}] {ev.event_type.value} [{ev.agent_name}] on {ev.ticket_identifier}")
        if ev.payload:
            print(f"       payload: {ev.payload}")
    print("==================================================")
    return 0


def cmd_plan(args: argparse.Namespace) -> int:
    setup_logging(args.verbose)
    spec_path = os.path.abspath(args.spec_file)
    if not os.path.exists(spec_path):
        print(f"❌ Specification file not found: {spec_path}")
        return 1

    with open(spec_path, encoding="utf-8") as f:
        spec_content = f.read()

    cfg_path = resolve_config_path(args.config)
    cfg = load_config(cfg_path)
    client = LinearClient()

    project_name = (
        args.name or os.path.splitext(os.path.basename(spec_path))[0].replace("-", " ").replace("_", " ").title()
    )
    team_key = args.team or cfg.projects[0].team_key if cfg.projects else "PIX"

    print("==================================================")
    print(f" 🧭 Spec Initializer: Planning '{project_name}' for Team {team_key}")
    print("==================================================")

    initializer = SpecProjectInitializer(client, cfg)
    res = initializer.initialize_from_spec(
        spec_content=spec_content,
        project_name=project_name,
        team_key=team_key,
        options={
            "workdir": os.getcwd(),
            "enable_deliberation": not getattr(args, "no_deliberation", False),
            "dry_run": getattr(args, "dry_run", False),
        },
    )

    if res.is_dry_run:
        print(f"\n🔍 [DRY-RUN] Planned Project: {res.project_name}")
        print(f"📋 Decomposed {len(res.created_issues)} Tasks:")
        for issue in res.created_issues:
            print(f"   • [{issue.identifier}] {issue.title} (labels: {issue.labels})")
        print("\n📊 Phased Dependency Graph:")
        print(res.mermaid_diagram)
        if res.deliberation_summary:
            print("\n" + res.deliberation_summary)
        print("==================================================")
        print("Dry-run preview complete. Run without --dry-run to deploy to Linear.")
        return 0

    print(f"\n✅ Linear Project Created: [{res.project_name}]({res.project_url})")
    print(f"✅ META Dashboard Ticket:  [{res.meta_issue.identifier}]({res.meta_issue.url})")
    print(f"\n📋 Decomposed {len(res.created_issues)} Tasks:")
    for issue in res.created_issues:
        print(f"   • [{issue.identifier}] {issue.title}")

    print("\n==================================================")
    print("Plan initialized and deployed to Linear successfully.")
    return 0


def cmd_lineage(args: argparse.Namespace) -> int:
    tracker = LineageTracker()
    nodes = tracker.get_all_nodes()
    print("==================================================")
    print("🧬 Multi-Agent Provenance Lineage Graph")
    print("==================================================")
    if not nodes:
        print("No lineage nodes recorded yet.")
        return 0
    print(f"Total Lineage Nodes: {len(nodes)}\n")
    print(tracker.export_mermaid_lineage(root_id=args.root))
    return 0


def cmd_evolution(args: argparse.Namespace) -> int:
    engine = SelfEvolutionEngine()
    lessons = engine.get_recent_lessons(limit=args.limit or 20)
    print("==================================================")
    print("🧠 Self-Evolution & Friction Distillation Log")
    print("==================================================")
    if not lessons:
        print("No self-evolution lessons recorded yet.")
        return 0
    for les in lessons:
        print(
            f"[{les.timestamp_utc[:19]}] [{les.failure_category.upper()}] on {les.ticket_identifier} (via {les.agent_name}):"
        )
        print(f"   🔍 Root Cause: {les.root_cause_summary}")
        print(f"   💡 Distilled Rule: {les.actionable_rule}\n")
def cmd_hitl(args: argparse.Namespace) -> int:
    """Run interactive Human-in-the-Loop CLI Proxy Listener."""
    from tools.agent_runner.hitl_proxy import EscalationStore, cli_proxy_listen
    store = EscalationStore()
    cli_proxy_listen(store)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="linear-agent-runner",
        description="Production-grade Linear Multi-Agent Coordination Runner",
    )
    parser.add_argument("-c", "--config", help="Path to config file", default=None)
    parser.add_argument("-s", "--state", help="Path to state file", default=None)
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose debug logging")

    subparsers = parser.add_subparsers(dest="subcommand")

    run_parser = subparsers.add_parser("run", help="Run the continuous coordinator daemon")
    run_parser.add_argument("--once", action="store_true", help="Run a single evaluation pass and exit")

    subparsers.add_parser("triage", help="Run auto-triage on unassigned tickets")
    subparsers.add_parser("skeptic", help="Run skeptic check on coordination threads")
    subparsers.add_parser("doctor", help="Inspect system health, API access, and agent CLIs")
    subparsers.add_parser("init-config", help="Generate an initial configuration tailored to this server")
    subparsers.add_parser("status", help="Show runner state and execution statistics")
    subparsers.add_parser("dashboard", help="Display live cluster observability monitor")
    subparsers.add_parser("hitl", help="Interactive Human-in-the-Loop CLI Proxy Listener")
    subparsers.add_parser("escalations", help="Interactive Human-in-the-Loop CLI Proxy Listener")

    events_parser = subparsers.add_parser("events", help="Show recent immutable state events")
    events_parser.add_argument("-n", "--limit", type=int, default=25, help="Number of events to display")

    plan_parser = subparsers.add_parser("plan", help="Ingest a specification file and generate a Linear Project DAG")
    plan_parser.add_argument("spec_file", help="Path to specification markdown/text file")
    plan_parser.add_argument("-t", "--team", help="Target Linear Team Key (default: PIX)", default=None)
    plan_parser.add_argument("-n", "--name", help="Linear Project Name", default=None)
    plan_parser.add_argument(
        "--dry-run", action="store_true", help="Preview plan and task graph without creating Linear issues"
    )
    plan_parser.add_argument(
        "--no-deliberation", action="store_true", help="Fast single-pass planning without skeptic red-teaming"
    )

    lineage_parser = subparsers.add_parser(
        "lineage", help="Display multi-agent provenance lineage graph in Mermaid format"
    )
    lineage_parser.add_argument(
        "-r", "--root", help="Filter lineage subtree under specific root identifier", default=None
    )

    evolution_parser = subparsers.add_parser(
        "evolution", help="View distilled self-evolution lessons learned from friction"
    )
    evolution_parser.add_argument("-n", "--limit", type=int, default=20, help="Number of lessons to display")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    subcommand = args.subcommand or "run"
    if not hasattr(args, "once"):
        args.once = False

    handlers = {
        "doctor": cmd_doctor,
        "init-config": cmd_init_config,
        "status": cmd_status,
        "dashboard": cmd_dashboard,
        "events": cmd_events,
        "plan": cmd_plan,
        "lineage": cmd_lineage,
        "evolution": cmd_evolution,
        "triage": cmd_triage,
        "skeptic": cmd_skeptic,
        "hitl": cmd_hitl,
        "escalations": cmd_hitl,
        "run": cmd_run,
    }

    handler = handlers.get(subcommand)
    if handler:
        return handler(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
