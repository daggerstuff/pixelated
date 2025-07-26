#!/usr/bin/env python3
"""
Voice Training Data Pipeline CLI.

Command-line interface for processing YouTube playlists through the complete
voice training data pipeline, from download to conversation format.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ai.dataset_pipeline.voice_pipeline_integration import (
    VoiceTrainingPipeline,
    VoicePipelineConfig,
    process_youtube_voice_data
)
from ai.dataset_pipeline.youtube_processor import (
    RateLimitConfig,
    ProxyConfig,
    AntiDetectionConfig
)


from datetime import datetime  # ← add this at the top with your other imports

def setup_logging(log_level: str = "INFO"):
    """Setup logging configuration."""
    # Create a more descriptive log filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f'voice_pipeline_{timestamp}.log'

    handlers = [logging.StreamHandler(sys.stdout)]

    # Add file handler with error handling
    try:
        handlers.append(logging.FileHandler(log_filename))
    except OSError as e:
        print(f"Warning: Could not create log file {log_filename}: {e}")

    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers
    )

def load_urls_from_file(file_path: str) -> list:
    """Load YouTube URLs from a text file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        return urls
    except Exception as e:
        print(f"Error reading URL file {file_path}: {e}")
        return []


def load_proxy_list(file_path: str) -> list:
    """Load proxy list from a text file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            proxies = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        return proxies
    except Exception as e:
        print(f"Error reading proxy file {file_path}: {e}")
        return []


def build_configurations(args):
    """Build rate limiting, proxy, and anti-detection configurations from CLI args."""
    # Rate limiting configuration
    rate_config = RateLimitConfig(
        enabled=not args.disable_rate_limiting,
        requests_per_minute=args.requests_per_minute,
        requests_per_hour=args.requests_per_hour,
        burst_limit=args.burst_limit,
        backoff_factor=args.backoff_factor,
        max_backoff=args.max_backoff,
        jitter=True,
        respect_429=True
    )

    # Proxy configuration
    proxy_list = []
    if args.proxy_list:
        proxy_list = load_proxy_list(args.proxy_list)
    elif args.proxy:
        proxy_list = [args.proxy]

    proxy_config = ProxyConfig(
        enabled=bool(proxy_list),
        proxy_list=proxy_list,
        rotation_strategy=args.proxy_rotation,
        proxy_timeout=30,
        max_retries_per_proxy=args.proxy_retries,
        test_url="https://httpbin.org/ip"
    )

    # Anti-detection configuration
    anti_detection_config = AntiDetectionConfig(
        enabled=not args.disable_anti_detection,
        randomize_user_agents=not args.disable_user_agent_rotation,
        randomize_delays=True,
        min_delay=args.min_delay,
        max_delay=args.max_delay,
        use_cookies=not args.disable_cookies,
        simulate_browser=True,
        geo_bypass=not args.disable_geo_bypass
    )

    return rate_config, proxy_config, anti_detection_config


async def main():
    """Main CLI function."""
    parser = argparse.ArgumentParser(
        description="Process YouTube playlists through voice training data pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process single playlist with default settings
  python scripts/run_voice_pipeline.py --url "https://youtube.com/playlist?list=..."
  
  # Process multiple playlists from file
  python scripts/run_voice_pipeline.py --url-file playlists.txt --output-dir voice_data
  
  # Use higher quality Whisper model with custom settings
  python scripts/run_voice_pipeline.py --url-file playlists.txt --whisper-model large --quality-threshold 0.7
  
  # Quick processing with minimal quality filtering
  python scripts/run_voice_pipeline.py --url "..." --whisper-model tiny --quality-threshold 0.3
        """
    )

    # Input options
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--url",
        type=str,
        help="Single YouTube playlist or video URL"
    )
    input_group.add_argument(
        "--url-file",
        type=str,
        help="File containing YouTube URLs (one per line)"
    )

    # Output options
    parser.add_argument(
        "--output-dir",
        type=str,
        default="voice_training_data",
        help="Base output directory for all pipeline results (default: voice_training_data)"
    )

    # Processing options
    parser.add_argument(
        "--whisper-model",
        type=str,
        default="base",
        choices=["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"],
        help="Whisper model to use for transcription (default: base)"
    )

    parser.add_argument(
        "--language",
        type=str,
        default=None,
        help="Language for transcription (auto-detect if not specified)"
    )

    parser.add_argument(
        "--quality-threshold",
        type=float,
        default=0.5,
        help="Minimum quality threshold for conversations (0.0-1.0, default: 0.5)"
    )

    parser.add_argument(
        "--max-concurrent",
        type=int,
        default=3,
        help="Maximum concurrent downloads (default: 3)"
    )

    parser.add_argument(
        "--audio-format",
        type=str,
        default="wav",
        choices=["wav", "mp3", "flac", "ogg"],
        help="Audio format for processing (default: wav)"
    )

    parser.add_argument(
        "--sample-rate",
        type=int,
        default=16000,
        choices=[8000, 16000, 22050, 44100, 48000],
        help="Target sample rate for audio processing (default: 16000)"
    )

    # Advanced options
    parser.add_argument(
        "--min-conversation-length",
        type=int,
        default=3,
        help="Minimum number of messages per conversation (default: 3)"
    )

    parser.add_argument(
        "--transcription-confidence",
        type=float,
        default=0.6,
        help="Minimum transcription confidence threshold (default: 0.6)"
    )

    parser.add_argument(
        "--use-openai-whisper",
        action="store_true",
        help="Use OpenAI Whisper instead of Faster-Whisper"
    )

    parser.add_argument(
        "--no-intermediate-files",
        action="store_true",
        help="Don't save intermediate processing files (saves disk space)"
    )

    # Utility options
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: INFO)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without actually processing"
    )

    # Rate limiting options
    parser.add_argument(
        "--disable-rate-limiting",
        action="store_true",
        help="Disable rate limiting (not recommended for production)"
    )

    parser.add_argument(
        "--requests-per-minute",
        type=int,
        default=30,
        help="Maximum requests per minute (default: 30)"
    )

    parser.add_argument(
        "--requests-per-hour",
        type=int,
        default=1000,
        help="Maximum requests per hour (default: 1000)"
    )

    parser.add_argument(
        "--burst-limit",
        type=int,
        default=5,
        help="Maximum concurrent requests (default: 5)"
    )

    parser.add_argument(
        "--backoff-factor",
        type=float,
        default=1.5,
        help="Exponential backoff multiplier (default: 1.5)"
    )

    parser.add_argument(
        "--max-backoff",
        type=int,
        default=300,
        help="Maximum backoff time in seconds (default: 300)"
    )

    # Proxy options
    parser.add_argument(
        "--proxy-list",
        type=str,
        help="File containing list of proxies (one per line)"
    )

    parser.add_argument(
        "--proxy",
        type=str,
        help="Single proxy to use (format: http://host:port or socks5://host:port)"
    )

    parser.add_argument(
        "--proxy-rotation",
        choices=["random", "round_robin", "sticky"],
        default="random",
        help="Proxy rotation strategy (default: random)"
    )

    parser.add_argument(
        "--proxy-retries",
        type=int,
        default=2,
        help="Max retries per proxy before marking as failed (default: 2)"
    )

    # Anti-detection options
    parser.add_argument(
        "--disable-anti-detection",
        action="store_true",
        help="Disable anti-detection measures"
    )

    parser.add_argument(
        "--disable-user-agent-rotation",
        action="store_true",
        help="Disable user agent rotation"
    )

    parser.add_argument(
        "--min-delay",
        type=float,
        default=1.0,
        help="Minimum delay between requests in seconds (default: 1.0)"
    )

    parser.add_argument(
        "--max-delay",
        type=float,
        default=5.0,
        help="Maximum delay between requests in seconds (default: 5.0)"
    )

    parser.add_argument(
        "--disable-cookies",
        action="store_true",
        help="Disable cookie usage"
    )

    parser.add_argument(
        "--disable-geo-bypass",
        action="store_true",
        help="Disable geo-bypass"
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.log_level)
    logger = logging.getLogger("voice_pipeline_cli")

    # Load URLs
    if args.url:
        urls = [args.url]
    else:
        urls = load_urls_from_file(args.url_file)
        if not urls:
            logger.error(f"No valid URLs found in {args.url_file}")
            return 1

    logger.info(f"Loaded {len(urls)} URLs for processing")

    if args.dry_run:
        logger.info("DRY RUN - Would process the following URLs:")
        for i, url in enumerate(urls, 1):
            logger.info(f"  {i}. {url}")
        logger.info(f"Output directory: {args.output_dir}")
        logger.info(f"Whisper model: {args.whisper_model}")
        logger.info(f"Quality threshold: {args.quality_threshold}")
        return 0

    # Build enhanced configurations
    rate_config, proxy_config, anti_detection_config = build_configurations(args)

    # Log configuration summary
    logger.info("Configuration Summary:")
    logger.info(f"  Rate Limiting: {'Enabled' if rate_config.enabled else 'Disabled'}")
    if rate_config.enabled:
        logger.info(f"    Requests/min: {rate_config.requests_per_minute}")
        logger.info(f"    Requests/hour: {rate_config.requests_per_hour}")
        logger.info(f"    Burst limit: {rate_config.burst_limit}")

    logger.info(f"  Proxy Support: {'Enabled' if proxy_config.enabled else 'Disabled'}")
    if proxy_config.enabled:
        logger.info(f"    Proxy count: {len(proxy_config.proxy_list)}")
        logger.info(f"    Rotation: {proxy_config.rotation_strategy}")

    logger.info(f"  Anti-Detection: {'Enabled' if anti_detection_config.enabled else 'Disabled'}")
    if anti_detection_config.enabled:
        logger.info(f"    User agent rotation: {anti_detection_config.randomize_user_agents}")
        logger.info(f"    Delay range: {anti_detection_config.min_delay}-{anti_detection_config.max_delay}s")

    # Create pipeline configuration
    config = VoicePipelineConfig(
        youtube_output_dir=f"{args.output_dir}/youtube",
        audio_output_dir=f"{args.output_dir}/processed_audio",
        transcription_output_dir=f"{args.output_dir}/transcriptions",
        personality_output_dir=f"{args.output_dir}/personalities",
        conversation_output_dir=f"{args.output_dir}/conversations",
        audio_format=args.audio_format,
        max_concurrent_downloads=args.max_concurrent,
        target_sample_rate=args.sample_rate,
        whisper_model=args.whisper_model,
        transcription_language=args.language,
        min_transcription_confidence=args.transcription_confidence,
        use_faster_whisper=not args.use_openai_whisper,
        min_conversation_length=args.min_conversation_length,
        overall_quality_threshold=args.quality_threshold,
        save_intermediate_results=not args.no_intermediate_files,
        # Enhanced configurations
        rate_limit_config=rate_config,
        proxy_config=proxy_config,
        anti_detection_config=anti_detection_config
    )

    # Initialize and run pipeline
    try:
        logger.info("Initializing voice training pipeline...")
        pipeline = VoiceTrainingPipeline(config)

        logger.info("Starting pipeline processing...")
        result = await pipeline.process_youtube_playlists(urls)

        # Generate and display report
        report = pipeline.generate_pipeline_report(result)
        print("\n" + report)

        if result.success:
            logger.info("Pipeline completed successfully!")
            logger.info(f"Generated {result.total_conversations} high-quality conversations")
            logger.info(f"Output saved to: {args.output_dir}")
            return 0
        else:
            logger.error("Pipeline processing failed")
            if result.errors:
                logger.error("Errors encountered:")
                for error in result.errors[:5]:  # Show first 5 errors
                    logger.error(f"  - {error}")
            return 1

    except KeyboardInterrupt:
        logger.info("Pipeline interrupted by user")
        return 1
    except Exception as e:
        logger.error(f"Pipeline failed with exception: {e}")
        return 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)
