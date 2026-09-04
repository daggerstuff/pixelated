"""Type definitions for advanced training scenarios (extracted)."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class TrainingType(Enum):
    """Types of advanced training scenarios"""

    CULTURAL_COMPETENCY = "cultural_competency"
    TRAUMA_INFORMED = "trauma_informed"
    LGBTQ_INCLUSIVE = "lgbtq_inclusive"
    INDIGENOUS_HEALTH = "indigenous_health"
    DISABILITY_INCLUSIVE = "disability_inclusive"
    INTERSECTIONALITY = "intersectionality"
    LANGUAGE_ACCESS = "language_access"
    MIGRANT_HEALTH = "migrant_health"


class DifficultyLevel(Enum):
    """Difficulty levels for training scenarios"""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


@dataclass
class CulturalContext:
    """Cultural context for training scenarios"""

    ethnicity: str
    cultural_background: str
    language_preferences: list[str]
    religious_considerations: list[str]
    family_dynamics: str
    socioeconomic_factors: dict[str, Any]
    health_beliefs: list[str]
    communication_styles: list[str]
    decision_making_patterns: list[str]
    traditional_practices: list[str]
    barriers_to_care: list[str]


@dataclass
class TraumaContext:
    """Trauma-informed care context"""

    trauma_history: list[str]
    trauma_triggers: list[str]
    safety_needs: list[str]
    trust_building_requirements: list[str]
    empowerment_opportunities: list[str]
    cultural_trauma_factors: list[str]
    intergenerational_trauma_indicators: list[str]
    resilience_factors: list[str]
    coping_mechanisms: list[str]
    support_systems: list[str]


@dataclass
class IntersectionalityProfile:
    """Intersectionality profile for complex scenarios"""

    identities: dict[str, str]
    overlapping_oppressions: list[str]
    privilege_factors: list[str]
    marginalization_experiences: list[str]
    power_dynamics: dict[str, Any]
    accessibility_needs: list[str]
    discrimination_experiences: list[str]
    resilience_strategies: list[str]


@dataclass
class TrainingResponse:
    """Response to training scenario"""

    response_text: str
    response_type: str  # verbal, written, action
    cultural_competency_score: float
    trauma_informed_score: float
    bias_awareness_score: float
    communication_effectiveness: float
    empathy_demonstration: float
    appropriateness_score: float
    improvement_suggestions: list[str]
    positive_aspects: list[str]
    missed_opportunities: list[str]


@dataclass
class ScenarioBranch:
    """Branching scenario path"""

    branch_id: str
    condition: str
    next_scenario_id: str
    feedback: str
    learning_points: list[str]
    cultural_insights: list[str]
    trauma_considerations: list[str]


@dataclass
class AdvancedTrainingScenario:
    """Advanced training scenario with cultural and trauma-informed elements"""

    scenario_id: str
    training_type: TrainingType
    difficulty: DifficultyLevel
    title: str
    description: str
    patient_profile: dict[str, Any]
    cultural_context: CulturalContext
    trauma_context: TraumaContext | None
    intersectionality_profile: IntersectionalityProfile | None
    scenario_setup: str
    expected_interactions: list[str]
    learning_objectives: list[str]
    cultural_competency_goals: list[str]
    trauma_informed_goals: list[str]
    branching_paths: list[ScenarioBranch]
    assessment_criteria: dict[str, Any]
    resources: list[str]
    reflection_questions: list[str]
    debrief_points: list[str]
    cultural_sensitivity_alerts: list[str]
    trauma_safety_alerts: list[str]


@dataclass
class TrainingMetricsAdvanced:
    """Advanced metrics for cultural competency and trauma-informed training"""

    cultural_competency_scores: list[float] = field(default_factory=list)
    trauma_informed_scores: list[float] = field(default_factory=list)
    bias_awareness_scores: list[float] = field(default_factory=list)
    intersectionality_scores: list[float] = field(default_factory=list)
    communication_effectiveness_scores: list[float] = field(default_factory=list)
    empathy_scores: list[float] = field(default_factory=list)
    cultural_knowledge_improvement: float = 0.0
    trauma_awareness_improvement: float = 0.0
    bias_reduction_percentage: float = 0.0
    confidence_building_progress: float = 0.0
    skill_retention_rate: float = 0.0
    scenario_completion_rate: float = 0.0
    cultural_mistake_frequency: float = 0.0
    trauma_trigger_avoidance_rate: float = 0.0
