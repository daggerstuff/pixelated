#!/usr/bin/env python3
"""
Demonstration script for clinical accuracy validator.

This script shows the capabilities of the clinical accuracy validator including:
- Validating therapeutic conversations for clinical standards
- Identifying ethical compliance issues
- Checking safety protocol implementation
- Assessing professional boundaries
- Evaluating cultural sensitivity
- Generating comprehensive validation reports
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.dataset_pipeline.clinical_accuracy_validator import (
    ClinicalAccuracyValidator,
    ValidationSeverity,
    ValidationCategory
)
from ai.dataset_pipeline.conversation_schema import Conversation, Message
from ai.dataset_pipeline.client_scenario_generator import (
    ClientScenarioGenerator,
    ScenarioType,
    SeverityLevel,
    DemographicCategory
)
from ai.dataset_pipeline.therapeutic_response_generator import TherapeuticResponseGenerator


def main():
    """Demonstrate clinical accuracy validator capabilities."""
    print("🩺 Clinical Accuracy Validator Demo")
    print("=" * 60)
    
    # Initialize components
    validator = ClinicalAccuracyValidator()
    scenario_generator = ClientScenarioGenerator()
    response_generator = TherapeuticResponseGenerator()
    
    # Show validation categories and severities
    print("\n📋 Validation Categories:")
    for category in ValidationCategory:
        print(f"  • {category.value.replace('_', ' ').title()}")
    
    print("\n⚠️ Validation Severities:")
    for severity in ValidationSeverity:
        print(f"  • {severity.value.title()}")
    
    # Generate test scenarios and conversations
    print("\n🎯 Generating Test Scenarios:")
    
    # Scenario 1: Good therapeutic conversation
    good_scenario = scenario_generator.generate_client_scenario(
        scenario_type=ScenarioType.INITIAL_ASSESSMENT,
        severity_level=SeverityLevel.MODERATE,
        demographic_category=DemographicCategory.YOUNG_ADULT
    )
    
    good_conversation = response_generator.generate_conversation_with_responses(
        good_scenario,
        num_exchanges=3
    )
    
    print(f"\n  Good Conversation: {good_conversation.id}")
    print(f"    Messages: {len(good_conversation.messages)}")
    print(f"    Scenario: {good_scenario.scenario_type.value.replace('_', ' ').title()}")
    
    # Scenario 2: Problematic conversation with ethical issues
    problematic_messages = [
        Message(
            role="therapist",
            content="Hello, I'm glad you're here. What brings you to therapy?",
            meta={"technique": "open_ended_questioning"}
        ),
        Message(
            role="client",
            content="I've been feeling really depressed and anxious lately.",
            meta={}
        ),
        Message(
            role="therapist",
            content="I'll need to tell your family about this so they can help support you.",
            meta={"technique": "inappropriate_disclosure"}
        ),
        Message(
            role="client",
            content="Please don't tell anyone. I don't want them to know.",
            meta={}
        ),
        Message(
            role="therapist",
            content="You definitely have major depression based on what you've told me.",
            meta={"technique": "inappropriate_diagnosis"}
        )
    ]
    
    problematic_conversation = Conversation(
        id="problematic_demo_conversation",
        messages=problematic_messages,
        context={"scenario_type": "initial_assessment"},
        source="demo"
    )
    
    print(f"\n  Problematic Conversation: {problematic_conversation.id}")
    print(f"    Messages: {len(problematic_conversation.messages)}")
    print(f"    Contains: Ethical violations and inappropriate diagnosis")
    
    # Scenario 3: Crisis conversation without proper safety protocols
    crisis_scenario = scenario_generator.generate_client_scenario(
        scenario_type=ScenarioType.CRISIS_INTERVENTION,
        severity_level=SeverityLevel.CRISIS
    )
    crisis_scenario.session_context['crisis_type'] = 'suicidal_ideation'
    
    inadequate_crisis_messages = [
        Message(
            role="therapist",
            content="Hello, I understand you're going through a difficult time.",
            meta={"technique": "empathic_reflection"}
        ),
        Message(
            role="client",
            content="I don't want to live anymore. I can't take this pain.",
            meta={}
        ),
        Message(
            role="therapist",
            content="That sounds really hard. Tell me more about your feelings.",
            meta={"technique": "open_ended_questioning"}
        )
    ]
    
    inadequate_crisis_conversation = Conversation(
        id="inadequate_crisis_demo",
        messages=inadequate_crisis_messages,
        context={"scenario_type": "crisis_intervention"},
        source="demo"
    )
    
    print(f"\n  Inadequate Crisis Conversation: {inadequate_crisis_conversation.id}")
    print(f"    Messages: {len(inadequate_crisis_conversation.messages)}")
    print(f"    Issue: Missing safety protocols for suicidal ideation")
    
    # Validate conversations
    print("\n🔍 Validation Results:")
    
    # Validate good conversation
    print("\n  1. Good Conversation Validation:")
    good_result = validator.validate_conversation(good_conversation, good_scenario)
    
    print(f"    Overall Score: {good_result.overall_score:.2f}")
    print(f"    Clinically Acceptable: {'✅ Yes' if good_result.is_clinically_acceptable else '❌ No'}")
    print(f"    Issues Found: {len(good_result.issues)}")
    print(f"    Strengths Identified: {len(good_result.strengths)}")
    
    if good_result.strengths:
        print(f"    Top Strengths:")
        for strength in good_result.strengths[:3]:
            print(f"      • {strength}")
    
    if good_result.issues:
        print(f"    Issues:")
        for issue in good_result.issues[:3]:
            print(f"      • {issue.severity.value.title()}: {issue.message}")
    
    # Validate problematic conversation
    print("\n  2. Problematic Conversation Validation:")
    problematic_result = validator.validate_conversation(problematic_conversation)
    
    print(f"    Overall Score: {problematic_result.overall_score:.2f}")
    print(f"    Clinically Acceptable: {'✅ Yes' if problematic_result.is_clinically_acceptable else '❌ No'}")
    print(f"    Issues Found: {len(problematic_result.issues)}")
    
    if problematic_result.issues:
        print(f"    Critical Issues:")
        for issue in problematic_result.issues:
            if issue.severity in [ValidationSeverity.CRITICAL, ValidationSeverity.HIGH]:
                print(f"      • {issue.severity.value.title()}: {issue.message}")
                print(f"        Category: {issue.category.value.replace('_', ' ').title()}")
                print(f"        Recommendation: {issue.recommendation}")
    
    # Validate inadequate crisis conversation
    print("\n  3. Inadequate Crisis Conversation Validation:")
    crisis_result = validator.validate_conversation(inadequate_crisis_conversation, crisis_scenario)
    
    print(f"    Overall Score: {crisis_result.overall_score:.2f}")
    print(f"    Clinically Acceptable: {'✅ Yes' if crisis_result.is_clinically_acceptable else '❌ No'}")
    print(f"    Issues Found: {len(crisis_result.issues)}")
    
    if crisis_result.issues:
        print(f"    Safety Protocol Issues:")
        for issue in crisis_result.issues:
            if issue.category == ValidationCategory.SAFETY_PROTOCOLS:
                print(f"      • {issue.severity.value.title()}: {issue.message}")
                print(f"        Recommendation: {issue.recommendation}")
    
    # Show detailed validation categories
    print("\n📊 Validation Category Analysis:")
    
    all_results = [good_result, problematic_result, crisis_result]
    category_counts = {}
    severity_counts = {}
    
    for result in all_results:
        for issue in result.issues:
            category = issue.category.value
            severity = issue.severity.value
            category_counts[category] = category_counts.get(category, 0) + 1
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
    
    print(f"\n  Issues by Category:")
    for category, count in sorted(category_counts.items()):
        print(f"    • {category.replace('_', ' ').title()}: {count}")
    
    print(f"\n  Issues by Severity:")
    for severity, count in sorted(severity_counts.items()):
        print(f"    • {severity.title()}: {count}")
    
    # Batch validation demonstration
    print("\n📦 Batch Validation:")
    conversations = [good_conversation, problematic_conversation, inadequate_crisis_conversation]
    scenarios = [good_scenario, None, crisis_scenario]
    
    batch_results = validator.validate_conversation_batch(conversations, scenarios)
    
    print(f"  Validated {len(batch_results)} conversations")
    acceptable_count = sum(1 for r in batch_results if r.is_clinically_acceptable)
    print(f"  Clinically Acceptable: {acceptable_count}/{len(batch_results)} ({acceptable_count/len(batch_results)*100:.1f}%)")
    
    avg_score = sum(r.overall_score for r in batch_results) / len(batch_results)
    print(f"  Average Score: {avg_score:.2f}")
    
    # Statistics demonstration
    print("\n📈 Validation Statistics:")
    stats = validator.get_validation_statistics(batch_results)
    
    print(f"  Total Conversations: {stats['total_conversations']}")
    print(f"  Acceptance Rate: {stats['acceptance_rate']:.1%}")
    print(f"  Average Score: {stats['average_score']:.2f}")
    
    if stats['common_issues']:
        print(f"\n  Most Common Issues:")
        for issue, count in list(stats['common_issues'].items())[:3]:
            print(f"    • {issue} ({count} times)")
    
    if stats['common_strengths']:
        print(f"\n  Most Common Strengths:")
        for strength, count in list(stats['common_strengths'].items())[:3]:
            print(f"    • {strength} ({count} times)")
    
    # Export demonstration
    print("\n💾 Export Capabilities:")
    output_path = Path("demo_validation_results.json")
    success = validator.export_validation_results(batch_results, output_path)
    
    if success:
        print(f"  ✅ Successfully exported validation results to {output_path}")
        print(f"  📁 File size: {output_path.stat().st_size / 1024:.1f} KB")
        
        # Show JSON structure preview
        import json
        with open(output_path, 'r') as f:
            data = json.load(f)
        
        print(f"  📋 JSON Structure:")
        print(f"    • validation_results: {len(data['validation_results'])} items")
        print(f"    • summary: {list(data['summary'].keys())}")
        
        if data['validation_results']:
            sample_result = data['validation_results'][0]
            print(f"    • sample result keys: {list(sample_result.keys())}")
    else:
        print("  ❌ Export failed")
    
    # Show clinical safety features
    print("\n🛡️ Clinical Safety Features:")
    print("  • Ethical compliance monitoring (confidentiality, boundaries)")
    print("  • Professional standards enforcement")
    print("  • Safety protocol validation for crisis situations")
    print("  • Cultural sensitivity assessment")
    print("  • Evidence-based practice verification")
    print("  • Diagnostic accuracy checking")
    print("  • Therapeutic appropriateness evaluation")
    print("  • Comprehensive issue categorization and severity rating")
    print("  • Clinical acceptability determination")
    print("  • Actionable recommendations for improvement")
    
    print("\n✅ Demo completed successfully!")
    print("\nThe Clinical Accuracy Validator ensures that generated therapeutic")
    print("conversations meet professional clinical standards, ethical guidelines,")
    print("and safety requirements. This is essential for creating high-quality")
    print("training data that can be safely used to train therapeutic AI systems.")


if __name__ == "__main__":
    main()
