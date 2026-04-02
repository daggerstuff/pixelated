#!/usr/bin/env python3
"""
PIX-4: YouTube Transcript Extraction Script for Therapeutic Content

This script extracts transcripts from YouTube videos focusing on mental health,
therapy, and psychology content. It integrates with the existing pipeline infrastructure
and applies safety filtering and classification.

Features:
- YouTube Data API v3 integration for video discovery
- Transcript extraction via youtube-transcript-api
- Therapeutic content detection and classification
- Safety filtering with crisis detection
- JSONL output compatible with training pipeline
- Batch processing with rate limiting

Usage:
    # Extract from specific channels
    python scripts/data/extract_youtube_transcripts.py --channels "Tim Fletcher,Psych2Go"

    # Process all therapeutic content
    python scripts/data/extract_youtube_transcripts.py --therapeutic-only

    # Limit number of videos
    python scripts/data/extract_youtube_transcripts.py --max-videos 100

    # Output to specific location
    python scripts/data/extract_youtube_transcripts.py --output data/youtube_extracted.jsonl
"""

import re
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import argparse
import json
import logging
import os

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

    YOUTUBE_TRANSCRIPT_API_AVAILABLE = True
except ImportError:
    YOUTUBE_TRANSCRIPT_API_AVAILABLE = False

try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError

    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False

try:
    from ai.pipelines.design.hybrid_classifier import HybridTaxonomyClassifier
    from ai.safety.crisis_detection.production_crisis_detector import CrisisDetector

    PIPELINE_COMPONENTS_AVAILABLE = True
except ImportError:
    PIPELINE_COMPONENTS_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("youtube_extractor")


# === Configuration ===


@dataclass
class YouTubeExtractionConfig:
    """Configuration for YouTube transcript extraction."""

    youtube_api_key: str | None = None
    max_videos_per_channel: int = 50
    output_format: str = "jsonl"
    include_auto_generated: bool = True
    languages: list[str] = field(default_factory=lambda: ["en", "en-US"])
    min_transcript_length: int = 100  # Minimum characters
    apply_safety_filter: bool = True
    apply_classification: bool = True
    rate_limit_delay: float = 1.0  # Seconds between API calls


@dataclass
class VideoMetadata:
    """Metadata for a YouTube video."""

    video_id: str
    title: str
    channel_id: str
    channel_title: str
    description: str
    published_at: str
    duration_seconds: int
    view_count: int
    like_count: int
    comment_count: int
    transcript_text: str = ""
    transcript_language: str = ""
    therapeutic_category: str = ""
    crisis_flag: bool = False
    quality_score: float = 0.0
    extraction_timestamp: str = ""
    source: str = "youtube"


# === Therapeutic Content Channels ===

THERAPEUTIC_CHANNELS = {
    # Tim Fletcher - CPTSD and trauma recovery
    "UCYZ8PaMPavVvbvHX_PeZdBQ": {
        "name": "Tim Fletcher",
        "focus": "CPTSD, trauma recovery, childhood abuse",
        "priority": "high",
    },
    # Psych2Go - Mental health education
    "UCDjFGL5z8Dh7v-tW5WPM6Jg": {
        "name": "Psych2Go",
        "focus": "Mental health education, psychology",
        "priority": "medium",
    },
    # Therapy in a Nutshell
    "UC1nAvec3f9yj6n3eP3sAWzA": {
        "name": "Therapy in a Nutshell",
        "focus": "Therapy techniques, mental health",
        "priority": "high",
    },
    # The Healthy Gamer
    "UClZY2N4I8mulgfYbDc8X-OQ": {
        "name": "Healthy Gamer",
        "focus": "Mental health, gaming addiction",
        "priority": "medium",
    },
    # Dr. Julie Smith
    "UC6_HEau1dmbcoPTM8Hm4GXQ": {
        "name": "Dr. Julie Smith",
        "focus": "Psychology, mental health tips",
        "priority": "high",
    },
}

THERAPEUTIC_KEYWORDS = [
    "therapy",
    "therapist",
    "counseling",
    "counselor",
    "mental health",
    "psychology",
    "psychiatrist",
    "anxiety",
    "depression",
    "ptsd",
    "trauma",
    "cptsd",
    "borderline",
    "bpd",
    "narcissist",
    "narcissism",
    "emotional",
    "feelings",
    "healing",
    "recovery",
    "mindfulness",
    "meditation",
    "self-care",
    "childhood",
    "attachment",
    "abuse",
    "neglect",
]


class YouTubeTranscriptExtractor:
    """
    Extract transcripts from YouTube videos with therapeutic content focus.
    """

    def __init__(self, config: YouTubeExtractionConfig):
        self.config = config
        self.youtube_client = None
        self.crisis_detector = None
        self.classifier = None

        # Initialize YouTube API client
        if GOOGLE_API_AVAILABLE and config.youtube_api_key:
            try:
                self.youtube_client = build("youtube", "v3", developerKey=config.youtube_api_key)
                logger.info("✅ YouTube API client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize YouTube API client: {e}")

        # Initialize pipeline components
        if PIPELINE_COMPONENTS_AVAILABLE:
            if config.apply_safety_filter:
                self.crisis_detector = CrisisDetector()
                logger.info("✅ Crisis detector initialized")

            if config.apply_classification:
                self.classifier = HybridTaxonomyClassifier(enable_llm=False)
                logger.info("✅ Taxonomy classifier initialized")

    def search_therapeutic_videos(self, max_results: int = 100) -> list[dict[str, Any]]:
        """Search for therapeutic videos on YouTube."""
        if not self.youtube_client:
            logger.warning("YouTube API client not available")
            return []

        videos = []
        search_queries = [
            "mental health therapy",
            "counseling techniques",
            "psychology education",
            "trauma recovery",
            "anxiety treatment",
            "depression help",
        ]

        for query in search_queries:
            try:
                search_response = (
                    self.youtube_client.search()
                    .list(
                        q=query,
                        part="id,snippet",
                        maxResults=min(50, max_results),
                        type="video",
                        videoDuration="medium",  # 4-20 minutes
                        relevanceLanguage="en",
                    )
                    .execute()
                )

                for item in search_response.get("items", []):
                    video_id = item["id"]["videoId"]
                    video_data = self._get_video_details(video_id)
                    if video_data:
                        videos.append(video_data)

                # Rate limiting
                time.sleep(self.config.rate_limit_delay)

            except HttpError as e:
                logger.error(f"YouTube API error for query '{query}': {e}")
                continue

        logger.info(f"Found {len(videos)} videos from therapeutic searches")
        return videos

    def get_channel_videos(
        self, channel_id: str, max_videos: int | None = None
    ) -> list[dict[str, Any]]:
        """Get videos from a specific YouTube channel."""
        if not self.youtube_client:
            logger.warning("YouTube API client not available")
            return []

        max_videos = max_videos or self.config.max_videos_per_channel
        videos = []

        try:
            # Get channel's uploaded videos playlist
            channels_response = (
                self.youtube_client.channels().list(part="contentDetails", id=channel_id).execute()
            )

            if not channels_response.get("items"):
                logger.warning(f"Channel not found: {channel_id}")
                return []

            uploads_playlist_id = channels_response["items"][0]["contentDetails"][
                "relatedPlaylists"
            ]["uploads"]

            # Get videos from uploads playlist
            playlist_items = (
                self.youtube_client.playlistItems()
                .list(
                    part="snippet,contentDetails",
                    playlistId=uploads_playlist_id,
                    maxResults=max_videos,
                )
                .execute()
            )

            for item in playlist_items.get("items", []):
                video_id = item["contentDetails"]["videoId"]
                video_data = self._get_video_details(video_id)
                if video_data:
                    videos.append(video_data)

                # Rate limiting
                time.sleep(self.config.rate_limit_delay)

        except HttpError as e:
            logger.error(f"Error fetching channel {channel_id}: {e}")

        logger.info(f"Retrieved {len(videos)} videos from channel {channel_id}")
        return videos

    def _get_video_details(self, video_id: str) -> dict[str, Any] | None:
        """Get detailed information about a video."""
        if not self.youtube_client:
            return None

        try:
            videos_response = (
                self.youtube_client.videos()
                .list(part="snippet,contentDetails,statistics", id=video_id)
                .execute()
            )

            if not videos_response.get("items"):
                return None

            video = videos_response["items"][0]
            snippet = video["snippet"]
            statistics = video.get("statistics", {})
            content_details = video.get("contentDetails", {})

            # Parse duration
            duration_str = content_details.get("duration", "PT0S")
            duration_seconds = self._parse_duration(duration_str)

            return {
                "video_id": video_id,
                "title": snippet.get("title", ""),
                "channel_id": snippet.get("channelId", ""),
                "channel_title": snippet.get("channelTitle", ""),
                "description": snippet.get("description", ""),
                "published_at": snippet.get("publishedAt", ""),
                "duration_seconds": duration_seconds,
                "view_count": int(statistics.get("viewCount", 0)),
                "like_count": int(statistics.get("likeCount", 0)),
                "comment_count": int(statistics.get("commentCount", 0)),
            }

        except HttpError as e:
            logger.error(f"Error fetching video {video_id}: {e}")
            return None

    def _parse_duration(self, duration_str: str) -> int:
        """Parse ISO 8601 duration to seconds."""
        match = re.match(r"PT(\d+H)?(\d+M)?(\d+S)?", duration_str)
        if not match:
            return 0

        hours = int(match.group(1)[:-1]) if match.group(1) else 0
        minutes = int(match.group(2)[:-1]) if match.group(2) else 0
        seconds = int(match.group(3)[:-1]) if match.group(3) else 0

        return hours * 3600 + minutes * 60 + seconds

    def extract_transcript(self, video_id: str, languages: list[str] | None = None) -> str | None:
        """Extract transcript text from a YouTube video."""
        if not YOUTUBE_TRANSCRIPT_API_AVAILABLE:
            logger.warning("youtube-transcript-api not available")
            return None

        languages = languages or self.config.languages

        try:
            # Use the instance-based API
            api = YouTubeTranscriptApi()

            # Try to fetch transcript in preferred languages
            for language in languages:
                try:
                    transcript = api.fetch(video_id, languages=[language])

                    # Combine all text segments using .text property
                    full_text = " ".join([snippet.text for snippet in transcript])

                    # Clean up text
                    full_text = self._clean_transcript_text(full_text)

                    if len(full_text) >= self.config.min_transcript_length:
                        return full_text

                except (NoTranscriptFound, TranscriptsDisabled):
                    continue

        except TranscriptsDisabled:
            logger.info(f"Transcripts disabled for video {video_id}")
        except Exception as e:
            logger.error(f"Error extracting transcript for {video_id}: {e}")

        return None

    def _clean_transcript_text(self, text: str) -> str:
        """Clean and normalize transcript text."""
        # Remove multiple spaces
        text = re.sub(r"\s+", " ", text)

        # Remove common transcript artifacts
        text = re.sub(r"\[.*?\]", "", text)  # Remove [Music], [Applause], etc.
        text = re.sub(r"\(.*?\)", "", text)  # Remove (laughing), (crying), etc.

        # Remove duplicate phrases (common in auto-generated)
        words = text.split()
        cleaned_words = []
        prev_word = None
        for word in words:
            if word.lower() != prev_word:
                cleaned_words.append(word)
                prev_word = word.lower()

        return " ".join(cleaned_words).strip()

    def is_therapeutic_content(self, metadata: dict[str, Any]) -> bool:
        """Check if video content is therapeutic/mental health related."""
        # Check title
        title_lower = metadata.get("title", "").lower()
        description_lower = metadata.get("description", "").lower()

        # Check for therapeutic keywords
        content_text = f"{title_lower} {description_lower}"

        for keyword in THERAPEUTIC_KEYWORDS:
            if keyword in content_text:
                return True

        # Check if channel is in therapeutic channels list
        channel_id = metadata.get("channel_id", "")
        return channel_id in THERAPEUTIC_CHANNELS

    def process_video(self, video_data: dict[str, Any]) -> VideoMetadata | None:
        """Process a single video with full pipeline."""
        video_id = video_data.get("video_id")
        if not video_id:
            logger.warning("Video data missing video_id")
            return None

        # Extract transcript
        transcript = self.extract_transcript(video_id)
        if not transcript:
            logger.info(f"No transcript available for video {video_id}")
            return None

        # Check if therapeutic content
        if not self.is_therapeutic_content(video_data):
            logger.debug(f"Skipping non-therapeutic video: {video_data.get('title')}")
            return None

        # Create metadata object
        metadata = VideoMetadata(
            video_id=video_id,
            title=video_data.get("title", ""),
            channel_id=video_data.get("channel_id", ""),
            channel_title=video_data.get("channel_title", ""),
            description=video_data.get("description", ""),
            published_at=video_data.get("published_at", ""),
            duration_seconds=video_data.get("duration_seconds", 0),
            view_count=video_data.get("view_count", 0),
            like_count=video_data.get("like_count", 0),
            comment_count=video_data.get("comment_count", 0),
            transcript_text=transcript,
            extraction_timestamp=datetime.now(timezone.utc).isoformat(),
        )

        # Apply safety filtering
        if self.crisis_detector and self.config.apply_safety_filter:
            crisis_result = self.crisis_detector.analyze_crisis(
                {"messages": [{"role": "user", "content": transcript}]}
            )
            metadata.crisis_flag = crisis_result.is_crisis

        # Apply classification
        if self.classifier and self.config.apply_classification:
            record = {"messages": [{"role": "user", "content": transcript}]}
            classification = self.classifier.classify_record(record)
            metadata.therapeutic_category = classification.category.value

        # Calculate quality score
        metadata.quality_score = self._calculate_quality_score(metadata)

        return metadata

    def _calculate_quality_score(self, metadata: VideoMetadata) -> float:
        """Calculate quality score for the transcript."""
        score = 0.5  # Base score

        # Length bonus
        if len(metadata.transcript_text) > 1000:
            score += 0.1
        if len(metadata.transcript_text) > 5000:
            score += 0.1

        # Engagement metrics
        if metadata.view_count > 10000:
            score += 0.1
        if metadata.like_count > 100:
            score += 0.05

        # Duration (prefer 5-30 minute videos)
        if 300 <= metadata.duration_seconds <= 1800:
            score += 0.1

        # Crisis content penalty
        if metadata.crisis_flag:
            score -= 0.2

        return min(1.0, max(0.0, score))

    def save_to_jsonl(self, records: list[VideoMetadata], output_path: Path) -> None:
        """Save records to JSONL format."""
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            for record in records:
                f.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")

        logger.info(f"✅ Saved {len(records)} records to {output_path}")

    def upload_to_s3(self, file_path: Path, s3_key: str) -> bool:
        """Upload file to S3 bucket.

        Requires OVH_S3_ACCESS_KEY and OVH_S3_SECRET_KEY environment variables.
        """
        try:
            import boto3
            from botocore.exceptions import ClientError

            # Get S3 credentials from environment
            endpoint_url = os.getenv("OVH_S3_ENDPOINT", "https://s3.us-east-va.io.cloud.ovh.us")
            access_key = os.getenv("OVH_S3_ACCESS_KEY") or os.getenv("AWS_ACCESS_KEY_ID")
            secret_key = os.getenv("OVH_S3_SECRET_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
            region = os.getenv("OVH_S3_REGION", "us-east-va")
            bucket = os.getenv("OVH_S3_BUCKET", "pixel-data")

            if not access_key or not secret_key:
                logger.error(
                    "❌ S3 credentials not found. Set OVH_S3_ACCESS_KEY and OVH_S3_SECRET_KEY"
                )
                return False

            # Create S3 client
            s3_client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region,
            )

            # Upload file
            s3_client.upload_file(str(file_path), bucket, s3_key)
            logger.info(f"✅ Uploaded to S3: s3://{bucket}/{s3_key}")
            return True

        except ClientError as e:
            logger.error(f"❌ S3 upload failed: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ S3 upload error: {e}")
            return False


def main():
    """Main entry point for YouTube transcript extraction."""
    parser = argparse.ArgumentParser(
        description="PIX-4: Extract YouTube transcripts for therapeutic content"
    )

    parser.add_argument(
        "--api-key", help="YouTube Data API v3 key (or set YOUTUBE_API_KEY env var)"
    )
    parser.add_argument("--channels", help="Comma-separated list of channel IDs to process")
    parser.add_argument(
        "--therapeutic-only",
        action="store_true",
        help="Only extract from therapeutic content channels",
    )
    parser.add_argument(
        "--max-videos", type=int, default=100, help="Maximum number of videos to process"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/youtube_transcripts_extracted.jsonl"),
        help="Output JSONL file path",
    )
    parser.add_argument(
        "--skip-safety", action="store_true", help="Skip crisis detection safety filtering"
    )
    parser.add_argument(
        "--skip-classification",
        action="store_true",
        help="Skip therapeutic category classification",
    )
    parser.add_argument(
        "--upload-s3",
        action="store_true",
        help="Upload output to S3 bucket (requires OVH_S3 credentials)",
    )
    parser.add_argument(
        "--s3-prefix",
        default="youtube_transcripts/",
        help="S3 prefix for uploaded files (default: youtube_transcripts/)",
    )

    args = parser.parse_args()

    # Get API key
    api_key = args.api_key or os.getenv("YOUTUBE_API_KEY")
    if not api_key and GOOGLE_API_AVAILABLE:
        logger.warning("⚠️ No YouTube API key provided. Limited functionality.")
        logger.warning("Set YOUTUBE_API_KEY env var or use --api-key")

    # Initialize configuration
    config = YouTubeExtractionConfig(
        youtube_api_key=api_key,
        apply_safety_filter=not args.skip_safety,
        apply_classification=not args.skip_classification,
    )

    # Initialize extractor
    extractor = YouTubeTranscriptExtractor(config)

    all_videos = []

    # Process therapeutic channels if requested
    if args.therapeutic_only:
        logger.info("🎯 Processing therapeutic content channels")
        for channel_id in THERAPEUTIC_CHANNELS:
            channel_videos = extractor.get_channel_videos(
                channel_id, max_videos=args.max_videos // len(THERAPEUTIC_CHANNELS)
            )
            all_videos.extend(channel_videos)

    # Process specific channels if provided
    elif args.channels:
        channel_ids = [cid.strip() for cid in args.channels.split(",")]
        logger.info(f"📺 Processing {len(channel_ids)} specified channels")
        for channel_id in channel_ids:
            channel_videos = extractor.get_channel_videos(channel_id)
            all_videos.extend(channel_videos)

    # Search for therapeutic videos
    else:
        logger.info("🔍 Searching for therapeutic videos")
        all_videos = extractor.search_therapeutic_videos(max_results=args.max_videos)

    # Process videos and extract transcripts
    processed_records = []
    for i, video_data in enumerate(all_videos[: args.max_videos], 1):
        logger.info(f"Processing video {i}/{min(len(all_videos), args.max_videos)}")

        processed = extractor.process_video(video_data)
        if processed:
            processed_records.append(processed)

        # Rate limiting
        time.sleep(config.rate_limit_delay)

    # Save results
    if processed_records:
        extractor.save_to_jsonl(processed_records, args.output)

        # Upload to S3 if requested
        if args.upload_s3:
            from datetime import datetime

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            s3_key = f"{args.s3_prefix}youtube_transcripts_{timestamp}.jsonl"
            extractor.upload_to_s3(args.output, s3_key)

        # Print summary
        print("\n" + "=" * 80)
        print("📊 PIX-4 EXTRACTION SUMMARY")
        print("=" * 80)
        print(f"Total videos found: {len(all_videos)}")
        print(f"Successfully processed: {len(processed_records)}")
        print(f"Crisis-flagged videos: {sum(1 for r in processed_records if r.crisis_flag)}")
        print(f"Output file: {args.output}")
        if args.upload_s3:
            print(f"S3 upload: {args.s3_prefix}")
        print("=" * 80)

        # Print category breakdown
        categories = {}
        for record in processed_records:
            cat = record.therapeutic_category or "uncategorized"
            categories[cat] = categories.get(cat, 0) + 1

        print("\nTherapeutic Categories:")
        for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
            print(f" - {cat}: {count}")
    else:
        logger.warning("⚠️ No transcripts extracted")

    return 0


if __name__ == "__main__":
    sys.exit(main())
