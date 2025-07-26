#!/usr/bin/env python3
"""
Voice Training Data Pipeline Usage Examples.

This file demonstrates how to use the voice processing pipeline
for converting YouTube content into training conversations.
"""

import asyncio
import sys
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ai.dataset_pipeline.voice_pipeline_integration import (
    VoiceTrainingPipeline,
    VoicePipelineConfig,
    process_youtube_voice_data
)


async def example_simple_processing():
    """Simple example using the convenience function."""
    print("=== Simple Voice Pipeline Processing ===")
    
    # Example YouTube URLs (replace with actual URLs)
    playlist_urls = [
        "https://www.youtube.com/playlist?list=PLexample1",
        "https://www.youtube.com/watch?v=example_video_id"
    ]
    
    try:
        result = await process_youtube_voice_data(
            playlist_urls=playlist_urls,
            output_base_dir="voice_training_output",
            whisper_model="base",
            quality_threshold=0.6
        )
        
        if result.success:
            print(f"✅ Processing successful!")
            print(f"Generated {result.total_conversations} conversations")
            print(f"Processing time: {result.processing_time:.2f} seconds")
        else:
            print(f"❌ Processing failed")
            for error in result.errors[:3]:
                print(f"  Error: {error}")
                
    except Exception as e:
        print(f"Exception during processing: {e}")


async def example_advanced_configuration():
    """Advanced example with custom configuration."""
    print("\n=== Advanced Voice Pipeline Configuration ===")
    
    # Custom configuration
    config = VoicePipelineConfig(
        # Output directories
        youtube_output_dir="advanced_output/youtube",
        audio_output_dir="advanced_output/audio",
        transcription_output_dir="advanced_output/transcriptions",
        conversation_output_dir="advanced_output/conversations",
        
        # Processing settings
        whisper_model="large",  # Higher quality model
        transcription_language="en",  # Force English
        audio_format="wav",
        target_sample_rate=16000,
        
        # Quality thresholds
        overall_quality_threshold=0.7,  # Higher quality requirement
        min_transcription_confidence=0.7,
        audio_quality_threshold=0.6,
        
        # Performance settings
        max_concurrent_downloads=2,  # Conservative for large model
        
        # Conversation settings
        min_conversation_length=5,  # Longer conversations
        max_speaker_gap=20.0,  # Shorter gap for speaker changes
        
        # Options
        use_faster_whisper=True,  # Use Faster-Whisper for speed
        save_intermediate_results=True  # Keep all intermediate files
    )
    
    # Initialize pipeline
    pipeline = VoiceTrainingPipeline(config)
    
    # Example URLs
    urls = [
        "https://www.youtube.com/playlist?list=PLexample_therapy_sessions",
        "https://www.youtube.com/playlist?list=PLexample_interviews"
    ]
    
    try:
        result = await pipeline.process_youtube_playlists(urls)
        
        # Generate detailed report
        report = pipeline.generate_pipeline_report(result)
        print(report)
        
        # Save report to file
        report_path = Path(config.conversation_output_dir) / "processing_report.txt"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"\nDetailed report saved to: {report_path}")
        
    except Exception as e:
        print(f"Exception during advanced processing: {e}")


async def example_batch_processing():
    """Example of processing multiple batches with different settings."""
    print("\n=== Batch Processing Example ===")
    
    # Different batches with different quality requirements
    batches = [
        {
            "name": "High Quality Therapy Sessions",
            "urls": ["https://www.youtube.com/playlist?list=PLtherapy_high_quality"],
            "config": VoicePipelineConfig(
                whisper_model="large",
                overall_quality_threshold=0.8,
                min_conversation_length=10,
                conversation_output_dir="output/high_quality"
            )
        },
        {
            "name": "General Conversations",
            "urls": ["https://www.youtube.com/playlist?list=PLgeneral_conversations"],
            "config": VoicePipelineConfig(
                whisper_model="base",
                overall_quality_threshold=0.5,
                min_conversation_length=3,
                conversation_output_dir="output/general"
            )
        },
        {
            "name": "Quick Processing",
            "urls": ["https://www.youtube.com/playlist?list=PLquick_content"],
            "config": VoicePipelineConfig(
                whisper_model="tiny",
                overall_quality_threshold=0.3,
                min_conversation_length=2,
                conversation_output_dir="output/quick",
                save_intermediate_results=False
            )
        }
    ]
    
    total_conversations = 0
    
    for batch in batches:
        print(f"\nProcessing batch: {batch['name']}")
        
        pipeline = VoiceTrainingPipeline(batch['config'])
        result = await pipeline.process_youtube_playlists(batch['urls'])
        
        if result.success:
            print(f"  ✅ {result.total_conversations} conversations generated")
            total_conversations += result.total_conversations
        else:
            print(f"  ❌ Batch failed: {len(result.errors)} errors")
    
    print(f"\n🎉 Total conversations generated across all batches: {total_conversations}")


def example_cli_usage():
    """Show CLI usage examples."""
    print("\n=== CLI Usage Examples ===")
    
    cli_examples = [
        "# Simple single playlist processing",
        'python scripts/run_voice_pipeline.py --url "https://youtube.com/playlist?list=..." --output-dir voice_data',
        "",
        "# Process multiple playlists from file",
        "python scripts/run_voice_pipeline.py --url-file playlists.txt --whisper-model large",
        "",
        "# High quality processing with custom settings",
        "python scripts/run_voice_pipeline.py --url-file therapy_playlists.txt \\",
        "  --whisper-model large --quality-threshold 0.8 --min-conversation-length 5",
        "",
        "# Quick processing for testing",
        "python scripts/run_voice_pipeline.py --url \"...\" --whisper-model tiny \\",
        "  --quality-threshold 0.3 --no-intermediate-files",
        "",
        "# Dry run to see what would be processed",
        "python scripts/run_voice_pipeline.py --url-file playlists.txt --dry-run"
    ]
    
    for line in cli_examples:
        print(line)


async def main():
    """Run all examples."""
    print("Voice Training Data Pipeline Usage Examples")
    print("=" * 50)
    
    # Note: These examples use placeholder URLs
    # Replace with actual YouTube URLs for real processing
    print("⚠️  Note: Replace example URLs with actual YouTube URLs")
    print("⚠️  Ensure you have proper permissions for the content you're processing")
    print()
    
    # Run examples (commented out to avoid actual processing)
    # await example_simple_processing()
    # await example_advanced_configuration()
    # await example_batch_processing()
    
    # Show CLI examples
    example_cli_usage()
    
    print("\n" + "=" * 50)
    print("Examples complete! Uncomment the async calls to run actual processing.")


if __name__ == "__main__":
    asyncio.run(main())
