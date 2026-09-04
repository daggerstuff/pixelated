#!/usr/bin/env python3
"""
Advanced Training Scenarios for Cultural Competency and Trauma-Informed Care

This module provides comprehensive training scenarios focused on:
- Cultural competency across diverse populations
- Trauma-informed care principles
- Intersectionality and bias awareness
- LGBTQ+ inclusive healthcare
- Indigenous health perspectives
- Disability-inclusive care
- Language access and communication barriers

Features:
- Scenario-based learning with branching narratives
- Real-time feedback and assessment
- Cultural context simulation
- Trauma-informed response training
- Intersectionality analysis
- Performance tracking and analytics
"""

import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Any, cast
from uuid import uuid4

# Import existing components
from bias_detection.sentry_metrics import track_latency, training_metrics

from .scenario_catalog import (
    CulturalCompetencyScenarios,
    LGBTQInclusiveScenarios,
    TraumaInformedScenarios,
)
from .scenario_types import (
    AdvancedTrainingScenario,
    DifficultyLevel,
    TrainingMetricsAdvanced,
    TrainingType,
)

logger = logging.getLogger(__name__)


class AdvancedTrainingEngine:
    """Main engine for advanced training scenarios"""

    def __init__(self):
        self.cultural_scenarios = CulturalCompetencyScenarios()
        self.trauma_scenarios = TraumaInformedScenarios()
        self.lgbtq_scenarios = LGBTQInclusiveScenarios()
        self.training_metrics = TrainingMetricsAdvanced()
        self.active_sessions: dict[str, Any] = {}

    def get_all_scenarios(self) -> list[AdvancedTrainingScenario]:
        """Get all available scenarios"""
        all_scenarios = []
        all_scenarios.extend(self.cultural_scenarios.scenarios)
        all_scenarios.extend(self.trauma_scenarios.scenarios)
        all_scenarios.extend(self.lgbtq_scenarios.scenarios)
        return all_scenarios

    def get_scenarios_by_type(self, training_type: TrainingType) -> list[AdvancedTrainingScenario]:
        """Get scenarios by training type"""
        all_scenarios = self.get_all_scenarios()
        return [s for s in all_scenarios if s.training_type == training_type]

    def get_scenarios_by_difficulty(self, difficulty: DifficultyLevel) -> list[AdvancedTrainingScenario]:
        """Get scenarios by difficulty level"""
        all_scenarios = self.get_all_scenarios()
        return [s for s in all_scenarios if s.difficulty == difficulty]

    @track_latency("training.advanced_scenario_start")
    async def start_advanced_training_session(
        self, user_id: str, training_type: TrainingType, difficulty: DifficultyLevel, scenario_id: str | None = None
    ) -> dict[str, Any]:
        """Start an advanced training session"""

        # Select scenario
        if scenario_id:
            scenario = self._get_scenario_by_id(scenario_id)
        else:
            scenarios = self.get_scenarios_by_type(training_type)
            scenarios = [s for s in scenarios if s.difficulty == difficulty]
            scenario = random.choice(scenarios) if scenarios else None

        if not scenario:
            return {"error": "No suitable scenario found"}

        # Create session
        session_id = f"advanced_{uuid4().hex[:8]}"
        session_data = {
            "session_id": session_id,
            "user_id": user_id,
            "scenario": scenario,
            "start_time": datetime.now(timezone.utc),
            "responses": [],
            "current_branch": scenario.scenario_id,
            "metrics": {
                "cultural_competency": [],
                "trauma_informed": [],
                "bias_awareness": [],
                "communication": [],
                "empathy": [],
            },
        }

        self.active_sessions[session_id] = session_data

        logger.info(f"Advanced training session started: {session_id} for user {user_id}")

        return {
            "session_id": session_id,
            "scenario": scenario,
            "setup": scenario.scenario_setup,
            "learning_objectives": scenario.learning_objectives,
            "cultural_context": scenario.cultural_context,
            "trauma_context": scenario.trauma_context,
            "intersectionality_profile": scenario.intersectionality_profile,
        }

    def _get_scenario_by_id(self, scenario_id: str) -> AdvancedTrainingScenario | None:
        """Get scenario by ID from all collections"""
        scenario = self.cultural_scenarios.get_scenario_by_id(scenario_id)
        if scenario:
            return scenario

        scenario = self.trauma_scenarios.get_scenario_by_id(scenario_id)
        if scenario:
            return scenario

        return self.lgbtq_scenarios.get_scenario_by_id(scenario_id)

    @track_latency("training.advanced_response_process")
    async def process_training_response(
        self, session_id: str, user_response: str, response_type: str = "verbal"
    ) -> dict[str, Any]:
        """Process user response to training scenario"""

        if session_id not in self.active_sessions:
            return {"error": "Session not found"}

        session_data = self.active_sessions[session_id]
        scenario = session_data["scenario"]

        # Analyze response
        analysis = await self._analyze_training_response(user_response, scenario)

        # Update session data
        session_data["responses"].append(
            {
                "response": user_response,
                "type": response_type,
                "analysis": analysis,
                "timestamp": datetime.now(timezone.utc),
            }
        )

        # Update metrics
        self._update_training_metrics(analysis, session_data)

        # Determine next steps
        next_action = self._determine_next_action(analysis, scenario, session_data)

        logger.info(f"Training response processed for session {session_id}")

        return {
            "analysis": analysis,
            "next_action": next_action,
            "feedback": analysis.get("feedback", ""),
            "learning_points": analysis.get("learning_points", []),
            "cultural_insights": analysis.get("cultural_insights", []),
            "trauma_considerations": analysis.get("trauma_considerations", []),
        }

    async def _analyze_training_response(
        self, user_response: str, scenario: AdvancedTrainingScenario
    ) -> dict[str, Any]:
        """Analyze training response for cultural competency and trauma-informed care"""

        analysis = {
            "cultural_competency_score": 0.0,
            "trauma_informed_score": 0.0,
            "bias_awareness_score": 0.0,
            "communication_effectiveness": 0.0,
            "empathy_demonstration": 0.0,
            "appropriateness_score": 0.0,
            "feedback": "",
            "learning_points": [],
            "cultural_insights": [],
            "trauma_considerations": [],
            "positive_aspects": [],
            "missed_opportunities": [],
            "improvement_suggestions": [],
        }

        # Analyze based on scenario type
        if scenario.training_type == TrainingType.CULTURAL_COMPETENCY:
            analysis.update(await self._analyze_cultural_response(user_response))
        elif scenario.training_type == TrainingType.TRAUMA_INFORMED:
            analysis.update(await self._analyze_trauma_response(user_response))
        elif scenario.training_type == TrainingType.LGBTQ_INCLUSIVE:
            analysis.update(await self._analyze_lgbtq_response(user_response))

        # Calculate overall scores
        analysis["appropriateness_score"] = (
            analysis["cultural_competency_score"] * 0.3
            + analysis["trauma_informed_score"] * 0.3
            + analysis["bias_awareness_score"] * 0.2
            + analysis["communication_effectiveness"] * 0.2
        )

        # Generate feedback
        analysis["feedback"] = self._generate_feedback(analysis, scenario)  # type: ignore

        return analysis

    async def _analyze_cultural_response(self, response: str) -> dict[str, Any]:
        """Analyze cultural competency response"""

        response_lower = response.lower()

        scores: dict[str, Any] = {
            "cultural_competency_score": 0.0,
            "bias_awareness_score": 0.0,
            "communication_effectiveness": 0.0,
            "empathy_demonstration": 0.0,
        }

        # Check for cultural sensitivity indicators
        positive_indicators = 0
        negative_indicators = 0

        # Language sensitivity
        if any(lang in response_lower for lang in ["language", "translator", "interpreter"]):
            positive_indicators += 1
            scores["cultural_competency_score"] += 0.2

        # Family involvement
        if any(fam in response_lower for fam in ["family", "cultural", "traditional"]):
            positive_indicators += 1
            scores["cultural_competency_score"] += 0.2

        # Respect for cultural practices
        if any(respect in response_lower for respect in ["respect", "understand", "cultural"]):
            positive_indicators += 1
            scores["cultural_competency_score"] += 0.2

        # Avoid stereotypes
        if any(stereo in response_lower for stereo in ["stereotype", "generalize", "assume"]):
            negative_indicators += 1
            scores["bias_awareness_score"] -= 0.1

        # Calculate final scores
        scores["cultural_competency_score"] = min(
            1.0, scores["cultural_competency_score"] + (positive_indicators * 0.1)
        )
        scores["bias_awareness_score"] = max(
            0.0, scores["bias_awareness_score"] + (positive_indicators * 0.1) - (negative_indicators * 0.1)
        )
        scores["communication_effectiveness"] = scores["cultural_competency_score"] * 0.8
        scores["empathy_demonstration"] = scores["cultural_competency_score"] * 0.9

        # Generate learning points
        learning_points = []
        if positive_indicators > 0:
            learning_points.extend(
                [
                    "Cultural sensitivity demonstrated",
                    "Respect for cultural practices shown",
                    "Awareness of cultural factors evident",
                ]
            )

        if negative_indicators > 0:
            learning_points.extend(
                ["Be cautious of stereotypes", "Cultural humility is important", "Individual variation within cultures"]
            )

        scores["learning_points"] = learning_points
        scores["cultural_insights"] = [
            "Cultural competency requires ongoing learning",
            "Individual experiences vary within cultures",
            "Cultural humility is essential",
        ]

        return scores

    async def _analyze_trauma_response(self, response: str) -> dict[str, Any]:
        """Analyze trauma-informed response"""

        response_lower = response.lower()

        scores: dict[str, Any] = {
            "trauma_informed_score": 0.0,
            "cultural_competency_score": 0.0,
            "bias_awareness_score": 0.0,
            "communication_effectiveness": 0.0,
            "empathy_demonstration": 0.0,
        }

        # Check for trauma-informed indicators
        safety_indicators = 0
        choice_indicators = 0
        empowerment_indicators = 0

        # Safety focus
        if any(safety in response_lower for safety in ["safe", "safety", "comfortable", "secure"]):
            safety_indicators += 1
            scores["trauma_informed_score"] += 0.3

        # Choice and control
        if any(choice in response_lower for choice in ["choice", "control", "decide", "option"]):
            choice_indicators += 1
            scores["trauma_informed_score"] += 0.3

        # Empowerment
        if any(empower in response_lower for empower in ["empower", "strength", "resilience", "capable"]):
            empowerment_indicators += 1
            scores["trauma_informed_score"] += 0.2

        # Avoid trauma triggers
        if any(trigger in response_lower for trigger in ["gentle", "slow", "respect", "understand"]):
            scores["trauma_informed_score"] += 0.2

        # Calculate final scores
        scores["trauma_informed_score"] = min(1.0, scores["trauma_informed_score"])
        scores["cultural_competency_score"] = scores["trauma_informed_score"] * 0.8
        scores["bias_awareness_score"] = scores["trauma_informed_score"] * 0.7
        scores["communication_effectiveness"] = scores["trauma_informed_score"] * 0.9
        scores["empathy_demonstration"] = scores["trauma_informed_score"] * 0.95

        # Generate learning points
        learning_points = []
        if safety_indicators > 0:
            learning_points.append("Safety focus demonstrated")
        if choice_indicators > 0:
            learning_points.append("Choice and control emphasized")
        if empowerment_indicators > 0:
            learning_points.append("Empowerment approach shown")

        scores["learning_points"] = learning_points
        scores["trauma_considerations"] = [
            "Safety is paramount in trauma-informed care",
            "Choice restores power to trauma survivors",
            "Empowerment promotes healing",
            "Avoiding triggers prevents re-traumatization",
        ]

        return scores

    async def _analyze_lgbtq_response(self, response: str) -> dict[str, Any]:
        """Analyze LGBTQ+ inclusive response"""

        response_lower = response.lower()

        scores: dict[str, Any] = {
            "cultural_competency_score": 0.0,
            "trauma_informed_score": 0.0,
            "bias_awareness_score": 0.0,
            "communication_effectiveness": 0.0,
            "empathy_demonstration": 0.0,
        }

        # Check for LGBTQ+ inclusive indicators
        inclusive_language = 0
        affirmation_indicators = 0
        respect_indicators = 0

        # Pronoun respect
        if any(pronoun in response_lower for pronoun in ["pronoun", "he/him", "she/her", "they/them"]):
            inclusive_language += 1
            scores["cultural_competency_score"] += 0.3

        # Gender-affirming language
        if any(affirm in response_lower for affirm in ["affirm", "support", "validate", "respect"]):
            affirmation_indicators += 1
            scores["cultural_competency_score"] += 0.3

        # Avoid assumptions
        if any(respect in response_lower for respect in ["respect", "understand", "listen", "ask"]):
            respect_indicators += 1
            scores["bias_awareness_score"] += 0.2

        # Calculate final scores
        scores["cultural_competency_score"] = min(1.0, scores["cultural_competency_score"])
        scores["trauma_informed_score"] = scores["cultural_competency_score"] * 0.8
        scores["bias_awareness_score"] = min(1.0, scores["bias_awareness_score"] + (respect_indicators * 0.1))
        scores["communication_effectiveness"] = scores["cultural_competency_score"] * 0.9
        scores["empathy_demonstration"] = scores["cultural_competency_score"] * 0.95

        # Generate learning points
        learning_points = []
        if inclusive_language > 0:
            learning_points.append("Inclusive language used")
        if affirmation_indicators > 0:
            learning_points.append("Affirming approach demonstrated")
        if respect_indicators > 0:
            learning_points.append("Respectful questioning shown")

        scores["learning_points"] = learning_points
        scores["cultural_insights"] = [
            "LGBTQ+ identities deserve respect and affirmation",
            "Inclusive language creates safety",
            "Cultural humility is essential",
            "Intersectionality matters in LGBTQ+ care",
        ]

        return scores

    def _update_training_metrics(self, analysis: dict[str, Any], session_data: dict[str, Any]) -> None:
        """Update training metrics"""

        # Update session metrics
        for metric in session_data["metrics"]:
            if metric in analysis and isinstance(analysis[metric], (int, float)):
                session_data["metrics"][metric].append(analysis[metric])

        # Update global metrics
        self.training_metrics.cultural_competency_scores.extend(session_data["metrics"]["cultural_competency"])
        self.training_metrics.trauma_informed_scores.extend(session_data["metrics"]["trauma_informed"])
        self.training_metrics.bias_awareness_scores.extend(session_data["metrics"]["bias_awareness"])
        self.training_metrics.communication_effectiveness_scores.extend(session_data["metrics"]["communication"])
        self.training_metrics.empathy_scores.extend(session_data["metrics"]["empathy"])

        # Track metrics
        training_metrics.cultural_competency_score(analysis.get("cultural_competency_score", 0))
        training_metrics.trauma_informed_score(analysis.get("trauma_informed_score", 0))
        training_metrics.bias_awareness_score(analysis.get("bias_awareness_score", 0))

    def _determine_next_action(
        self, analysis: dict[str, Any], scenario: AdvancedTrainingScenario, session_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Determine next action based on analysis"""

        # Check if scenario should branch
        for branch in scenario.branching_paths:
            if self._evaluate_branch_condition(branch.condition, analysis, session_data):  # type: ignore
                return {
                    "action": "branch",
                    "branch_id": branch.branch_id,
                    "next_scenario_id": branch.next_scenario_id,
                    "feedback": branch.feedback,
                    "learning_points": branch.learning_points,
                    "cultural_insights": branch.cultural_insights,
                    "trauma_considerations": branch.trauma_considerations,
                }

        # Check if scenario is complete
        if len(session_data["responses"]) >= 3:  # Minimum 3 interactions
            return {"action": "complete", "final_assessment": self._generate_final_assessment(session_data)}

        # Continue with current scenario
        return {"action": "continue", "suggestions": analysis.get("improvement_suggestions", [])}

    def _evaluate_branch_condition(self, condition: str, analysis: dict[str, Any]) -> bool:
        """Evaluate branching condition"""

        # Simple condition evaluation based on scores
        if ("respect" in condition.lower() and analysis.get("cultural_competency_score", 0) > 0.7) or (
            "trauma" in condition.lower() and analysis.get("trauma_informed_score", 0) > 0.7
        ):
            return True
        return "insensitive" in condition.lower() and analysis.get("cultural_competency_score", 0) < 0.4

    def _generate_feedback(self, analysis: dict[str, Any]) -> str:
        """Generate contextual feedback"""

        scores = {
            "cultural": analysis.get("cultural_competency_score", 0),
            "trauma": analysis.get("trauma_informed_score", 0),
            "bias": analysis.get("bias_awareness_score", 0),
            "communication": analysis.get("communication_effectiveness", 0),
            "empathy": analysis.get("empathy_demonstration", 0),
        }

        # Generate feedback based on scores
        feedback_parts = []

        if scores["cultural"] > 0.8:
            feedback_parts.append("Excellent cultural competency demonstrated!")
        elif scores["cultural"] > 0.6:
            feedback_parts.append("Good cultural awareness shown.")
        else:
            feedback_parts.append("Consider cultural factors more deeply.")

        if scores["trauma"] > 0.8:
            feedback_parts.append("Outstanding trauma-informed care!")
        elif scores["trauma"] > 0.6:
            feedback_parts.append("Good trauma sensitivity.")
        else:
            feedback_parts.append("Focus on trauma-informed principles.")

        if scores["bias"] > 0.7:
            feedback_parts.append("Strong bias awareness.")
        else:
            feedback_parts.append("Watch for potential biases.")

        return " ".join(feedback_parts)

    def _generate_final_assessment(self, session_data: dict[str, Any]) -> dict[str, Any]:
        """Generate final assessment for completed session"""

        metrics = session_data["metrics"]

        # Calculate average scores
        avg_scores = {}
        for metric, scores in metrics.items():
            if scores:
                avg_scores[metric] = sum(scores) / len(scores)
            else:
                avg_scores[metric] = 0.0

        # Determine overall performance
        overall_score = (
            avg_scores.get("cultural_competency", 0) * 0.3
            + avg_scores.get("trauma_informed", 0) * 0.3
            + avg_scores.get("bias_awareness", 0) * 0.2
            + avg_scores.get("communication", 0) * 0.1
            + avg_scores.get("empathy", 0) * 0.1
        )

        # Performance level
        if overall_score >= 0.8:
            performance_level = "Excellent"
        elif overall_score >= 0.6:
            performance_level = "Good"
        elif overall_score >= 0.4:
            performance_level = "Needs Improvement"
        else:
            performance_level = "Requires Significant Development"

        return {
            "overall_score": overall_score,
            "performance_level": performance_level,
            "detailed_scores": avg_scores,
            "strengths": self._identify_strengths(avg_scores),
            "areas_for_improvement": self._identify_improvements(avg_scores),
            "recommendations": self._generate_recommendations(avg_scores),
        }

    def _identify_strengths(self, scores: dict[str, float]) -> list[str]:
        """Identify performance strengths"""
        strengths = []

        if scores.get("cultural_competency", 0) > 0.8:
            strengths.append("Cultural competency")
        if scores.get("trauma_informed", 0) > 0.8:
            strengths.append("Trauma-informed care")
        if scores.get("bias_awareness", 0) > 0.8:
            strengths.append("Bias awareness")
        if scores.get("communication", 0) > 0.8:
            strengths.append("Communication effectiveness")
        if scores.get("empathy", 0) > 0.8:
            strengths.append("Empathy demonstration")

        return strengths

    def _identify_improvements(self, scores: dict[str, float]) -> list[str]:
        """Identify areas for improvement"""
        improvements = []

        if scores.get("cultural_competency", 0) < 0.6:
            improvements.append("Cultural competency development")
        if scores.get("trauma_informed", 0) < 0.6:
            improvements.append("Trauma-informed care training")
        if scores.get("bias_awareness", 0) < 0.6:
            improvements.append("Bias awareness enhancement")
        if scores.get("communication", 0) < 0.6:
            improvements.append("Communication skills development")
        if scores.get("empathy", 0) < 0.6:
            improvements.append("Empathy building")

        return improvements

    def _generate_recommendations(self, scores: dict[str, float]) -> list[str]:
        """Generate improvement recommendations"""
        recommendations = []

        if scores.get("cultural_competency", 0) < 0.6:
            recommendations.extend(
                [
                    "Complete cultural competency training modules",
                    "Study specific cultural health practices",
                    "Practice cultural humility exercises",
                ]
            )

        if scores.get("trauma_informed", 0) < 0.6:
            recommendations.extend(
                [
                    "Review trauma-informed care principles",
                    "Practice safety and choice techniques",
                    "Study trauma survivor experiences",
                ]
            )

        if scores.get("bias_awareness", 0) < 0.6:
            recommendations.extend(
                [
                    "Complete implicit bias training",
                    "Practice bias recognition exercises",
                    "Study intersectionality concepts",
                ]
            )

        return recommendations

    async def complete_training_session(self, session_id: str) -> dict[str, Any]:
        """Complete training session and generate final report"""

        if session_id not in self.active_sessions:
            return {"error": "Session not found"}

        session_data = self.active_sessions[session_id]

        # Generate final assessment
        final_assessment = self._generate_final_assessment(session_data)

        # Calculate session duration
        duration = (datetime.now(timezone.utc) - session_data["start_time"]).total_seconds() / 60

        # Create completion report
        completion_report = {
            "session_id": session_id,
            "user_id": session_data["user_id"],
            "scenario": session_data["scenario"].scenario_id,
            "duration_minutes": duration,
            "final_assessment": final_assessment,
            "total_responses": len(session_data["responses"]),
            "completion_status": "completed",
            "completion_date": datetime.now(timezone.utc).isoformat(),
        }

        # Clean up session
        del self.active_sessions[session_id]

        # Track completion metrics
        training_metrics.training_completed()
        training_metrics.training_effectiveness(final_assessment["overall_score"])

        logger.info(f"Advanced training session completed: {session_id}")

        return completion_report

    def get_training_metrics(self) -> dict[str, Any]:
        """Get current training metrics"""

        return {
            "cultural_competency": {
                "average_score": sum(self.training_metrics.cultural_competency_scores)
                / len(self.training_metrics.cultural_competency_scores)
                if self.training_metrics.cultural_competency_scores
                else 0,
                "total_sessions": len(self.training_metrics.cultural_competency_scores),
            },
            "trauma_informed": {
                "average_score": sum(self.training_metrics.trauma_informed_scores)
                / len(self.training_metrics.trauma_informed_scores)
                if self.training_metrics.trauma_informed_scores
                else 0,
                "total_sessions": len(self.training_metrics.trauma_informed_scores),
            },
            "bias_awareness": {
                "average_score": sum(self.training_metrics.bias_awareness_scores)
                / len(self.training_metrics.bias_awareness_scores)
                if self.training_metrics.bias_awareness_scores
                else 0,
                "total_sessions": len(self.training_metrics.bias_awareness_scores),
            },
            "overall_metrics": {
                "total_sessions_completed": len(self.training_metrics.cultural_competency_scores),
                "average_overall_score": sum(self.training_metrics.cultural_competency_scores)
                / len(self.training_metrics.cultural_competency_scores)
                if self.training_metrics.cultural_competency_scores
                else 0,
                "improvement_rate": self.training_metrics.cultural_knowledge_improvement,
            },
        }


# Module-local holder for the singleton training engine. Using a small
# class here (rather than a module-level mutable global) keeps RUF/PLW
# happy without exposing a writable binding, while still preserving the
# "engine is shared across the process" contract callers rely on.


class _EngineHolder:
    engine: AdvancedTrainingEngine | None = None


async def initialize_advanced_training_engine() -> AdvancedTrainingEngine:
    """Initialize the module-local advanced training engine."""
    if _EngineHolder.engine is None:
        _EngineHolder.engine = AdvancedTrainingEngine()
        logger.info("Advanced training engine initialized")

    return _EngineHolder.engine


async def get_advanced_training_engine() -> AdvancedTrainingEngine:
    """Get the module-local advanced training engine instance."""
    if _EngineHolder.engine is None:
        await initialize_advanced_training_engine()

    return cast(AdvancedTrainingEngine, _EngineHolder.engine)


def reset_advanced_training_engine() -> None:
    """Reset the singleton (test helper)."""
    _EngineHolder.engine = None


# API endpoints for advanced training
async def start_advanced_training(
    user_id: str, training_type: str, difficulty: str, scenario_id: str | None = None
) -> dict[str, Any]:
    """API endpoint to start advanced training"""
    engine = await get_advanced_training_engine()

    # Convert string enums
    training_type_enum = TrainingType(training_type)
    difficulty_enum = DifficultyLevel(difficulty)

    return await engine.start_advanced_training_session(
        user_id=user_id, training_type=training_type_enum, difficulty=difficulty_enum, scenario_id=scenario_id
    )


async def process_advanced_response(
    session_id: str, user_response: str, response_type: str = "verbal"
) -> dict[str, Any]:
    """API endpoint to process training response"""
    engine = await get_advanced_training_engine()
    return await engine.process_training_response(
        session_id=session_id, user_response=user_response, response_type=response_type
    )


async def complete_advanced_training(session_id: str) -> dict[str, Any]:
    """API endpoint to complete training session"""
    engine = await get_advanced_training_engine()
    return await engine.complete_training_session(session_id)


async def get_advanced_training_metrics() -> dict[str, Any]:
    """API endpoint to get training metrics"""
    engine = await get_advanced_training_engine()
    return engine.get_training_metrics()


if __name__ == "__main__":
    # Example usage
    async def example():
        engine = await initialize_advanced_training_engine()

        # Start cultural competency training
        session = await engine.start_advanced_training_session(
            user_id="test_user", training_type=TrainingType.CULTURAL_COMPETENCY, difficulty=DifficultyLevel.INTERMEDIATE
        )

        # Process responses
        responses = [
            "I understand you have traditional health practices. Can you tell me more about them?",
            "I respect your cultural beliefs and want to work together on your care plan.",
            "Would you like to involve your family in these healthcare decisions?",
        ]

        for response in responses:
            await engine.process_training_response(session["session_id"], response)

        # Complete training
        await engine.complete_training_session(session["session_id"])

    asyncio.run(example())
