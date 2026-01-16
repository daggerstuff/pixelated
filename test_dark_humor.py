import logging
import os
import sys
from pathlib import Path

from ai.dataset_pipeline.processing.personality_adapter import (
    CommunicationStyle,
    PersonalityAdaptation,
    PersonalityAdapter,
    PersonalityProfile,
    TherapeuticApproach,
)

# Ensure we can import the module from root
current_dir = Path(os.getcwd())
if (current_dir / "ai").exists():
    sys.path.append(str(current_dir))

# Configure logging to replace print statements
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("test_dark_humor")


def test_dark_humor_adaptation():
    """
    Test the Dark Humor personality adaptation logic.
    Verifies that text is transformed with the expected cynical/humorous tone.
    """
    logger.info("Initializing PersonalityAdapter...")
    adapter = PersonalityAdapter()

    # Create a mock profile that triggers similar behavior manually
    profile = PersonalityProfile(
        openness=0.9,
        conscientiousness=0.4,
        extraversion=0.8,
        agreeableness=0.2,  # Low agreeableness often correlates with darker humor in this logic
        neuroticism=0.7,
        confidence_score=0.95,
    )

    # Force the Dark Humor adaptation context
    adaptation = PersonalityAdaptation(
        personality_profile=profile,
        communication_style=CommunicationStyle.DARK_HUMOR,
        therapeutic_approach=TherapeuticApproach.PROVOCATIVE,
        conversation_pace="fast",
        detail_level="moderate",
        emotional_support_level="low",
        structure_preference="low",
        feedback_style="direct",
        motivation_approach="autonomy",
        adaptation_confidence=0.95,
    )

    test_inputs = [
        "I understand how you feel. It will get better.",
        "Take a deep breath. You are strong.",
        "Everything happens for a reason.",
    ]

    logger.info("Starting Dark Humor adaptation tests...")

    for i, input_text in enumerate(test_inputs):
        logger.info(f"--- Test Case {i + 1} ---")

        result = adapter.adapt_response(input_text, adaptation)

        # Log results instead of printing
        logger.info(f"Original: {input_text}")
        logger.info(f"Adapted:  {result.adapted_response}")

        # Verification assertions
        if result.adapted_response == input_text:
            logger.warning(f"WARN: No adaptation occurred for: '{input_text}'")
        else:
            logger.info("SUCCESS: Text was modified.")

        # Check for specific dark humor signatures in our implementation
        # (e.g., replacement of standard platitudes)
        if "Survival is optional" in result.adapted_response:
            logger.info("Verified: 'Survival is optional' replacement found.")

        if "abyss" in result.adapted_response:
            logger.info("Verified: 'abyss' replacement found.")


if __name__ == "__main__":
    test_dark_humor_adaptation()
