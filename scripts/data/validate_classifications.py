#!/usr/bin/env python3
"""
Quality Assurance Validation for Taxonomy Classification

This script validates the accuracy of classifications by:
1. Testing known edge cases (nightmare scenarios)
2. Comparing LLM vs keyword classifications
3. Validating against ground truth examples
4. Identifying misclassifications and failure modes
"""

import json
import logging
import sys
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.pipelines.design.hybrid_classifier import HybridTaxonomyClassifier
from ai.pipelines.design.taxonomy_classifier import TherapeuticCategory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class GroundTruthExample:
    """A conversation with known correct classification."""
    conversation: str
    expected_category: TherapeuticCategory
    description: str
    difficulty: str  # 'easy', 'medium', 'hard', 'nightmare'


# Ground truth test cases with known correct answers
GROUND_TRUTH_CASES = [
    # EASY CASES - Clear single indicators
    GroundTruthExample(
        conversation="user: I want to kill myself. assistant: Let's talk about safety planning.",
        expected_category=TherapeuticCategory.CRISIS_SUPPORT,
        description="Clear suicidal ideation",
        difficulty="easy"
    ),
    GroundTruthExample(
        conversation="user: My husband and I keep fighting. assistant: Tell me about your communication patterns.",
        expected_category=TherapeuticCategory.RELATIONSHIP_THERAPY,
        description="Clear relationship conflict",
        difficulty="easy"
    ),
    
    # MEDIUM CASES - Multiple indicators, need prioritization
    GroundTruthExample(
        conversation="user: I've been depressed since the car accident. I keep having flashbacks. assistant: Those sound like trauma symptoms. Let's work on processing the accident.",
        expected_category=TherapeuticCategory.TRAUMA_PROCESSING,
        description="Depression + trauma - should prioritize trauma",
        difficulty="medium"
    ),
    GroundTruthExample(
        conversation="user: I feel anxious and can't sleep. assistant: Let's talk about coping strategies for anxiety.",
        expected_category=TherapeuticCategory.MENTAL_HEALTH_SUPPORT,
        description="Anxiety symptoms without crisis",
        difficulty="medium"
    ),
    
    # HARD CASES - Ambiguous, multiple valid interpretations
    GroundTruthExample(
        conversation="user: I have sexual abuse history, breast cancer, insomnia, depression, anxiety, and low self-esteem. I've never had counseling. Do I have too many issues? assistant: There's no such thing as too many issues. Therapy is about working on what you feel ready to work on.",
        expected_category=TherapeuticCategory.TRAUMA_PROCESSING,
        description="Multiple issues - trauma history should be primary",
        difficulty="hard"
    ),
    GroundTruthExample(
        conversation="user: On a scale of 1-10, how often do you feel down? How about difficulty sleeping? assistant: Let me document these for your assessment.",
        expected_category=TherapeuticCategory.CLINICAL_ASSESSMENT,
        description="Structured screening questions",
        difficulty="hard"
    ),
    
    # NIGHTMARE CASES - Edge cases that could fool the system
    GroundTruthExample(
        conversation="user: My therapist asked if I ever thought about suicide. I said no, never. assistant: That's good to hear. Let's continue with your anxiety management.",
        expected_category=TherapeuticCategory.MENTAL_HEALTH_SUPPORT,
        description="Contains 'suicide' but NOT crisis - denial context",
        difficulty="nightmare"
    ),
    GroundTruthExample(
        conversation="user: I'm studying to be a trauma therapist. Can you explain PTSD symptoms? assistant: PTSD symptoms include flashbacks, avoidance, hypervigilance...",
        expected_category=TherapeuticCategory.THERAPEUTIC_CONVERSATION,
        description="Educational discussion ABOUT trauma, not trauma processing",
        difficulty="nightmare"
    ),
    GroundTruthExample(
        conversation="user: My partner said I should kill myself during our fight. assistant: That's verbal abuse. How are you feeling about that?",
        expected_category=TherapeuticCategory.RELATIONSHIP_THERAPY,
        description="Contains 'kill myself' but in relationship abuse context",
        difficulty="nightmare"
    ),
    GroundTruthExample(
        conversation="user: I watched a movie about suicide last night. It made me think about my own depression. assistant: What thoughts came up for you?",
        expected_category=TherapeuticCategory.MENTAL_HEALTH_SUPPORT,
        description="'Suicide' mentioned but not personal ideation",
        difficulty="nightmare"
    ),
]


def validate_classification(
    classifier: HybridTaxonomyClassifier,
    test_case: GroundTruthExample
) -> Dict[str, Any]:
    """
    Validate a single classification against ground truth.
    
    Returns dict with result, correctness, and details.
    """
    record = {"messages": [{"role": "user", "content": test_case.conversation}]}
    result = classifier.classify_record(record)
    
    is_correct = result.category == test_case.expected_category
    
    return {
        "description": test_case.description,
        "difficulty": test_case.difficulty,
        "expected": test_case.expected_category.value,
        "actual": result.category.value,
        "confidence": result.confidence,
        "correct": is_correct,
        "reasoning": result.reasoning,
        "keywords": result.keywords_detected[:5] if hasattr(result, 'keywords_detected') else []
    }


def run_validation(use_llm: bool = True) -> None:
    """Run full validation suite."""
    
    logger.info("=" * 80)
    logger.info("🔍 TAXONOMY CLASSIFICATION QUALITY ASSURANCE VALIDATION")
    logger.info("=" * 80)
    logger.info(f"LLM Enabled: {use_llm}")
    logger.info(f"Test Cases: {len(GROUND_TRUTH_CASES)}")
    logger.info("")
    
    # Initialize classifier
    classifier = HybridTaxonomyClassifier(
        enable_llm=use_llm,
        keyword_confidence_threshold=0.80
    )
    
    # Run validation on all cases
    results = []
    for i, test_case in enumerate(GROUND_TRUTH_CASES, 1):
        logger.info(f"Testing case {i}/{len(GROUND_TRUTH_CASES)}: {test_case.description}")
        result = validate_classification(classifier, test_case)
        results.append(result)
        
        status = "✅ PASS" if result["correct"] else "❌ FAIL"
        logger.info(f"  {status} - Expected: {result['expected']}, Got: {result['actual']} ({result['confidence']:.1%})")
        if not result["correct"]:
            logger.warning(f"  Reasoning: {result['reasoning'][:100]}...")
    
    # Calculate statistics
    total = len(results)
    correct = sum(1 for r in results if r["correct"])
    accuracy = correct / total if total > 0 else 0
    
    # Breakdown by difficulty
    by_difficulty = {}
    for r in results:
        diff = r["difficulty"]
        if diff not in by_difficulty:
            by_difficulty[diff] = {"total": 0, "correct": 0}
        by_difficulty[diff]["total"] += 1
        if r["correct"]:
            by_difficulty[diff]["correct"] += 1
    
    # Print summary
    logger.info("")
    logger.info("=" * 80)
    logger.info("📊 VALIDATION RESULTS SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Overall Accuracy: {correct}/{total} ({accuracy:.1%})")
    logger.info("")
    logger.info("Accuracy by Difficulty:")
    for diff in ["easy", "medium", "hard", "nightmare"]:
        if diff in by_difficulty:
            stats = by_difficulty[diff]
            acc = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
            logger.info(f"  {diff.capitalize():12s}: {stats['correct']}/{stats['total']} ({acc:.1%})")
    
    # Identify failures
    failures = [r for r in results if not r["correct"]]
    if failures:
        logger.info("")
        logger.info("❌ FAILED CASES:")
        for f in failures:
            logger.info(f"  • {f['description']}")
            logger.info(f"    Expected: {f['expected']}, Got: {f['actual']} ({f['confidence']:.1%})")
            logger.info(f"    Difficulty: {f['difficulty']}")
    
    logger.info("=" * 80)
    
    # Save detailed results
    output_file = Path("tmp_rovodev_validation_results.json")
    with open(output_file, "w") as f:
        json.dump({
            "summary": {
                "total": total,
                "correct": correct,
                "accuracy": accuracy,
                "by_difficulty": by_difficulty
            },
            "results": results
        }, f, indent=2)
    
    logger.info(f"📁 Detailed results saved to: {output_file}")
    
    # Return exit code based on accuracy
    if accuracy < 0.80:
        logger.error(f"❌ VALIDATION FAILED: Accuracy {accuracy:.1%} below 80% threshold")
        sys.exit(1)
    else:
        logger.info(f"✅ VALIDATION PASSED: Accuracy {accuracy:.1%}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate classification quality")
    parser.add_argument("--no-llm", action="store_true", help="Test keyword-only classification")
    
    args = parser.parse_args()
    
    run_validation(use_llm=not args.no_llm)
