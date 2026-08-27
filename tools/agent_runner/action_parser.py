"""Action protocol parser extracting commands from agent CLI markdown responses."""

from __future__ import annotations

import logging
import re

from tools.agent_runner.models import ActionType, ParsedAction

logger = logging.getLogger("agent_runner.parser")


class ActionParser:
    """Parses agent markdown responses for action directives in exact line-by-line order."""

    @staticmethod
    def _parse_create_ticket(line: str) -> ParsedAction | None:
        body = re.sub(r"^CREATE\s+TICKET:\s*", "", line, flags=re.IGNORECASE)
        parts = [p.strip() for p in body.split("|") if p.strip()]
        if len(parts) < 2:
            return None

        title = parts[0]
        desc = parts[1]
        labels: list[str] = []
        priority = 2
        target_agent = None

        for extra in parts[2:]:
            extra_lower = extra.lower()
            if extra_lower.startswith("labels:"):
                raw_lbls = extra.split(":", 1)[1].strip()
                labels = [lbl.strip() for lbl in raw_lbls.split(",") if lbl.strip()]
            elif extra_lower.startswith("priority:"):
                raw_prio = extra.split(":", 1)[1].strip()
                try:
                    priority = int(raw_prio)
                except ValueError:
                    priority = 2
            elif extra_lower.startswith("agent:"):
                target_agent = extra.split(":", 1)[1].strip()

        return ParsedAction(
            action_type=ActionType.CREATE_TICKET,
            title=title,
            content=desc,
            labels=labels,
            priority=priority,
            target_agent=target_agent,
        )

    @staticmethod
    def _parse_subtask(line: str) -> ParsedAction | None:
        body = re.sub(r"^SUBTASK:\s*", "", line, flags=re.IGNORECASE)
        parts = [p.strip() for p in body.split("|", 1)]
        return (
            ParsedAction(action_type=ActionType.SUBTASK, title=parts[0], content=parts[1]) if len(parts) >= 2 else None
        )

    @staticmethod
    def _parse_delegate(line: str) -> ParsedAction | None:
        body = re.sub(r"^DELEGATE:\s*", "", line, flags=re.IGNORECASE)
        parts = [p.strip() for p in body.split("|", 1)]
        return (
            ParsedAction(
                action_type=ActionType.DELEGATE,
                title=f"Delegation to {parts[0]}",
                content=parts[1],
                target_agent=parts[0],
            )
            if len(parts) >= 2
            else None
        )

    @staticmethod
    def _parse_store_memory(line: str) -> ParsedAction | None:
        body = re.sub(r"^STORE\s+MEMORY:\s*", "", line, flags=re.IGNORECASE)
        parts = [p.strip() for p in body.split("|", 1)]
        return (
            ParsedAction(action_type=ActionType.STORE_MEMORY, title=parts[0], content=parts[1])
            if len(parts) >= 2
            else None
        )

    @staticmethod
    def _parse_broadcast(line: str) -> ParsedAction:
        msg = re.sub(r"^BROADCAST:\s*", "", line, flags=re.IGNORECASE).strip()
        return ParsedAction(action_type=ActionType.BROADCAST, title="Broadcast Message", content=msg)

    @staticmethod
    def _parse_propose(line: str) -> ParsedAction | None:
        body = re.sub(r"^PROPOSE:\s*", "", line, flags=re.IGNORECASE)
        parts = [p.strip() for p in body.split("|", 1)]
        return (
            ParsedAction(action_type=ActionType.PROPOSE, title=parts[0], content=parts[1]) if len(parts) >= 2 else None
        )

    @staticmethod
    def _parse_vote(line: str) -> ParsedAction | None:
        body = re.sub(r"^VOTE:\s*", "", line, flags=re.IGNORECASE)
        parts = [p.strip() for p in body.split("|")]
        return (
            ParsedAction(
                action_type=ActionType.VOTE,
                title=parts[0],
                content=parts[2],
                extra={"decision": parts[1].upper()},
            )
            if len(parts) >= 3
            else None
        )

    @staticmethod
    def _parse_result(line: str) -> ParsedAction:
        summary = re.sub(r"^RESULT:\s*", "", line, flags=re.IGNORECASE).strip()
        return ParsedAction(action_type=ActionType.RESULT, title="Result Summary", content=summary)

    @classmethod
    def parse_actions(cls, text: str) -> list[ParsedAction]:
        """Extract structured actions from agent output preserving text appearance order."""
        actions: list[ParsedAction] = []
        if not text:
            return actions

        for line in text.splitlines():
            clean = line.strip()
            if not clean:
                continue

            parsed: ParsedAction | None = None
            if re.match(r"^CREATE\s+TICKET:", clean, re.IGNORECASE):
                parsed = cls._parse_create_ticket(clean)
            elif re.match(r"^SUBTASK:", clean, re.IGNORECASE):
                parsed = cls._parse_subtask(clean)
            elif re.match(r"^DELEGATE:", clean, re.IGNORECASE):
                parsed = cls._parse_delegate(clean)
            elif re.match(r"^STORE\s+MEMORY:", clean, re.IGNORECASE):
                parsed = cls._parse_store_memory(clean)
            elif re.match(r"^BROADCAST:", clean, re.IGNORECASE):
                parsed = cls._parse_broadcast(clean)
            elif re.match(r"^PROPOSE:", clean, re.IGNORECASE):
                parsed = cls._parse_propose(clean)
            elif re.match(r"^VOTE:", clean, re.IGNORECASE):
                parsed = cls._parse_vote(clean)
            elif re.match(r"^RESULT:", clean, re.IGNORECASE):
                parsed = cls._parse_result(clean)

            if parsed:
                actions.append(parsed)

        return actions
