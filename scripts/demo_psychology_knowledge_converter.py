#!/usr/bin/env python3
"""
Demonstration script for psychology knowledge converter.

This script shows the capabilities of the psychology knowledge converter including:
- Converting DSM-5 knowledge to therapeutic conversations
- Converting Big Five personality knowledge to conversations
- Generating comprehensive conversation datasets
- Exporting conversations for training data
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.dataset_pipeline.psychology_knowledge_converter import (
    PsychologyKnowledgeConverter,
    ConversationType,
    ConversationStyle
)


def main():
    """Demonstrate psychology knowledge converter capabilities."""
    print("🧠 Psychology Knowledge Converter Demo")
    print("=" * 60)
    
    # Initialize converter
    converter = PsychologyKnowledgeConverter()
    
    # Show available knowledge sources
    print("\n📚 Available Knowledge Sources:")
    print("  • DSM-5 Diagnostic Criteria")
    print("  • PDM-2 Psychodynamic Frameworks")
    print("  • Big Five Personality Assessments")
    
    # Show conversation templates
    print("\n📋 Conversation Templates:")
    for category, templates in converter.conversation_templates.items():
        print(f"\n  {category.replace('_', ' ').title()}:")
        for template in templates:
            print(f"    • {template.id}: {template.conversation_type.value}")
            print(f"      Style: {template.style.value}")
            print(f"      Focus: {', '.join(template.clinical_focus[:2])}")
    
    # Generate DSM-5 conversations
    print("\n🔬 DSM-5 Knowledge Conversion:")
    print("Generating conversations from DSM-5 diagnostic criteria...")
    dsm5_conversations = converter.convert_dsm5_to_conversations(count=2)
    
    for i, conversation in enumerate(dsm5_conversations[:2], 1):
        print(f"\n  Conversation {i}: {conversation.context.get('conversation_type', 'Unknown')}")
        print(f"    Disorder: {conversation.context.get('disorder', 'Unknown')}")
        print(f"    Messages: {len(conversation.messages)}")
        print(f"    Learning Objectives: {len(conversation.meta.get('learning_objectives', []))}")
        
        # Show first exchange
        if len(conversation.messages) >= 2:
            therapist_msg = conversation.messages[0]
            client_msg = conversation.messages[1]
            print(f"    Sample Exchange:")
            print(f"      Therapist: {therapist_msg.content[:80]}...")
            print(f"      Client: {client_msg.content[:80]}...")
    
    # Generate Big Five conversations
    print("\n🎭 Big Five Knowledge Conversion:")
    print("Generating conversations from Big Five personality knowledge...")
    big_five_conversations = converter.convert_big_five_to_conversations(count=2)
    
    for i, conversation in enumerate(big_five_conversations[:2], 1):
        print(f"\n  Conversation {i}: {conversation.context.get('conversation_type', 'Unknown')}")
        print(f"    Personality Factor: {conversation.context.get('personality_factor', 'Unknown')}")
        print(f"    Messages: {len(conversation.messages)}")
        
        # Show first exchange
        if len(conversation.messages) >= 2:
            therapist_msg = conversation.messages[0]
            client_msg = conversation.messages[1]
            print(f"    Sample Exchange:")
            print(f"      Therapist: {therapist_msg.content[:80]}...")
            print(f"      Client: {client_msg.content[:80]}...")
    
    # Generate comprehensive dataset
    print("\n📊 Comprehensive Dataset Generation:")
    print("Generating comprehensive conversation dataset...")
    all_conversations = converter.generate_comprehensive_dataset(
        dsm5_count=2,
        big_five_count=2
    )
    
    # Show statistics
    stats = converter.get_statistics(all_conversations)
    print(f"\n  Dataset Statistics:")
    print(f"    Total Conversations: {stats['total_conversations']}")
    print(f"    Total Messages: {stats['total_messages']}")
    print(f"    Average Messages per Conversation: {stats['average_messages_per_conversation']:.1f}")
    
    print(f"\n  Knowledge Sources:")
    for source, count in stats['knowledge_sources'].items():
        print(f"    • {source}: {count} conversations")
    
    print(f"\n  Conversation Types:")
    for conv_type, count in stats['conversation_types'].items():
        print(f"    • {conv_type.replace('_', ' ').title()}: {count} conversations")
    
    # Show detailed conversation example
    print("\n💬 Detailed Conversation Example:")
    if all_conversations:
        example_conv = all_conversations[0]
        print(f"  ID: {example_conv.id}")
        print(f"  Type: {example_conv.context.get('conversation_type', 'Unknown')}")
        print(f"  Knowledge Source: {example_conv.context.get('knowledge_source', 'Unknown')}")
        print(f"  Messages: {len(example_conv.messages)}")
        
        print(f"\n  Learning Objectives:")
        for obj in example_conv.meta.get('learning_objectives', []):
            print(f"    • {obj}")
        
        print(f"\n  Message Flow:")
        for i, message in enumerate(example_conv.messages[:4], 1):  # Show first 4 messages
            role_icon = "🩺" if message.role == "therapist" else "👤"
            print(f"    {i}. {role_icon} {message.role.title()}: {message.content}")
            if message.meta:
                key_meta = {k: v for k, v in message.meta.items() if k in ['type', 'technique', 'assessment_type']}
                if key_meta:
                    print(f"       Meta: {key_meta}")
        
        if len(example_conv.messages) > 4:
            print(f"    ... and {len(example_conv.messages) - 4} more messages")
    
    # Show knowledge integration features
    print("\n🔗 Knowledge Integration Features:")
    print("  • Systematic diagnostic criteria application")
    print("  • Personality trait exploration and assessment")
    print("  • Clinical formulation integration")
    print("  • Therapeutic technique demonstration")
    print("  • Evidence-based conversation patterns")
    print("  • Learning objective alignment")
    print("  • Metadata-rich training data")
    
    # Export demonstration
    print("\n💾 Export Capabilities:")
    output_path = Path("demo_conversations.json")
    success = converter.export_conversations_to_json(all_conversations, output_path)
    if success:
        print(f"  ✅ Successfully exported {len(all_conversations)} conversations to {output_path}")
        print(f"  📁 File size: {output_path.stat().st_size / 1024:.1f} KB")
    else:
        print("  ❌ Export failed")
    
    print("\n✅ Demo completed successfully!")
    print("\nThe Psychology Knowledge Converter transforms structured psychology")
    print("knowledge into realistic therapeutic conversations for training data.")
    print("This enables LLMs to learn clinical assessment and therapeutic dialogue")
    print("patterns grounded in established psychological frameworks.")


if __name__ == "__main__":
    main()
