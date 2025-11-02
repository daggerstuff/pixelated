#!/usr/bin/env python3
"""
Religious Content Filter for Tim Fletcher Transcripts
Removes religious references while preserving therapeutic content.
"""

import re
from pathlib import Path


def clean_religious_content(text: str) -> str:
    """Remove religious content while preserving therapeutic value."""

    # Religious terms and phrases to remove
    religious_patterns = [
        # Direct religious references
        r"\b(?:God|Jesus|Christ|Lord|Holy Spirit|Bible|Scripture|Biblical|Gospel|Prayer|Pray|Praying|Church|Christian|Christianity|Faith|Blessed|Blessing|Sin|Salvation|Heaven|Hell|Divine|Sacred|Worship|Ministry|Pastor|Priest|Sermon|Congregation)\b",

        # Religious phrases
        r"(?:in God\'s|God\'s will|God says|God tells|God wants|God loves|Jesus loves|Christ loves|by faith|through faith|walk with God|relationship with God|trust in God|God\'s plan|God\'s purpose)",

        # Biblical references
        r"(?:Matthew|Mark|Luke|John|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\s+\d+:\d+",

        # Prayer-related
        r"(?:let us pray|in prayer|through prayer|prayer life|pray for|pray about|pray that)",

        # Religious institutions
        r"(?:church service|Sunday service|Bible study|youth group|worship service|Christian counseling)",

        # Theological concepts
        r"(?:born again|saved|salvation|redemption|sanctification|justification|grace of God|mercy of God)",
    ]

    cleaned = text
    for pattern in religious_patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    # Clean up extra spaces and punctuation
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s*[,;]\s*[,;]+", ",", cleaned)
    cleaned = re.sub(r"\.\s*\.+", ".", cleaned)
    cleaned = cleaned.strip()

    return cleaned

def process_tim_fletcher_files():
    """Process all Tim Fletcher transcript files."""
    tim_fletcher_dir = Path("/root/pixelated/.notes/transcripts2/tim_fletcher")

    if not tim_fletcher_dir.exists():
        print(f"Directory not found: {tim_fletcher_dir}")
        return

    txt_files = list(tim_fletcher_dir.glob("*.txt"))
    print(f"Found {len(txt_files)} Tim Fletcher files to process")

    processed = 0
    for file_path in txt_files:
        try:
            # Read original content
            with open(file_path, encoding="utf-8") as f:
                original = f.read()

            # Clean religious content
            cleaned = clean_religious_content(original)

            # Skip if too short after cleaning
            if len(cleaned.split()) < 50:
                print(f"Skipping {file_path.name}: too short after cleaning")
                continue

            # Write cleaned content
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(cleaned)

            processed += 1
            print(f"Processed: {file_path.name}")

        except Exception as e:
            print(f"Error processing {file_path.name}: {e}")

    print(f"Successfully processed {processed} Tim Fletcher files")

if __name__ == "__main__":
    process_tim_fletcher_files()
