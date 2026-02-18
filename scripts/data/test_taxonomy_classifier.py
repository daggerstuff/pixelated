#!/usr/bin/env python3
"""
Quick test of the taxonomy classifier on sample records.

This script validates the classifier works before running full validation.
"""

import sys
from pathlib import Path

# Add ai module to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai.pipelines.design.taxonomy_classifier import TaxonomyClassifier, TherapeuticCategory


def test_classifier():
    """Test classifier on sample conversations."""
    
    print("="*80)
    print("🧪 TESTING TAXONOMY CLASSIFIER")
    print("="*80)
    
    classifier = TaxonomyClassifier()
    
    # Test cases representing different categories
    test_cases = [
        {
            "name": "Crisis Support - Suicidal Ideation",
            "messages": [
                {"role": "user", "content": "I can't take this anymore. I've been thinking about ending my life."},
                {"role": "assistant", "content": "I'm really concerned about what you're sharing. Are you having thoughts of suicide right now?"}
            ],
            "expected": TherapeuticCategory.CRISIS_SUPPORT
        },
        {
            "name": "Trauma Processing - PTSD",
            "messages": [
                {"role": "user", "content": "I keep having flashbacks to the assault. The nightmares are getting worse."},
                {"role": "assistant", "content": "Those trauma symptoms sound very distressing. Let's work on some grounding techniques."}
            ],
            "expected": TherapeuticCategory.TRAUMA_PROCESSING
        },
        {
            "name": "Relationship Therapy - Couples Conflict",
            "messages": [
                {"role": "user", "content": "My partner and I keep fighting about the same things. Our communication is terrible."},
                {"role": "assistant", "content": "Communication patterns in relationships can be challenging. Tell me about a recent conflict."}
            ],
            "expected": TherapeuticCategory.RELATIONSHIP_THERAPY
        },
        {
            "name": "Clinical Assessment - Intake Session",
            "messages": [
                {"role": "assistant", "content": "Let's start with a brief mental health screening. How often have you felt down, depressed, or hopeless?"},
                {"role": "user", "content": "Nearly every day for the past two weeks."}
            ],
            "expected": TherapeuticCategory.CLINICAL_ASSESSMENT
        },
        {
            "name": "Mental Health Support - Anxiety Coping",
            "messages": [
                {"role": "user", "content": "I've been feeling really anxious lately. Do you have any tips for managing stress?"},
                {"role": "assistant", "content": "Absolutely. Let's explore some mindfulness and breathing exercises that can help."}
            ],
            "expected": TherapeuticCategory.MENTAL_HEALTH_SUPPORT
        },
        {
            "name": "Therapeutic Conversation - General Therapy",
            "messages": [
                {"role": "user", "content": "I wanted to talk about my progress since our last session."},
                {"role": "assistant", "content": "Great! Let's review what you've been working on and how you've been feeling."}
            ],
            "expected": TherapeuticCategory.THERAPEUTIC_CONVERSATION
        }
    ]
    
    print("\n")
    correct = 0
    total = len(test_cases)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{'─'*80}")
        print(f"Test {i}/{total}: {test_case['name']}")
        print(f"{'─'*80}")
        
        record = {"messages": test_case["messages"]}
        classification = classifier.classify_record(record)
        
        is_correct = classification.category == test_case["expected"]
        status = "✅ CORRECT" if is_correct else "❌ INCORRECT"
        
        print(f"\nExpected:  {test_case['expected'].value}")
        print(f"Predicted: {classification.category.value}")
        print(f"Confidence: {classification.confidence:.2%}")
        print(f"Reasoning: {classification.reasoning}")
        print(f"Keywords: {', '.join(classification.keywords_detected[:3])}")
        print(f"\nResult: {status}")
        
        if is_correct:
            correct += 1
    
    # Summary
    accuracy = correct / total
    print("\n" + "="*80)
    print("📊 TEST SUMMARY")
    print("="*80)
    print(f"Tests passed: {correct}/{total} ({accuracy:.1%})")
    print(f"Target: >95% accuracy")
    
    if accuracy >= 0.95:
        print("\n✅ Classifier meets accuracy threshold!")
    else:
        print(f"\n⚠️  Classifier below threshold ({accuracy:.1%} < 95%)")
        print("   Consider improving classification logic before full validation")
    
    return accuracy >= 0.95


if __name__ == "__main__":
    success = test_classifier()
    sys.exit(0 if success else 1)
