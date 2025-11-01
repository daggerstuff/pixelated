#!/usr/bin/env python3
"""
Pixelated Empathy AI - Python Client Usage Examples
Task 3A.3.4: API Usage Examples and Tutorials

Comprehensive examples demonstrating common use cases with the Python client.
"""

import asyncio
import os
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Add the client path
sys.path.insert(0, str(Path(__file__).parent.parent / "clients/python"))

from pixelated_empathy_client import (
    PixelatedEmpathyClient,
    AdvancedQuery,
    BulkExportRequest,
    QualityTier,
    ExportFormat,
    JobStatus,
    quick_query,
    quick_export
)


# Example 1: Basic Dataset Discovery
async def example_basic_discovery():
    """Discover available datasets and their information."""
    print("=== Example 1: Basic Dataset Discovery ===")
    
    api_key = os.getenv("PIXELATED_API_KEY", "demo-api-key")
    
    async with PixelatedEmpathyClient(api_key) as client:
        # List all available datasets
        datasets = await client.list_datasets()
        print(f"Found {len(datasets)} datasets:")
        
        for dataset in datasets:
            print(f"  - {dataset['name']}: {dataset['conversations']:,} conversations")
            print(f"    Quality: {dataset['quality_score']:.3f}")
            print(f"    Tiers: {', '.join(dataset['tiers'])}")
        
        # Get detailed info for first dataset
        if datasets:
            first_dataset = datasets[0]['name']
            info = await client.get_dataset_info(first_dataset)
            print(f"\nDetailed info for '{first_dataset}':")
            print(f"  Last updated: {info['statistics']['last_updated']}")
            print(f"  Tier distribution: {info['statistics']['tier_distribution']}")


# Example 2: Advanced Conversation Querying
async def example_advanced_querying():
    """Demonstrate advanced conversation querying with multiple filters."""
    print("\n=== Example 2: Advanced Conversation Querying ===")
    
    api_key = os.getenv("PIXELATED_API_KEY", "demo-api-key")
    
    async with PixelatedEmpathyClient(api_key) as client:
        # Query high-quality professional conversations
        query = AdvancedQuery(
            tier="professional",
            min_quality=0.8,
            min_therapeutic_accuracy=0.75,
            min_safety_score=0.9,
            created_after=datetime.now() - timedelta(days=30),
            sort_by="quality_score",
            sort_order="desc",
            limit=20
        )
        
        results = await client.query_conversations(query)
        print(f"Found {len(results.get('conversations', []))} high-quality conversations")
        
        # Display first few results
        for i, conv in enumerate(results.get('conversations', [])[:3]):
            print(f"\nConversation {i+1}:")
            print(f"  ID: {conv['id']}")
            print(f"  Quality Score: {conv['quality_score']:.3f}")
            print(f"  Messages: {conv['message_count']}")
            print(f"  Dataset: {conv.get('dataset', 'unknown')}")


# Example 3: Content Search and Filtering
async def example_content_search():
    """Search conversations by content with advanced filtering."""
    print("\n=== Example 3: Content Search and Filtering ===")
    
    api_key = os.getenv("PIXELATED_API_KEY", "demo-api-key")
    
    async with PixelatedEmpathyClient(api_key) as client:
        # Search for conversations about anxiety
        search_query = AdvancedQuery(
            content_search="anxiety depression",
            min_quality=0.7,
            tier="professional",
            min_messages=5,
            limit=10
        )
        
        results = await client.query_conversations(search_query)
        print(f"Found {len(results.get('conversations', []))} conversations about anxiety/depression")
        
        # Also use the search endpoint
        search_results = await client.search_conversations(
            query="therapeutic intervention",
            filters={"tier": "clinical", "min_quality": 0.8},
            limit=5
        )
        
        print(f"Search endpoint found {len(search_results.get('results', []))} therapeutic conversations")
        for result in search_results.get('results', [])[:3]:
            print(f"  - {result['conversation_id']}: {result['relevance_score']:.3f} relevance")


# Example 4: Bulk Export Operations
async def example_bulk_export():
    """Demonstrate bulk export operations with job tracking."""
    print("\n=== Example 4: Bulk Export Operations ===")
    
    api_key = os.getenv("PIXELATED_API_KEY", "demo-api-key")
    
    async with PixelatedEmpathyClient(api_key) as client:
        # Create a filtered export job
        export_request = BulkExportRequest(
            dataset="priority_complete_fixed",
            format=ExportFormat.JSONL,
            filters=AdvancedQuery(
                tier="professional",
                min_quality=0.8,
                limit=1000
            ),
            include_metadata=True,
            include_quality_metrics=True,
            notify_email="researcher@example.com"
        )
        
        # Submit export job
        job_id = await client.create_bulk_export(export_request)
        print(f"Created export job: {job_id}")
        
        # Check initial status
        status = await client.get_export_status(job_id)
        print(f"Initial status: {status['status']} ({status['progress']:.1f}%)")
        
        # List recent export jobs
        recent_jobs = await client.list_export_jobs(limit=5)
        print(f"\nRecent export jobs ({len(recent_jobs)}):")
        for job in recent_jobs:
            print(f"  {job['job_id']}: {job['status']} ({job['progress']:.1f}%)")


# Example 5: Quality Assessment and Validation
async def example_quality_assessment():
    """Demonstrate quality assessment and validation features."""
    print("\n=== Example 5: Quality Assessment and Validation ===")
    
    api_key = os.getenv("PIXELATED_API_KEY", "demo-api-key")
    
    async with PixelatedEmpathyClient(api_key) as client:
        # Get system-wide quality metrics
        metrics = await client.get_quality_metrics()
        print("System-wide quality metrics:")
        print(f"  Average quality: {metrics['overall_statistics']['average_quality']:.3f}")
        print(f"  Total conversations: {metrics['overall_statistics']['total_conversations']:,}")
        
        # Get tier-specific metrics
        for tier, data in metrics['tier_metrics'].items():
            print(f"  {tier.title()}: {data['average_quality']:.3f} ({data['count']:,} conversations)")
        
        # Validate a sample conversation
        sample_conversation = {
            "id": "sample_001",
            "messages": [
                {
                    "role": "user",
                    "content": "I'm feeling overwhelmed with work stress.",
                    "timestamp": "2025-08-29T08:00:00Z"
                },
                {
                    "role": "assistant", 
                    "content": "I understand that work stress can feel overwhelming. Can you tell me more about what specifically is causing you the most stress right now?",
                    "timestamp": "2025-08-29T08:00:30Z"
                }
            ],
            "quality_score": 0.85,
            "tier": "professional"
        }
        
        validation = await client.validate_conversation_quality(sample_conversation)
        print(f"\nValidation results for sample conversation:")
        print(f"  Overall quality: {validation['validation_results']['overall_quality']:.3f}")
        print(f"  Tier classification: {validation['tier_classification']}")
        print(f"  Recommendations: {len(validation['recommendations'])} suggestions")


# Example 6: Usage Monitoring and Analytics
async def example_usage_monitoring():
    """Demonstrate usage monitoring and analytics features."""
    print("\n=== Example 6: Usage Monitoring and Analytics ===")
    
    api_key = os.getenv("PIXELATED_API_KEY", "demo-api-key")
    
    async with PixelatedEmpathyClient(api_key) as client:
        # Get comprehensive usage statistics
        usage = await client.get_usage_statistics()
        
        print("Your API usage statistics:")
        user_stats = usage['user_statistics']
        print(f"  Total requests: {user_stats['total_requests']:,}")
        print(f"  Requests today: {user_stats['requests_today']:,}")
        print(f"  Account created: {user_stats['account_created']}")
        print(f"  Most used endpoint: {user_stats.get('most_used_endpoint', 'N/A')}")
        
        # Rate limiting information
        rate_info = usage['rate_limiting']
        print(f"\nRate limiting status:")
        print(f"  Current window requests: {rate_info['current_window_requests']}")
        print(f"  Hourly limit: {rate_info['hourly_limit']}")
        print(f"  Remaining requests: {rate_info['remaining_requests']}")
        print(f"  Status: {rate_info['rate_limit_status']}")
        
        # System statistics
        system_stats = usage['system_statistics']
        print(f"\nSystem statistics:")
        print(f"  Active users: {system_stats['total_active_users']:,}")
        print(f"  Total requests today: {system_stats['total_requests_today_all_users']:,}")
        
        # Get system overview
        overview = await client.get_statistics_overview()
        print(f"\nSystem overview:")
        print(f"  Total conversations: {overview['total_conversations']:,}")
        print(f"  Success rate: {overview['processing_statistics']['success_rate']}")


# Example 7: Production Workflow
async def example_production_workflow():
    """Demonstrate a complete production workflow."""
    print("\n=== Example 7: Complete Production Workflow ===")
    
    api_key = os.getenv("PIXELATED_API_KEY", "demo-api-key")
    
    async with PixelatedEmpathyClient(api_key) as client:
        # Step 1: Discover datasets
        datasets = await client.list_datasets()
        target_dataset = datasets[0]['name'] if datasets else "priority_complete_fixed"
        print(f"Target dataset: {target_dataset}")
        
        # Step 2: Query research-grade conversations
        research_query = AdvancedQuery(
            dataset=target_dataset,
            tier="research",
            min_quality=0.82,
            min_therapeutic_accuracy=0.8,
            min_emotional_authenticity=0.75,
            sort_by="quality_score",
            sort_order="desc",
            limit=50
        )
        
        conversations = await client.query_conversations(research_query)
        print(f"Found {len(conversations.get('conversations', []))} research-grade conversations")
        
        # Step 3: Export filtered dataset
        if conversations.get('conversations'):
            export_request = BulkExportRequest(
                dataset=target_dataset,
                format=ExportFormat.HUGGINGFACE,
                filters=research_query,
                include_metadata=True,
                include_quality_metrics=True
            )
            
            # Create export and wait for completion
            try:
                final_status = await client.export_and_wait(
                    export_request,
                    poll_interval=10,  # Check every 10 seconds
                    timeout=300        # 5 minute timeout
                )
                
                if final_status['status'] == JobStatus.COMPLETED.value:
                    print(f"Export completed successfully!")
                    print(f"  File size: {final_status.get('file_size', 0):,} bytes")
                    print(f"  Download URL: {final_status.get('download_url', 'N/A')}")
                else:
                    print(f"Export failed: {final_status.get('error_message', 'Unknown error')}")
                    
            except Exception as e:
                print(f"Export workflow error: {e}")


# Example 8: Error Handling and Resilience
async def example_error_handling():
    """Demonstrate proper error handling and resilience patterns."""
    print("\n=== Example 8: Error Handling and Resilience ===")
    
    api_key = os.getenv("PIXELATED_API_KEY", "demo-api-key")
    
    # Custom client with specific retry settings
    client = PixelatedEmpathyClient(
        api_key,
        timeout=10,
        max_retries=5,
        retry_backoff=2.0,
        enable_logging=True
    )
    
    try:
        # This might hit rate limits or timeout
        results = []
        for i in range(10):  # Make multiple rapid requests
            try:
                datasets = await client.list_datasets()
                results.append(len(datasets))
                print(f"Request {i+1}: {len(datasets)} datasets")
                
            except Exception as e:
                print(f"Request {i+1} failed: {type(e).__name__}: {e}")
                
                # Handle specific error types
                if hasattr(e, 'retry_after'):
                    print(f"Rate limited, retry after: {e.retry_after} seconds")
                elif hasattr(e, 'status_code') and e.status_code == 401:
                    print("Authentication failed - check your API key")
                    break
                
                # Continue with other requests
                await asyncio.sleep(1)
                
    finally:
        await client.close()
    
    print(f"Completed {len(results)} successful requests")


# Example 9: Convenience Functions
async def example_convenience_functions():
    """Demonstrate quick convenience functions for simple use cases."""
    print("\n=== Example 9: Convenience Functions ===")
    
    api_key = os.getenv("PIXELATED_API_KEY", "demo-api-key")
    
    # Quick query without managing client
    query = AdvancedQuery(
        tier="professional",
        min_quality=0.8,
        limit=5
    )
    
    try:
        results = await quick_query(api_key, query)
        print(f"Quick query found {len(results.get('conversations', []))} conversations")
        
        # Quick export
        job_id = await quick_export(api_key, "priority_complete_fixed", ExportFormat.CSV)
        print(f"Quick export job created: {job_id}")
        
    except Exception as e:
        print(f"Convenience function error: {e}")


# Main example runner
async def main():
    """Run all examples in sequence."""
    print("Pixelated Empathy AI - Python Client Examples")
    print("=" * 50)
    
    examples = [
        example_basic_discovery,
        example_advanced_querying,
        example_content_search,
        example_bulk_export,
        example_quality_assessment,
        example_usage_monitoring,
        example_production_workflow,
        example_error_handling,
        example_convenience_functions,
    ]
    
    for i, example in enumerate(examples, 1):
        try:
            await example()
            if i < len(examples):
                print("\n" + "-" * 50)
                await asyncio.sleep(1)  # Brief pause between examples
        except Exception as e:
            print(f"Example {i} failed: {e}")


if __name__ == "__main__":
    # Set your API key in environment variable or replace here
    if not os.getenv("PIXELATED_API_KEY"):
        print("⚠️  Set PIXELATED_API_KEY environment variable for live testing")
        print("   Using demo key for examples (will show mock responses)")
        print()
    
    asyncio.run(main())