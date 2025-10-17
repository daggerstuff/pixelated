"""
Task assignment algorithms for MCP server.

This service provides intelligent task assignment strategies that consider
agent capabilities, current load, performance history, and task requirements.
"""


import random
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import structlog

from ..exceptions import ResourceNotFoundError
from ..models.agent import Agent, AgentStatus
from ..models.task import Task, TaskPriority

logger = structlog.get_logger(__name__)


class AssignmentStrategy(Enum):
    """Task assignment strategies."""

    ROUND_ROBIN = "round_robin"
    LEAST_LOADED = "least_loaded"
    PRIORITY_BASED = "priority_based"
    CAPABILITY_MATCH = "capability_match"
    RANDOM = "random"


@dataclass
class AssignmentScore:
    """Assignment score for an agent."""

    agent_id: str
    score: float
    factors: dict[str, Any]
    strategy: AssignmentStrategy


@dataclass
class AssignmentRecommendation:
    """Task assignment recommendation."""

    task_id: str
    recommended_agent_id: str | None
    scores: list[AssignmentScore]
    strategy_used: AssignmentStrategy
    reasoning: str


class TaskAssignmentService:
    """
    Intelligent task assignment service with multiple strategies.

    Provides sophisticated task assignment algorithms that consider
    agent capabilities, load, performance history, and task requirements.
    """

    def __init__(self):
        """Initialize task assignment service."""
        self.strategy_weights = {
            AssignmentStrategy.ROUND_ROBIN: 0.2,
            AssignmentStrategy.LEAST_LOADED: 0.3,
            AssignmentStrategy.PRIORITY_BASED: 0.2,
            AssignmentStrategy.CAPABILITY_MATCH: 0.25,
            AssignmentStrategy.RANDOM: 0.05
        }
        logger.info("TaskAssignmentService initialized")

    async def assign_task(
        self,
        task: Task,
        available_agents: list[Agent],
        strategy: AssignmentStrategy | None = None,
        agent_capacities: dict[str, dict[str, Any]] | None = None
    ) -> AssignmentRecommendation:
        """
        Assign task to best available agent using specified or default strategy.

        Args:
            task: Task to assign
            available_agents: List of available agents
            strategy: Optional assignment strategy override
            agent_capacities: Optional agent capacity information

        Returns:
            Assignment recommendation

        Raises:
            ValidationError: If assignment fails
            ResourceNotFoundError: If no suitable agent found
        """
        if not available_agents:
            raise ResourceNotFoundError("No available agents for task assignment")

        # Filter agents by basic requirements
        eligible_agents = self._filter_eligible_agents(task, available_agents)

        if not eligible_agents:
            raise ResourceNotFoundError("No eligible agents for task requirements")

        # Determine strategy to use
        effective_strategy = strategy or self._select_optimal_strategy(task, eligible_agents)

        # Get assignment scores
        scores = await self._calculate_assignment_scores(
            task, eligible_agents, effective_strategy, agent_capacities
        )

        # Select best agent
        if not scores:
            raise ResourceNotFoundError("No suitable agents found for assignment")

        best_score = max(scores, key=lambda x: x.score)
        recommended_agent_id = best_score.agent_id if best_score.score > 0 else None

        # Generate reasoning
        reasoning = self._generate_assignment_reasoning(task, best_score, effective_strategy)

        recommendation = AssignmentRecommendation(
            task_id=task.id,
            recommended_agent_id=recommended_agent_id,
            scores=scores,
            strategy_used=effective_strategy,
            reasoning=reasoning
        )

        logger.info(
            "Task assignment recommendation generated",
            task_id=task.id,
            recommended_agent_id=recommended_agent_id,
            strategy=effective_strategy.value,
            score=best_score.score
        )

        return recommendation

    async def get_assignment_scores(
        self,
        task: Task,
        agents: list[Agent],
        strategy: AssignmentStrategy,
        agent_capacities: dict[str, dict[str, Any]] | None = None
    ) -> list[AssignmentScore]:
        """
        Get assignment scores for all agents using specified strategy.

        Args:
            task: Task to assign
            agents: List of agents to score
            strategy: Assignment strategy to use
            agent_capacities: Optional agent capacity information

        Returns:
            List of assignment scores
        """
        return await self._calculate_assignment_scores(
            task, agents, strategy, agent_capacities
        )

    def _filter_eligible_agents(self, task: Task, agents: list[Agent]) -> list[Agent]:
        """
        Filter agents based on basic task requirements.

        Args:
            task: Task requirements
            agents: List of agents to filter

        Returns:
            List of eligible agents
        """
        eligible = []

        for agent in agents:
            # Check agent status
            if agent.status not in [AgentStatus.AVAILABLE, AgentStatus.BUSY]:
                continue

            # Check required capabilities
            if task.required_capabilities:
                agent_capabilities = {cap.name for cap in agent.capabilities}
                if not set(task.required_capabilities).issubset(agent_capabilities):
                    continue

            # Check memory requirements
            if task.memory_requirements_mb and agent.memory_limit_mb and task.memory_requirements_mb > agent.memory_limit_mb:
                continue

            # Check task type compatibility
            if task.task_type and agent.supported_task_types and task.task_type not in agent.supported_task_types:
                continue

            eligible.append(agent)

        return eligible

    def _select_optimal_strategy(
        self,
        task: Task,
        agents: list[Agent]
    ) -> AssignmentStrategy:
        """
        Select optimal assignment strategy based on task and agent characteristics.

        Args:
            task: Task to assign
            agents: Available agents

        Returns:
            Optimal assignment strategy
        """
        # High priority tasks -> Priority based or capability match
        if task.priority in [TaskPriority.HIGH, TaskPriority.CRITICAL]:
            if task.required_capabilities:
                return AssignmentStrategy.CAPABILITY_MATCH
            return AssignmentStrategy.PRIORITY_BASED

        # Tasks with specific requirements -> Capability match
        if task.required_capabilities or task.task_type:
            return AssignmentStrategy.CAPABILITY_MATCH

        # Large number of agents -> Round robin for fairness
        if len(agents) > 10:
            return AssignmentStrategy.ROUND_ROBIN

        # Default to least loaded for optimal resource utilization
        return AssignmentStrategy.LEAST_LOADED

    async def _calculate_assignment_scores(
        self,
        task: Task,
        agents: list[Agent],
        strategy: AssignmentStrategy,
        agent_capacities: dict[str, dict[str, Any]] | None = None
    ) -> list[AssignmentScore]:
        """
        Calculate assignment scores for all agents using specified strategy.

        Args:
            task: Task to assign
            agents: List of agents to score
            strategy: Assignment strategy to use
            agent_capacities: Optional agent capacity information

        Returns:
            List of assignment scores
        """
        scores = []

        for agent in agents:
            try:
                if strategy == AssignmentStrategy.ROUND_ROBIN:
                    score = self._score_round_robin(task, agent, agents)
                elif strategy == AssignmentStrategy.LEAST_LOADED:
                    score = await self._score_least_loaded(task, agent, agent_capacities)
                elif strategy == AssignmentStrategy.PRIORITY_BASED:
                    score = self._score_priority_based(task, agent)
                elif strategy == AssignmentStrategy.CAPABILITY_MATCH:
                    score = self._score_capability_match(task, agent)
                elif strategy == AssignmentStrategy.RANDOM:
                    score = self._score_random(task, agent)
                else:
                    score = AssignmentScore(
                        agent_id=agent.id,
                        score=0.0,
                        factors={"error": "Unknown strategy"},
                        strategy=strategy
                    )

                scores.append(score)

            except Exception as e:
                logger.warning(
                    "Failed to calculate assignment score",
                    agent_id=agent.id,
                    task_id=task.id,
                    strategy=strategy.value,
                    error=str(e)
                )
                scores.append(AssignmentScore(
                    agent_id=agent.id,
                    score=0.0,
                    factors={"error": str(e)},
                    strategy=strategy
                ))

        return scores

    def _score_round_robin(self, task: Task, agent: Agent, all_agents: list[Agent]) -> AssignmentScore:
        """
        Score agent using round-robin strategy.

        Args:
            task: Task to assign
            agent: Agent to score
            all_agents: All available agents

        Returns:
            Assignment score
        """
        # Simple round-robin based on agent ID hash
        agent_index = all_agents.index(agent)
        total_agents = len(all_agents)

        # Use task ID hash to determine current round-robin position
        task_hash = hash(task.id) % total_agents

        # Score based on proximity to round-robin position
        distance = abs(agent_index - task_hash)
        normalized_distance = distance / total_agents

        score = max(0.0, 1.0 - normalized_distance)

        factors = {
            "agent_index": agent_index,
            "task_hash": task_hash,
            "distance": distance,
            "total_agents": total_agents
        }

        return AssignmentScore(
            agent_id=agent.id,
            score=score,
            factors=factors,
            strategy=AssignmentStrategy.ROUND_ROBIN
        )

    async def _score_least_loaded(
        self,
        task: Task,
        agent: Agent,
        agent_capacities: dict[str, dict[str, Any]] | None
    ) -> AssignmentScore:
        """
        Score agent based on current load.

        Args:
            task: Task to assign
            agent: Agent to score
            agent_capacities: Agent capacity information

        Returns:
            Assignment score
        """
        if not agent_capacities or agent.id not in agent_capacities:
            # No capacity info, assume medium load
            score = 0.5
            factors = {"no_capacity_info": True}
        else:
            capacity = agent_capacities[agent.id]
            current_tasks = capacity.get("current_tasks", 0)
            max_tasks = capacity.get("max_tasks", 1)
            available_slots = capacity.get("available_slots", 0)

            if max_tasks == 0:
                score = 0.0
            else:
                load_ratio = current_tasks / max_tasks
                score = max(0.0, 1.0 - load_ratio)

            factors = {
                "current_tasks": current_tasks,
                "max_tasks": max_tasks,
                "available_slots": available_slots,
                "load_ratio": load_ratio if max_tasks > 0 else 1.0
            }

        return AssignmentScore(
            agent_id=agent.id,
            score=score,
            factors=factors,
            strategy=AssignmentStrategy.LEAST_LOADED
        )

    def _score_priority_based(self, task: Task, agent: Agent) -> AssignmentScore:
        """
        Score agent based on priority handling capabilities.

        Args:
            task: Task to assign
            agent: Agent to score

        Returns:
            Assignment score
        """
        # Find the agent capability for priority handling explicitly (avoid walrus for clarity)
        priority_capability = next(
            (cap for cap in agent.capabilities if cap.name == "priority_handling"),
            None,
        )

        if priority_capability is not None:
            # Score based on priority level match with defensive checks
            priority_level = getattr(task.priority, "value", None)
            capability_level = getattr(priority_capability, "level", None)

            # Default fallback values and safety
            capability_match = False
            try:
                if priority_level is None or capability_level is None:
                    # Missing data -> conservative score
                    score = 0.0
                else:
                    # Normalize to floats and avoid division by zero
                    priority_level = float(priority_level)
                    capability_level = float(capability_level)

                    if priority_level == 0:
                        # If task priority level is zero (unexpected), prefer higher capability
                        score = 1.0 if capability_level >= priority_level else 0.0
                    else:
                        score = 1.0 if capability_level >= priority_level else capability_level / priority_level

                    capability_match = capability_level >= priority_level
            except Exception:
                # Any unexpected type/error -> conservative fallback
                score = 0.0
                capability_match = False

            factors = {
                "task_priority": getattr(task.priority, "name", None),
                "task_priority_level": priority_level,
                "agent_priority_level": capability_level,
                "capability_match": capability_match,
            }

        else:
            score = 0.3  # Basic score for agents without priority handling
            factors = {"no_priority_capability": True}
        return AssignmentScore(
            agent_id=agent.id,
            score=score,
            factors=factors,
            strategy=AssignmentStrategy.PRIORITY_BASED
        )

    def _score_capability_match(self, task: Task, agent: Agent) -> AssignmentScore:
        """
        Score agent based on capability match.

        Args:
            task: Task to assign
            agent: Agent to score

        Returns:
            Assignment score
        """
        if not task.required_capabilities:
            # No specific requirements, basic score
            score = 0.7
            factors = {"no_requirements": True}
        else:
            agent_capabilities = {cap.name: cap.level for cap in agent.capabilities}

            total_requirements = len(task.required_capabilities)
            matched_requirements = 0
            total_match_score = 0

            capability_scores = {}

            for req_capability in task.required_capabilities:
                if req_capability in agent_capabilities:
                    matched_requirements += 1
                    # Score based on capability level match
                    agent_level = agent_capabilities[req_capability]
                    match_score = min(1.0, agent_level / 10.0)  # Normalize to 0-1
                    total_match_score += match_score
                    capability_scores[req_capability] = {
                        "agent_level": agent_level,
                        "match_score": match_score
                    }
                else:
                    capability_scores[req_capability] = {
                        "agent_level": 0,
                        "match_score": 0
                    }

            if total_requirements > 0:
                score = total_match_score / total_requirements
            else:
                score = 0.0

            factors = {
                "total_requirements": total_requirements,
                "matched_requirements": matched_requirements,
                "match_ratio": matched_requirements / total_requirements if total_requirements > 0 else 0,
                "capability_scores": capability_scores
            }

        return AssignmentScore(
            agent_id=agent.id,
            score=score,
            factors=factors,
            strategy=AssignmentStrategy.CAPABILITY_MATCH
        )

    def _score_random(self, task: Task, agent: Agent) -> AssignmentScore:
        """
        Score agent randomly (for load testing or fallback).

        Args:
            task: Task to assign
            agent: Agent to score

        Returns:
            Assignment score
        """
        score = random.random()

        factors = {
            "random_score": score,
            "task_id": task.id,
            "agent_id": agent.id
        }

        return AssignmentScore(
            agent_id=agent.id,
            score=score,
            factors=factors,
            strategy=AssignmentStrategy.RANDOM
        )

    def _generate_assignment_reasoning(
        self,
        task: Task,
        best_score: AssignmentScore,
        strategy: AssignmentStrategy
    ) -> str:
        """
        Generate human-readable reasoning for assignment decision.

        Args:
            task: Task being assigned
            best_score: Best assignment score
            strategy: Strategy used

        Returns:
            Reasoning string
        """
        agent_id = best_score.agent_id
        score = best_score.score

        if score <= 0:
            return "No suitable agent found for task requirements"

        strategy_name = strategy.value.replace("_", " ").title()

        if strategy == AssignmentStrategy.CAPABILITY_MATCH:
            matched = best_score.factors.get("matched_requirements", 0)
            total = best_score.factors.get("total_requirements", 0)
            return f"Agent {agent_id} selected based on capability match ({matched}/{total} requirements met)"

        if strategy == AssignmentStrategy.LEAST_LOADED:
            load_ratio = best_score.factors.get("load_ratio", 0)
            available_slots = best_score.factors.get("available_slots", 0)
            return f"Agent {agent_id} selected as least loaded (load: {load_ratio:.1%}, available: {available_slots} slots)"

        if strategy == AssignmentStrategy.PRIORITY_BASED:
            priority_match = best_score.factors.get("capability_match", False)
            return f"Agent {agent_id} selected based on priority handling capability (match: {priority_match})"

        if strategy == AssignmentStrategy.ROUND_ROBIN:
            distance = best_score.factors.get("distance", 0)
            return f"Agent {agent_id} selected using round-robin strategy (distance: {distance})"

        return f"Agent {agent_id} selected using {strategy_name} strategy (score: {score:.2f})"


class AssignmentHistoryTracker:
    """
    Track assignment history for optimization and analysis.
    """

    def __init__(self):
        """Initialize assignment history tracker."""
        self.assignment_history: list[dict[str, Any]] = []
        logger.info("AssignmentHistoryTracker initialized")

    def record_assignment(
        self,
        task_id: str,
        agent_id: str,
        strategy: AssignmentStrategy,
        score: float,
        success: bool,
        execution_time_seconds: float | None = None
    ) -> None:
        """
        Record task assignment outcome.

        Args:
            task_id: Task ID
            agent_id: Agent ID
            strategy: Assignment strategy used
            score: Assignment score
            success: Whether assignment was successful
            execution_time_seconds: Optional execution time
        """
        record = {
            "task_id": task_id,
            "agent_id": agent_id,
            "strategy": strategy.value,
            "score": score,
            "success": success,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "execution_time_seconds": execution_time_seconds,
        }

        self.assignment_history.append(record)

        # Keep only recent history (last 1000 assignments)
        if len(self.assignment_history) > 1000:
            self.assignment_history = self.assignment_history[-1000:]

        logger.info(
            "Assignment recorded",
            task_id=task_id,
            agent_id=agent_id,
            strategy=strategy.value,
            success=success,
            score=score
        )

    def get_agent_performance_stats(self, agent_id: str) -> dict[str, Any]:
        """
        Get performance statistics for an agent.

        Args:
            agent_id: Agent ID

        Returns:
            Performance statistics
        """
        agent_assignments = [
            record for record in self.assignment_history
            if record["agent_id"] == agent_id
        ]

        if not agent_assignments:
            return {
                "total_assignments": 0,
                "successful_assignments": 0,
                "success_rate": 0.0,
                "average_score": 0.0,
                "average_execution_time": None
            }

        total_assignments = len(agent_assignments)
        successful_assignments = sum(bool(record["success"])
                                 for record in agent_assignments)
        success_rate = successful_assignments / total_assignments if total_assignments > 0 else 0

        scores = [record["score"] for record in agent_assignments if record["score"] is not None]
        average_score = sum(scores) / len(scores) if scores else 0.0

        execution_times = [
            record["execution_time_seconds"] for record in agent_assignments
            if record["execution_time_seconds"] is not None
        ]
        average_execution_time = (
            sum(execution_times) / len(execution_times) if execution_times else None
        )

        return {
            "total_assignments": total_assignments,
            "successful_assignments": successful_assignments,
            "success_rate": success_rate,
            "average_score": average_score,
            "average_execution_time": average_execution_time
        }

    def get_strategy_effectiveness(self) -> dict[str, Any]:
        """
        Get effectiveness statistics for each assignment strategy.

        Returns:
            Strategy effectiveness statistics
        """
        strategy_stats = {}

        for strategy in AssignmentStrategy:
            strategy_assignments = [
                record for record in self.assignment_history
                if record["strategy"] == strategy.value
            ]

            if not strategy_assignments:
                strategy_stats[strategy.value] = {
                    "total_assignments": 0,
                    "successful_assignments": 0,
                    "success_rate": 0.0,
                    "average_score": 0.0
                }
                continue

            total_assignments = len(strategy_assignments)
            successful_assignments = sum(bool(record["success"])
                                     for record in strategy_assignments)
            success_rate = successful_assignments / total_assignments if total_assignments > 0 else 0

            scores = [record["score"] for record in strategy_assignments if record["score"] is not None]
            average_score = sum(scores) / len(scores) if scores else 0.0

            strategy_stats[strategy.value] = {
                "total_assignments": total_assignments,
                "successful_assignments": successful_assignments,
                "success_rate": success_rate,
                "average_score": average_score
            }

        return strategy_stats


# Backwards-compatible singleton helpers
_assignment_service: TaskAssignmentService | None = None


def init_assignment_service(service: TaskAssignmentService | None = None) -> None:
    """Initialize or override the global TaskAssignmentService instance.

    Other modules import get_assignment_service() and expect a callable
    to return a ready-to-use service. Provide a simple initializer here so
    tests and runtime code can opt into a shared instance.
    """
    global _assignment_service
    _assignment_service = TaskAssignmentService() if service is None else service


def get_assignment_service() -> TaskAssignmentService:
    """Return the shared TaskAssignmentService instance, creating a default
    one if necessary.
    """
    global _assignment_service
    if _assignment_service is None:
        init_assignment_service()
    return _assignment_service
