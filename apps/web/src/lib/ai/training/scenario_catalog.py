"""Curated training scenario catalogs (extracted)."""
from .scenario_types import (
    AdvancedTrainingScenario,
    CulturalContext,
    DifficultyLevel,
    IntersectionalityProfile,
    ScenarioBranch,
    TrainingType,
    TraumaContext,
)


class CulturalCompetencyScenarios:
    """Cultural competency training scenarios"""

    def __init__(self):
        self.scenarios = self._load_cultural_scenarios()

    def _load_cultural_scenarios(self) -> list[AdvancedTrainingScenario]:
        """Load cultural competency scenarios"""
        scenarios = []

        # Hispanic/Latino cultural competency scenario
        hispanic_scenario = AdvancedTrainingScenario(
            scenario_id="cultural_hispanic_001",
            training_type=TrainingType.CULTURAL_COMPETENCY,
            difficulty=DifficultyLevel.INTERMEDIATE,
            title="Cultural Competency: Hispanic/Latino Patient Care",
            description="Navigate cultural considerations when treating a Hispanic patient with traditional health beliefs",
            patient_profile={
                "name": "Maria Rodriguez",
                "age": 45,
                "gender": "female",
                "ethnicity": "Hispanic/Latino",
                "primary_language": "Spanish",
                "english_proficiency": "limited",
                "insurance": "Medicaid",
                "occupation": "housekeeper",
            },
            cultural_context=CulturalContext(
                ethnicity="Hispanic/Latino",
                cultural_background="Mexican-American, traditional family values",
                language_preferences=["Spanish", "limited English"],
                religious_considerations=["Catholic", "family-centered decision making"],
                family_dynamics="Extended family involved in health decisions",
                socioeconomic_factors={
                    "income_level": "low",
                    "education_level": "high school",
                    "employment_status": "employed",
                    "housing_stability": "stable",
                },
                health_beliefs=[
                    "Traditional remedies alongside Western medicine",
                    "Hot/cold balance in body",
                    "Family involvement in care decisions",
                    "Respect for authority figures",
                ],
                communication_styles=[
                    "Indirect communication",
                    "Respectful of hierarchy",
                    "Non-confrontational",
                    "Family spokesperson may speak",
                ],
                decision_making_patterns=[
                    "Family-centered decisions",
                    "Elder consultation",
                    "Religious considerations",
                    "Traditional healing preferences",
                ],
                traditional_practices=[
                    "Herbal remedies",
                    "Prayer and spiritual healing",
                    "Family care rituals",
                    "Traditional diet modifications",
                ],
                barriers_to_care=[
                    "Language barriers",
                    "Financial constraints",
                    "Transportation issues",
                    "Cultural misunderstandings",
                ],
            ),
            trauma_context=None,
            intersectionality_profile=None,
            scenario_setup="Maria presents with diabetes management challenges. She mentions using traditional remedies alongside prescribed medications.",
            expected_interactions=[
                "Language-appropriate communication",
                "Cultural sensitivity to traditional practices",
                "Family involvement in care planning",
                "Respect for cultural health beliefs",
            ],
            learning_objectives=[
                "Understand Hispanic/Latino cultural health beliefs",
                "Practice culturally sensitive communication",
                "Navigate traditional vs. Western medicine integration",
                "Involve family in healthcare decisions appropriately",
            ],
            cultural_competency_goals=[
                "Demonstrate respect for cultural health practices",
                "Use appropriate communication styles",
                "Understand family dynamics in healthcare",
                "Address language barriers effectively",
            ],
            trauma_informed_goals=[],
            branching_paths=[
                ScenarioBranch(
                    branch_id="respect_traditional",
                    condition="Provider respects traditional practices",
                    next_scenario_id="cultural_success_001",
                    feedback="Excellent cultural sensitivity demonstrated",
                    learning_points=["Cultural respect builds trust", "Integration of practices improves outcomes"],
                    cultural_insights=["Traditional practices have value", "Cultural humility is essential"],
                    trauma_considerations=[],
                ),
                ScenarioBranch(
                    branch_id="dismiss_traditional",
                    condition="Provider dismisses traditional practices",
                    next_scenario_id="cultural_challenge_001",
                    feedback="Cultural insensitivity may harm therapeutic relationship",
                    learning_points=[
                        "Dismissal of cultural practices damages trust",
                        "Cultural competence requires openness",
                    ],
                    cultural_insights=["All health beliefs deserve respect", "Cultural practices often have wisdom"],
                    trauma_considerations=["Cultural dismissal can be traumatic"],
                ),
            ],
            assessment_criteria={
                "cultural_sensitivity": 0.8,
                "communication_appropriateness": 0.7,
                "family_involvement": 0.6,
                "traditional_practice_integration": 0.5,
            },
            resources=[
                "Hispanic/Latino cultural competency guidelines",
                "Traditional medicine integration protocols",
                "Medical Spanish resources",
                "Family-centered care principles",
            ],
            reflection_questions=[
                "How did cultural background affect this interaction?",
                "What traditional practices were mentioned?",
                "How was family involvement handled?",
                "What could improve cultural competency?",
            ],
            debrief_points=[
                "Cultural humility in healthcare",
                "Traditional medicine integration",
                "Language access importance",
                "Family-centered care benefits",
            ],
            cultural_sensitivity_alerts=[
                "Avoid stereotyping",
                "Respect traditional practices",
                "Use appropriate language services",
                "Understand family dynamics",
            ],
            trauma_safety_alerts=[],
        )

        scenarios.append(hispanic_scenario)

        # Add more cultural scenarios...
        return scenarios

    def get_scenario_by_id(self, scenario_id: str) -> AdvancedTrainingScenario | None:
        """Get scenario by ID"""
        for scenario in self.scenarios:
            if scenario.scenario_id == scenario_id:
                return scenario
        return None


class TraumaInformedScenarios:
    """Trauma-informed care training scenarios"""

    def __init__(self):
        self.scenarios = self._load_trauma_scenarios()

    def _load_trauma_scenarios(self) -> list[AdvancedTrainingScenario]:
        """Load trauma-informed care scenarios"""
        scenarios = []

        # Domestic violence survivor scenario
        dv_scenario = AdvancedTrainingScenario(
            scenario_id="trauma_dv_001",
            training_type=TrainingType.TRAUMA_INFORMED,
            difficulty=DifficultyLevel.ADVANCED,
            title="Trauma-Informed Care: Domestic Violence Survivor",
            description="Provide trauma-informed care to a domestic violence survivor seeking healthcare",
            patient_profile={
                "name": "Sarah Johnson",
                "age": 32,
                "gender": "female",
                "ethnicity": "Caucasian",
                "primary_language": "English",
                "occupation": "teacher",
                "insurance": "private",
            },
            cultural_context=CulturalContext(
                ethnicity="Caucasian",
                cultural_background="Middle-class American",
                language_preferences=["English"],
                religious_considerations=[],
                family_dynamics="Estranged from family due to abuse",
                socioeconomic_factors={
                    "income_level": "middle",
                    "education_level": "college",
                    "employment_status": "employed",
                    "housing_stability": "unstable",
                },
                health_beliefs=["Western medicine", "privacy important"],
                communication_styles=["Direct but guarded", "Needs reassurance"],
                decision_making_patterns=["Independent", "Cautious"],
                traditional_practices=[],
                barriers_to_care=["Trust issues", "Fear of judgment", "Privacy concerns"],
            ),
            trauma_context=TraumaContext(
                trauma_history=["Domestic violence", "Emotional abuse", "Physical abuse"],
                trauma_triggers=["Raised voices", "Sudden movements", "Closed doors", "Male authority figures"],
                safety_needs=["Physical safety", "Emotional safety", "Privacy", "Control over situation"],
                trust_building_requirements=["Consistency", "Respect", "Transparency", "Choice"],
                empowerment_opportunities=["Decision making", "Voice in care", "Setting boundaries", "Self-advocacy"],
                cultural_trauma_factors=["Gender-based violence", "Power imbalances"],
                intergenerational_trauma_indicators=["Family violence patterns", "Learned helplessness"],
                resilience_factors=["Employment stability", "Supportive friends", "Therapy engagement"],
                coping_mechanisms=["Avoidance", "Hypervigilance", "Control-seeking"],
                support_systems=["Therapist", "Close friends", "Support group"],
            ),
            intersectionality_profile=IntersectionalityProfile(
                identities={
                    "gender": "female",
                    "socioeconomic_status": "middle_class",
                    "survivor_status": "domestic_violence",
                },
                overlapping_oppressions=["Gender-based violence", "Power imbalances"],
                privilege_factors=["Education", "Employment", "Language"],
                marginalization_experiences=["Violence victimization", "Safety concerns"],
                power_dynamics={"healthcare_setting": "vulnerable", "personal_life": "seeking_empowerment"},
                accessibility_needs=["Emotional safety", "Privacy", "Choice"],
                discrimination_experiences=["Victim blaming", "Disbelief", "Minimization"],
                resilience_strategies=["Therapy", "Support networks", "Self-advocacy"],
            ),
            scenario_setup="Sarah presents for routine care but shows signs of hypervigilance and discomfort with male providers.",
            expected_interactions=[
                "Trauma-sensitive communication",
                "Safety and choice emphasis",
                "Avoidance of trauma triggers",
                "Empowerment-focused approach",
            ],
            learning_objectives=[
                "Recognize trauma responses and triggers",
                "Practice trauma-informed communication",
                "Create physically and emotionally safe environments",
                "Support survivor empowerment and choice",
            ],
            cultural_competency_goals=[
                "Understand intersectionality of trauma and identity",
                "Respect cultural responses to trauma",
                "Address power dynamics in healthcare",
            ],
            trauma_informed_goals=[
                "Recognize trauma responses",
                "Avoid re-traumatization",
                "Promote safety and choice",
                "Support empowerment",
            ],
            branching_paths=[
                ScenarioBranch(
                    branch_id="trauma_sensitive",
                    condition="Provider uses trauma-informed approach",
                    next_scenario_id="trauma_success_001",
                    feedback="Excellent trauma-informed care demonstrated",
                    learning_points=["Safety creates healing", "Choice promotes empowerment"],
                    cultural_insights=["Trauma affects whole person", "Safety is cultural"],
                    trauma_considerations=["Avoiding triggers prevents harm", "Choice restores power"],
                ),
                ScenarioBranch(
                    branch_id="trauma_insensitive",
                    condition="Provider ignores trauma signs",
                    next_scenario_id="trauma_challenge_001",
                    feedback="Trauma insensitivity may cause harm",
                    learning_points=["Ignoring trauma signs is harmful", "Trauma-informed care is essential"],
                    cultural_insights=["Trauma affects healthcare interactions", "Safety is paramount"],
                    trauma_considerations=["Re-traumatization must be avoided", "Power dynamics matter"],
                ),
            ],
            assessment_criteria={
                "trauma_sensitivity": 0.9,
                "safety_creation": 0.8,
                "choice_promotion": 0.7,
                "empowerment_support": 0.6,
            },
            resources=[
                "Trauma-informed care principles",
                "Domestic violence survivor resources",
                "Safety planning guidelines",
                "Empowerment-based care approaches",
            ],
            reflection_questions=[
                "What trauma signs were present?",
                "How was safety addressed?",
                "What choices were offered?",
                "How was empowerment supported?",
            ],
            debrief_points=[
                "Trauma-informed care principles",
                "Safety in healthcare settings",
                "Empowerment through choice",
                "Avoiding re-traumatization",
            ],
            cultural_sensitivity_alerts=[
                "Respect trauma responses",
                "Understand intersectionality",
                "Avoid victim-blaming",
                "Support cultural coping",
            ],
            trauma_safety_alerts=[
                "Maintain physical and emotional safety",
                "Avoid trauma triggers",
                "Respect survivor choices",
                "Prevent re-traumatization",
            ],
        )

        scenarios.append(dv_scenario)

        # Add more trauma scenarios...
        return scenarios

    def get_scenario_by_id(self, scenario_id: str) -> AdvancedTrainingScenario | None:
        """Get scenario by ID"""
        for scenario in self.scenarios:
            if scenario.scenario_id == scenario_id:
                return scenario
        return None


class LGBTQInclusiveScenarios:
    """LGBTQ+ inclusive healthcare scenarios"""

    def __init__(self):
        self.scenarios = self._load_lgbtq_scenarios()

    def _load_lgbtq_scenarios(self) -> list[AdvancedTrainingScenario]:
        """Load LGBTQ+ inclusive scenarios"""
        scenarios = []

        # Transgender healthcare scenario
        trans_scenario = AdvancedTrainingScenario(
            scenario_id="lgbtq_trans_001",
            training_type=TrainingType.LGBTQ_INCLUSIVE,
            difficulty=DifficultyLevel.ADVANCED,
            title="LGBTQ+ Inclusive Care: Transgender Patient Healthcare",
            description="Provide inclusive healthcare to a transgender patient navigating gender-affirming care",
            patient_profile={
                "name": "Alex Chen",
                "age": 28,
                "gender": "transgender_male",
                "pronouns": "he/him",
                "ethnicity": "Asian American",
                "primary_language": "English",
                "occupation": "software_engineer",
                "insurance": "private",
            },
            cultural_context=CulturalContext(
                ethnicity="Asian American",
                cultural_background="Chinese-American, LGBTQ+ community",
                language_preferences=["English"],
                religious_considerations=["Non-religious", "Family acceptance issues"],
                family_dynamics="Complex family relationships, chosen family support",
                socioeconomic_factors={
                    "income_level": "middle",
                    "education_level": "college",
                    "employment_status": "employed",
                    "housing_stability": "stable",
                },
                health_beliefs=["Holistic health", "Gender-affirming care importance"],
                communication_styles=["Direct", "Needs validation", "Privacy-conscious"],
                decision_making_patterns=["Independent", "Informed consent focused"],
                traditional_practices=["Mindfulness", "Community support"],
                barriers_to_care=["Discrimination fears", "Lack of provider knowledge", "Insurance barriers"],
            ),
            trauma_context=TraumaContext(
                trauma_history=["Gender dysphoria", "Discrimination", "Misgendering"],
                trauma_triggers=["Deadnaming", "Incorrect pronouns", "Invasive questions", "Judgmental attitudes"],
                safety_needs=["Gender-affirming care", "Respect for identity", "Privacy", "Non-judgmental care"],
                trust_building_requirements=["LGBTQ+ competency", "Respect for pronouns", "Knowledgeable care"],
                empowerment_opportunities=["Self-advocacy", "Informed consent", "Body autonomy", "Identity validation"],
                cultural_trauma_factors=["Minority stress", "Family rejection", "Societal discrimination"],
                intergenerational_trauma_indicators=["Family rejection patterns", "Cultural stigma"],
                resilience_factors=["Community support", "Self-awareness", "Advocacy skills"],
                coping_mechanisms=["Community connection", "Self-care", "Advocacy"],
                support_systems=["LGBTQ+ community", "Chosen family", "Online support"],
            ),
            intersectionality_profile=IntersectionalityProfile(
                identities={
                    "gender_identity": "transgender_male",
                    "sexual_orientation": "queer",
                    "race_ethnicity": "asian_american",
                    "socioeconomic_status": "middle_class",
                },
                overlapping_oppressions=["Transphobia", "Racism", "Minority stress"],
                privilege_factors=["Education", "Employment", "Language"],
                marginalization_experiences=["Gender discrimination", "Racial discrimination"],
                power_dynamics={"healthcare_setting": "vulnerable", "personal_life": "self_advocating"},
                accessibility_needs=["Gender-affirming care", "Respectful language", "Privacy"],
                discrimination_experiences=["Misgendering", "Deadnaming", "Medical discrimination"],
                resilience_strategies=["Community support", "Self-advocacy", "Education"],
            ),
            scenario_setup="Alex seeks gender-affirming hormone therapy and experiences anxiety about provider competency.",
            expected_interactions=[
                "Gender-affirming care provision",
                "Respectful pronoun and name usage",
                "Trauma-informed approach",
                "Intersectional awareness",
            ],
            learning_objectives=[
                "Understand transgender healthcare needs",
                "Practice gender-affirming care principles",
                "Use inclusive language and pronouns",
                "Address intersectional discrimination",
            ],
            cultural_competency_goals=[
                "Understand transgender health disparities",
                "Respect gender identity and expression",
                "Provide culturally humble care",
                "Address intersectional needs",
            ],
            trauma_informed_goals=[
                "Recognize minority stress impacts",
                "Create safe spaces for trans patients",
                "Avoid re-traumatization",
                "Support empowerment",
            ],
            branching_paths=[
                ScenarioBranch(
                    branch_id="gender_affirming",
                    condition="Provider offers gender-affirming care",
                    next_scenario_id="lgbtq_success_001",
                    feedback="Excellent gender-affirming care provided",
                    learning_points=["Gender-affirming care saves lives", "Respect builds trust"],
                    cultural_insights=["Trans identities are valid", "Affirmation is healing"],
                    trauma_considerations=["Minority stress is real", "Affirmation reduces harm"],
                ),
                ScenarioBranch(
                    branch_id="transphobic",
                    condition="Provider shows transphobic bias",
                    next_scenario_id="lgbtq_challenge_001",
                    feedback="Transphobic bias causes significant harm",
                    learning_points=["Transphobia is deadly", "Competency saves lives"],
                    cultural_insights=["Trans people face discrimination", "Competency is essential"],
                    trauma_considerations=["Transphobia is traumatic", "Competency prevents harm"],
                ),
            ],
            assessment_criteria={
                "gender_affirming_care": 0.9,
                "inclusive_language": 0.8,
                "trauma_sensitivity": 0.7,
                "intersectional_awareness": 0.6,
            },
            resources=[
                "WPATH Standards of Care",
                "Transgender healthcare guidelines",
                "Gender-affirming care protocols",
                "LGBTQ+ inclusive language guide",
            ],
            reflection_questions=[
                "How were pronouns handled?",
                "What gender-affirming care was provided?",
                "How was minority stress addressed?",
                "What intersectional factors were considered?",
            ],
            debrief_points=[
                "Gender-affirming care principles",
                "Inclusive language importance",
                "Minority stress impacts",
                "Intersectional discrimination",
            ],
            cultural_sensitivity_alerts=[
                "Use correct pronouns and names",
                "Respect gender identity",
                "Avoid assumptions",
                "Understand minority stress",
            ],
            trauma_safety_alerts=[
                "Create safe spaces",
                "Avoid misgendering",
                "Respect body autonomy",
                "Support empowerment",
            ],
        )

        scenarios.append(trans_scenario)

        # Add more LGBTQ+ scenarios...
        return scenarios

    def get_scenario_by_id(self, scenario_id: str) -> AdvancedTrainingScenario | None:
        """Get scenario by ID"""
        for scenario in self.scenarios:
            if scenario.scenario_id == scenario_id:
                return scenario
        return None


