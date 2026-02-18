#!/usr/bin/env python3
"""
Test NVIDIA NIM GLM4.7 Integration

This script tests the LLM classifier with the actual NVIDIA NIM API.
Requires OPENAI_API_KEY environment variable to be set.
"""

import os
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.pipelines.design.llm_classifier import LLMTaxonomyClassifier, LLMClassificationConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


def test_nvidia_nim_connection():
    """Test basic NVIDIA NIM API connection."""
    logger.info("="*80)
    logger.info("🧪 Testing NVIDIA NIM GLM4.7 Connection")
    logger.info("="*80)
    
    # Check API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("❌ OPENAI_API_KEY not set in environment")
        logger.info("Please set your NVIDIA API key:")
        logger.info("  export OPENAI_API_KEY='nvapi-...'")
        return False
    
    logger.info(f"✅ API Key found: {api_key[:10]}...{api_key[-4:]}")
    
    # Initialize classifier
    try:
        config = LLMClassificationConfig(
            model="z-ai/glm4.7",
            base_url="https://integrate.api.nvidia.com/v1"
        )
        classifier = LLMTaxonomyClassifier(config=config)
        logger.info(f"✅ LLM Classifier initialized with model: {config.model}")
        logger.info(f"✅ Base URL: {config.base_url}")
    except Exception as e:
        logger.error(f"❌ Failed to initialize classifier: {e}")
        return False
    
    return classifier


def test_classifications(classifier):
    """Test various classification scenarios."""
    
    test_cases = [
        {
            "name": "Crisis Support",
            "text": """Patient: I can't take it anymore. I've been thinking about ending my life.
Therapist: I hear that you're in a lot of pain right now. Can you tell me more about these thoughts?
Patient: I have pills at home. I've been thinking about taking them all.
Therapist: Thank you for being honest with me. This is serious and I want to help keep you safe.""",
            "expected": "crisis_support"
        },
        {
            "name": "Trauma Processing",
            "text": """Patient: I keep having nightmares about the assault. I can't sleep.
Therapist: PTSD symptoms like nightmares are common after trauma. Let's work on some grounding techniques.
Patient: Sometimes I have flashbacks during the day too. It feels like I'm back there.
Therapist: We'll use EMDR therapy to help process these traumatic memories.""",
            "expected": "trauma_processing"
        },
        {
            "name": "Relationship Therapy",
            "text": """Patient A: We just can't communicate anymore. Everything turns into a fight.
Patient B: That's not true. You never listen to me.
Therapist: I can see you're both frustrated. Let's practice active listening techniques.
Patient A: I do listen, but nothing I say matters.
Therapist: Let's work on using 'I' statements to express your feelings.""",
            "expected": "relationship_therapy"
        },
    ]
    
    logger.info("\n" + "="*80)
    logger.info("🎯 Running Classification Tests")
    logger.info("="*80)
    
    results = []
    for i, test_case in enumerate(test_cases, 1):
        logger.info(f"\n📝 Test {i}/{len(test_cases)}: {test_case['name']}")
        logger.info("-" * 80)
        
        try:
            result = classifier.classify(test_case["text"])
            
            logger.info(f"Category: {result.category.value}")
            logger.info(f"Confidence: {result.confidence:.2%}")
            logger.info(f"Reasoning: {result.reasoning}")
            logger.info(f"Key Indicators: {', '.join(result.keywords_detected)}")
            
            is_correct = result.category.value == test_case["expected"]
            status = "✅ CORRECT" if is_correct else f"❌ INCORRECT (expected {test_case['expected']})"
            logger.info(f"Result: {status}")
            
            results.append({
                "name": test_case["name"],
                "expected": test_case["expected"],
                "actual": result.category.value,
                "confidence": result.confidence,
                "correct": is_correct
            })
            
        except Exception as e:
            logger.error(f"❌ Classification failed: {e}")
            results.append({
                "name": test_case["name"],
                "expected": test_case["expected"],
                "actual": "ERROR",
                "confidence": 0.0,
                "correct": False
            })
    
    return results


def print_summary(results):
    """Print test summary."""
    logger.info("\n" + "="*80)
    logger.info("📊 TEST SUMMARY")
    logger.info("="*80)
    
    total = len(results)
    correct = sum(1 for r in results if r["correct"])
    accuracy = (correct / total * 100) if total > 0 else 0
    
    logger.info(f"Total Tests: {total}")
    logger.info(f"Correct: {correct}")
    logger.info(f"Accuracy: {accuracy:.1f}%")
    logger.info("")
    
    for result in results:
        status = "✅" if result["correct"] else "❌"
        logger.info(f"{status} {result['name']}: {result['actual']} ({result['confidence']:.1%})")
    
    logger.info("="*80)
    
    if accuracy == 100:
        logger.info("🎉 ALL TESTS PASSED!")
    elif accuracy >= 66:
        logger.info("⚠️  MOST TESTS PASSED")
    else:
        logger.info("❌ TESTS FAILED")
    
    logger.info("="*80)
    
    return accuracy == 100


def main():
    """Run all tests."""
    # Test connection
    classifier = test_nvidia_nim_connection()
    if not classifier:
        sys.exit(1)
    
    # Run classification tests
    results = test_classifications(classifier)
    
    # Print summary
    success = print_summary(results)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
