#!/usr/bin/env python3
"""
Process YouTube voice training data using yt-dlp.

- Accepts a YouTube playlist URL (or file with URLs)
- Downloads all videos as audio files (default: .mp3)
- Organizes output in a structured directory
- Optionally preprocesses audio (normalize, trim silence) with --preprocess
- Logs progress and errors
"""

import argparse
import hashlib
import logging
import os
import re
import subprocess  # trunk-ignore(bandit/B404): secure usage with shell=False and input validation
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# Add pydub for audio preprocessing
try:
    from pydub import AudioSegment, effects, silence
except ImportError:
    AudioSegment = None
    effects = None
    silence = None


def setup_logger(log_path: str):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[logging.FileHandler(log_path), logging.StreamHandler(sys.stdout)],
    )


def validate_youtube_url(url: str) -> bool:
    """Validate that the URL is a legitimate YouTube URL"""
    try:
        parsed = urlparse(url)

        # Must be HTTPS
        if parsed.scheme != "https":
            return False

        # Must be from YouTube domains
        allowed_domains = {
            "www.youtube.com",
            "youtube.com",
            "youtu.be",
            "m.youtube.com",
        }

        if parsed.netloc not in allowed_domains:
            return False

        # Check for valid YouTube URL patterns
        if parsed.netloc in ["www.youtube.com", "youtube.com", "m.youtube.com"]:
            # Must be /watch or /playlist
            if not (parsed.path.startswith("/watch") or parsed.path.startswith("/playlist")):
                return False

        elif parsed.netloc == "youtu.be":
            # Short URLs should have video ID in path
            if len(parsed.path) < 2:
                return False

        return True

    except Exception:
        return False


def sanitize_filename(name: str) -> str:
    """Sanitize a string to be safe for use as a filename"""
    # Remove/replace dangerous characters
    sanitized = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    # Limit length
    sanitized = sanitized[:50]
    # Ensure it's not empty or just dots
    if not sanitized or sanitized.strip("."):
        sanitized = "playlist"
    return sanitized


def create_safe_directory_name(url: str) -> str:
    """Create a safe directory name from URL"""
    try:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)

        # For playlist URLs, use list parameter
        if "list" in query_params:
            playlist_id = query_params["list"][0]
            # Validate playlist ID format (YouTube playlist IDs are alphanumeric)
            if re.match(r"^[a-zA-Z0-9_-]+$", playlist_id):
                return sanitize_filename(f"playlist_{playlist_id[:16]}")

        # For video URLs, create hash-based name
        url_hash = hashlib.md5(url.encode(), usedforsecurity=False).hexdigest()[:8]
        return f"video_{url_hash}"

    except Exception:
        # Fallback to hash
        url_hash = hashlib.md5(url.encode(), usedforsecurity=False).hexdigest()[:8]
        return f"content_{url_hash}"


def validate_path(path: str, base_dir: str) -> bool:
    """Validate that a path doesn't escape the base directory"""
    try:
        # Resolve both paths to absolute
        abs_path = os.path.abspath(path)
        abs_base = os.path.abspath(base_dir)

        # Check if the path is within base directory
        return abs_path.startswith(abs_base)
    except Exception:
        return False


def download_playlist(url: str, output_dir: str, audio_format: str = "mp3"):
    """Download all videos in a playlist as audio files using yt-dlp"""

    # Validate URL
    if not validate_youtube_url(url):
        raise ValueError("Invalid or unsafe YouTube URL")

    # Validate and sanitize audio format (allow only specific safe formats)
    allowed_formats = {"mp3", "wav", "ogg", "flac", "aac", "m4a"}
    if audio_format not in allowed_formats:
        raise ValueError(f"Audio format must be one of: {', '.join(allowed_formats)}")

    # Validate output directory path
    if not validate_path(output_dir, os.getcwd()):
        raise ValueError("Output directory path is not safe")

    # Create output template with safe characters only
    output_template = os.path.join(output_dir, "%(playlist_index)03d-%(title)s.%(ext)s")

    # Build command with validated inputs
    # Ensure URL is properly sanitized and validated before adding to command
    # We've already validated the URL with validate_youtube_url, but add an extra check
    if not isinstance(url, str) or not url.strip() or not validate_youtube_url(url):
        raise ValueError("Invalid or unsafe YouTube URL")

    cmd = [
        "yt-dlp",
        "--extract-audio",
        f"--audio-format={audio_format}",
        "--audio-quality=0",
        "--ignore-errors",
        "--restrict-filenames",  # This makes filenames safer
        "--no-playlist-reverse",
        "--output",
        output_template,
        url,  # URL has been validated above
    ]

    # Log command without exposing full URL (security)
    parsed_url = urlparse(url)
    safe_url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}[QUERY_HIDDEN]"
    logging.info(f"Running yt-dlp for: {safe_url}")

    try:
        # Use timeout and shell=False for security
        # Use current working directory instead of derived path for security
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
            timeout=3600,
            shell=False,  # trunk-ignore(bandit/B603): URL is validated and sanitized, shell=False is used
        )

        if result.returncode != 0:
            logging.error(f"yt-dlp failed with return code {result.returncode}")
            if result.stderr:
                error_lines = result.stderr.split("\n")
                if safe_errors := [
                    line
                    for line in error_lines[:5]
                    if all(
                        sensitive not in line.lower()
                        for sensitive in ["http", "token", "key", "auth"]
                    )
                ]:
                    logging.error(f"Error summary: {'; '.join(safe_errors)}")
        else:
            logging.info("Download completed successfully.")

    except subprocess.TimeoutExpired:
        logging.error("Download timed out after 1 hour")
        raise
    except Exception as e:
        logging.error(f"Download failed: {str(e)}")
        raise


def preprocess_audio_files(directory: Path, audio_format: str = "mp3"):
    """Normalize and trim silence from all audio files in the directory using pydub."""

    # Validate directory path
    if not validate_path(str(directory), os.getcwd()):
        logging.error("Directory path is not safe")
        return

    if AudioSegment is None:
        logging.error("pydub is not installed. Please install it to use audio preprocessing.")
        return

    # Validate audio format
    allowed_formats = {"mp3", "wav", "ogg", "flac", "aac", "m4a"}
    if audio_format not in allowed_formats:
        logging.error(f"Invalid audio format: {audio_format}")
        return

    audio_files = list(directory.glob(f"*.{audio_format}"))
    if not audio_files:
        logging.warning(f"No .{audio_format} files found in {directory}")
        return

    for audio_file in audio_files:
        try:
            # Validate each file path
            if not validate_path(str(audio_file), str(directory)):
                logging.warning(f"Skipping unsafe path: {audio_file}")
                continue

            logging.info(f"Preprocessing {audio_file.name}")
            audio = AudioSegment.from_file(audio_file)

            # Normalize
            audio = effects.normalize(audio)

            # Trim silence (start/end)
            trimmed = silence.strip_silence(audio, silence_thresh=audio.dBFS - 16, padding=250)

            # Export back to file (overwrite)
            trimmed.export(audio_file, format=audio_format)

        except Exception as e:
            logging.error(f"Failed to preprocess {audio_file.name}: {str(e)}")


def main():
    parser = argparse.ArgumentParser(description="Process YouTube voice training data with yt-dlp.")
    parser.add_argument("--url", type=str, help="YouTube playlist URL (or video URL)")
    parser.add_argument(
        "--url-file",
        type=str,
        help="File containing list of playlist/video URLs (one per line)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="voice_data",
        help="Directory to save audio files",
    )
    parser.add_argument(
        "--audio-format",
        type=str,
        default="mp3",
        choices=["mp3", "wav", "ogg", "flac", "aac", "m4a"],
        help="Audio format",
    )
    parser.add_argument(
        "--preprocess",
        action="store_true",
        help="Enable audio preprocessing (normalize, trim silence)",
    )
    args = parser.parse_args()

    # Validate and sanitize output directory
    output_dir = Path(sanitize_filename(args.output_dir))
    if not validate_path(str(output_dir), os.getcwd()):
        logging.error("Output directory path is not safe")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    # Create log file with safe name
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = output_dir / f"yt_dlp_{timestamp}.log"
    setup_logger(str(log_path))

    urls = []
    if args.url:
        urls.append(args.url)

    if args.url_file:
        # Validate file path
        if not validate_path(args.url_file, os.getcwd()):
            logging.error("URL file path is not safe")
            sys.exit(1)

        try:
            with open(args.url_file, "r", encoding="utf-8") as f:
                file_urls = [line.strip() for line in f if line.strip()]
                # Validate each URL before adding
                for file_url in file_urls:
                    if validate_youtube_url(file_url):
                        urls.append(file_url)
                    else:
                        logging.warning(f"Skipping invalid URL: {file_url[:50]}...")
        except Exception as e:
            logging.error(f"Failed to read URL file: {str(e)}")
            sys.exit(1)

    if not urls:
        logging.error("No valid URLs provided. Use --url or --url-file.")
        sys.exit(1)

    for url in urls:
        logging.info(f"Processing URL: {urlparse(url).netloc}")

        # Create safe directory name
        dir_name = create_safe_directory_name(url)
        playlist_dir = output_dir / dir_name
        playlist_dir.mkdir(exist_ok=True)

        try:
            download_playlist(url, str(playlist_dir), audio_format=args.audio_format)
            if args.preprocess:
                preprocess_audio_files(playlist_dir, audio_format=args.audio_format)
        except Exception as e:
            logging.error(f"Failed to process URL: {str(e)}")
            continue

    logging.info("All downloads complete.")


if __name__ == "__main__":
    main()
