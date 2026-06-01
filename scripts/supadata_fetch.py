#!/usr/bin/env python3
"""
Supadata-based YouTube transcript downloader for therapeutic AI training.

Replaces yt-dlp based batch_yt_transcripts.py for cloud environments where
YouTube blocks datacenter IPs. Uses Supadata API (handles YouTube blocks).

Usage:
    # Download all channels
    python scripts/supadata_fetch.py

    # Single channel
    python scripts/supadata_fetch.py --channel katimorton

    # Limit transcripts per channel
    python scripts/supadata_fetch.py --max-per-channel 10

    # Dry run (show what would be fetched)
    python scripts/supadata_fetch.py --dry-run
"""

import argparse
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("supadata_fetch")

# Rate limit: 1 credit per transcript on free/basic plan, 100 free/mo
# Free tier is very strict — space requests generously
DEFAULT_DELAY = 2.0  # seconds between API calls
MAX_RETRIES = 3
RETRY_BACKOFF = 4.0  # seconds for first retry, doubles each time


def extract_video_id(url: str) -> str | None:
    """Extract YouTube video ID from various URL formats."""
    if "youtu.be/" in url:
        return url.split("youtu.be/")[1].split("?")[0].split("#")[0]
    if "youtube.com/watch" in url:
        qs = parse_qs(urlparse(url).query)
        return qs.get("v", [None])[0]
    if "youtube.com/embed/" in url:
        return url.split("youtube.com/embed/")[1].split("?")[0]
    return None


def read_urls(path: Path) -> list[str]:
    """Read URLs from a playlist file, skip comments and blanks."""
    if not path.exists():
        logger.error("File not found: %s", path)
        return []
    urls = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
    # Deduplicate preserving order
    seen = set()
    unique = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    logger.info("Read %d URLs, %d unique from %s", len(urls), len(unique), path.name)
    return unique


def get_supadata_api_key() -> str:
    """Get Supadata API key from environment."""
    api_key = os.getenv("SUPADATA_API_KEY")
    if not api_key:
        # Also check .env file directly
        env_path = Path(__file__).parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if line.startswith("SUPADATA_API_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip("'\"")
                    break
    if not api_key:
        logger.error("SUPADATA_API_KEY not found. Set it in .env or export it.\nGet a key at https://dash.supadata.ai")
        sys.exit(1)
    return api_key


def supadata_transcript(
    video_id: str,
    api_key: str,
    text: bool = True,
    lang: str = "en",
    retries: int = MAX_RETRIES,
) -> str | None:
    """Fetch transcript via Supadata API. Returns plain text or None.

    Retries on rate-limit (403/429) with exponential backoff.
    """
    import urllib.request
    import urllib.error

    url = f"https://api.supadata.ai/v1/transcript?url=https://youtu.be/{video_id}&text={str(text).lower()}&lang={lang}"

    last_err: str | None = None
    backoff = RETRY_BACKOFF

    for attempt in range(retries + 1):
        if attempt > 0:
            logger.info("  retry %d/%d for %s after %.1fs", attempt, retries, video_id, backoff)
            time.sleep(backoff)
            backoff *= 2

        headers = {
            "x-api-key": api_key,
            "User-Agent": "Mozilla/5.0 (compatible; SupadataFetch/1.0)",
            "Accept": "application/json",
        }
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                if isinstance(data.get("content"), str):
                    return data["content"]
                chunks = data.get("content")
                if isinstance(chunks, list):
                    return " ".join(c.get("text", "") for c in chunks if isinstance(c, dict))
                return None
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            is_rate_limit = e.code in (429, 403) and ("limit" in body.lower() or "exceed" in body.lower())
            try:
                err_info = json.loads(body)
                last_err = err_info.get("error", err_info.get("message", str(e)))
                is_rate_limit = is_rate_limit or "rate" in str(err_info).lower()
            except json.JSONDecodeError:
                last_err = f"{e.code}: {body[:100]}"

            if is_rate_limit and attempt < retries:
                logger.debug("rate-limit for %s, will retry in %.1fs", video_id, backoff)
                continue
            if attempt >= retries:
                logger.debug("Supadata error for %s (after %d retries): %s", video_id, retries, last_err)
            return None
        except Exception as e:
            last_err = str(e)
            logger.debug("Network error for %s: %s", video_id, e)
            return None

    return None


def fetch_one(video_id: str, channel_dir: Path, api_key: str, delay: float) -> tuple[str, bool]:
    """Download a single video's transcript using Supadata."""
    txt_file = channel_dir / f"{video_id}.txt"

    # Skip if already exists
    if txt_file.exists():
        return video_id, True  # already done

    # Small delay for rate limiting
    if delay > 0:
        time.sleep(delay)

    text = supadata_transcript(video_id, api_key)
    if not text or len(text.strip()) < 30:
        logger.info("%s: no transcript available", video_id)
        return video_id, False

    txt_file.write_text(text.strip(), encoding="utf-8")
    word_count = len(text.split())
    logger.info("%s: SUCCESS - %d words", video_id, word_count)
    return video_id, True


def process_channel(
    channel_name: str,
    urls: list[str],
    output_base: Path,
    api_key: str,
    max_workers: int = 1,
    delay: float = DEFAULT_DELAY,
    max_per_channel: int = 0,
    dry_run: bool = False,
) -> tuple[int, int, int]:
    """Process all videos for one channel.

    Uses serial processing by default (free tier rate-limit is very strict).
    Set max_workers > 1 only on paid plans.
    """
    channel_dir = output_base / channel_name
    channel_dir.mkdir(parents=True, exist_ok=True)

    video_ids = []
    for url in urls:
        vid = extract_video_id(url)
        if vid:
            video_ids.append(vid)
        else:
            logger.warning("Could not extract video ID from: %s", url)

    if max_per_channel > 0:
        video_ids = video_ids[:max_per_channel]

    existing = sum(1 for vid in video_ids if (channel_dir / f"{vid}.txt").exists())
    if existing:
        logger.info("  %s: %d/%d already have .txt files", channel_name, existing, len(video_ids))

    if dry_run:
        logger.info("  %s: would fetch %d videos (%d exist)", channel_name, len(video_ids), existing)
        return 0, 0, existing

    success = 0
    fail = 0

    if max_workers <= 1:
        # Serial — respects rate limits properly
        for vid in video_ids:
            _, ok = fetch_one(vid, channel_dir, api_key, delay)
            if ok:
                success += 1
            else:
                fail += 1
    else:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(fetch_one, vid, channel_dir, api_key, delay): vid for vid in video_ids}
            for future in as_completed(futures):
                vid, ok = future.result()
                if ok:
                    success += 1
                else:
                    fail += 1

    logger.info("  %s: %d success, %d failed", channel_name, success, fail)
    return success, fail, existing


def main():
    parser = argparse.ArgumentParser(
        description="Download YouTube transcripts via Supadata API (bypasses cloud IP blocks).",
        epilog="Free tier: 100 transcripts/mo. Basic ($5/mo): 300 transcripts/mo.",
    )
    parser.add_argument("--playlists-dir", type=str, default="ai/docs")
    parser.add_argument("--output-dir", type=str, default="ai/training/youtube_transcripts")
    parser.add_argument("--channel", type=str, help="Single channel to process (e.g. katimorton)")
    parser.add_argument("--max-per-channel", type=int, default=0, help="Max videos per channel (0=all)")
    parser.add_argument("--max-workers", type=int, default=1, help="Parallel downloads (1 recommended for free tier)")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="Seconds between API calls")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be fetched without downloading")
    args = parser.parse_args()

    api_key = get_supadata_api_key()
    playlists_dir = Path(args.playlists_dir)
    output_base = Path(args.output_dir)

    # Build channel list
    channels = []
    if args.channel:
        playlist_file = playlists_dir / f"playlists_{args.channel}.txt"
        if not playlist_file.exists():
            logger.error("Playlist not found: %s", playlist_file)
            return 1
        urls = read_urls(playlist_file)
        channels.append((args.channel, urls, output_base / args.channel))
    else:
        for playlist_path in sorted(playlists_dir.glob("playlists_*.txt")):
            channel_name = playlist_path.stem.replace("playlists_", "")
            urls = read_urls(playlist_path)
            if urls:
                channels.append((channel_name, urls, output_base / channel_name))

    if not channels:
        logger.error("No playlist files found in %s", playlists_dir)
        return 1

    total_success = 0
    total_fail = 0
    total_skipped = 0

    for channel_name, urls, output_dir in channels:
        logger.info("\n%s", "=" * 60)
        logger.info("Channel: %s (%d videos)", channel_name, len(urls))
        logger.info("Output: %s", output_dir)

        success, fail, existing = process_channel(
            channel_name=channel_name,
            urls=urls,
            output_base=output_base,
            api_key=api_key,
            max_workers=args.max_workers,
            delay=args.delay,
            max_per_channel=args.max_per_channel,
            dry_run=args.dry_run,
        )
        total_success += success
        total_fail += fail
        total_skipped += existing

        # Save manifest
        if not args.dry_run:
            manifest = {
                "generated_at": datetime.now(UTC).isoformat(),
                "channel": channel_name,
                "urls_processed": len(urls),
                "successful": success,
                "failed": fail,
                "skipped_existing": existing,
                "total_files": len(list(output_dir.glob("*.txt"))),
                "method": "supadata",
            }
            with open(output_dir / "manifest.json", "w") as f:
                json.dump(manifest, f, indent=2)

    logger.info("\n%s", "=" * 60)
    logger.info(
        "SUMMARY: %d success, %d failed, %d skipped (existing), %d channels",
        total_success,
        total_fail,
        total_skipped,
        len(channels),
    )
    return 0 if total_fail == 0 and total_success > 0 else (0 if args.dry_run else 1)


if __name__ == "__main__":
    sys.exit(main())
