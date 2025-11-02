#!/usr/bin/env python3
"""
Enhanced Style Analyzer for Reorganized Transcripts
Processes all therapeutic transcripts and extracts training segments by communication style.
"""

import json
import logging
import re
from collections import defaultdict
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("enhanced_analysis")

class EnhancedStyleAnalyzer:
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.output_dir = Path("/root/pixelated/data/training_segments")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Style patterns for therapeutic communication
        self.style_patterns = {
            "therapeutic": [
                r"\b(?:trauma|healing|recovery|therapy|therapeutic|mental health|emotional|psychological)\b",
                r"\b(?:cope|coping|process|processing|work through|heal from)\b",
                r"\b(?:boundaries|self-care|validation|support|understanding)\b",
                r"\b(?:anxiety|depression|ptsd|complex trauma|attachment|shame)\b"
            ],
            "educational": [
                r"\b(?:understand|learn|explain|research|study|evidence|science)\b",
                r"\b(?:important to know|need to understand|let me explain|research shows)\b",
                r"\b(?:definition|concept|theory|framework|approach|method)\b",
                r"\b(?:psychology|neuroscience|brain|cognitive|behavioral)\b"
            ],
            "empathetic": [
                r"\b(?:feel|feeling|feelings|emotion|emotional|hurt|pain|difficult)\b",
                r"\b(?:understand|compassion|empathy|support|care|love)\b",
                r"\b(?:I hear you|I see you|that must be|I can imagine)\b",
                r"\b(?:valid|normal|okay to feel|makes sense|understandable)\b"
            ],
            "practical": [
                r"\b(?:do|try|practice|step|action|strategy|technique|tool)\b",
                r"\b(?:here\'s what|you can|start by|first step|next time)\b",
                r"\b(?:exercise|activity|homework|assignment|goal|plan)\b",
                r"\b(?:daily|routine|habit|schedule|structure|organize)\b"
            ]
        }

    def analyze_segment_style(self, text: str) -> tuple[str, float]:
        """Analyze text segment and return dominant style with confidence score."""
        style_scores = {}

        for style, patterns in self.style_patterns.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, text, re.IGNORECASE))
                score += matches

            # Normalize by text length
            words = len(text.split())
            style_scores[style] = score / max(words, 1) * 100

        # Find dominant style
        dominant_style = max(style_scores, key=style_scores.get)
        confidence = style_scores[dominant_style]

        return dominant_style, confidence

    def assess_quality(self, text: str) -> float:
        """Assess segment quality based on multiple criteria."""
        words = text.split()
        word_count = len(words)

        # Length criteria (50-300 words optimal)
        if word_count < 50:
            length_score = 0.3
        elif word_count > 300:
            length_score = 0.7
        else:
            length_score = 1.0

        # Content quality (therapeutic concepts)
        therapeutic_terms = [
            "trauma", "healing", "therapy", "emotional", "mental health",
            "boundaries", "self-care", "coping", "recovery", "support"
        ]

        content_score = 0
        for term in therapeutic_terms:
            if term.lower() in text.lower():
                content_score += 0.1
        content_score = min(content_score, 1.0)

        # Coherence (sentence structure)
        sentences = text.split(".")
        avg_sentence_length = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
        coherence_score = 1.0 if 8 <= avg_sentence_length <= 25 else 0.7

        # Overall quality score
        quality = (length_score * 0.4 + content_score * 0.4 + coherence_score * 0.2)
        return quality

    def extract_segments(self, text: str, min_words: int = 50) -> list[str]:
        """Extract meaningful segments from text."""
        # Split by sentences and group into segments
        sentences = re.split(r"[.!?]+", text)
        segments = []
        current_segment = []
        current_words = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            words = len(sentence.split())

            if current_words + words > 300:  # Max segment size
                if current_segment:
                    segments.append(" ".join(current_segment))
                current_segment = [sentence]
                current_words = words
            else:
                current_segment.append(sentence)
                current_words += words

                if current_words >= min_words:
                    segments.append(" ".join(current_segment))
                    current_segment = []
                    current_words = 0

        # Add remaining segment if substantial
        if current_segment and current_words >= min_words:
            segments.append(" ".join(current_segment))

        return segments

    def process_file(self, file_path: Path) -> list[dict]:
        """Process a single transcript file."""
        try:
            with open(file_path, encoding="utf-8") as f:
                content = f.read()

            segments = self.extract_segments(content)
            results = []

            for segment in segments:
                style, confidence = self.analyze_segment_style(segment)
                quality = self.assess_quality(segment)

                # Only include high-quality segments
                if quality >= 0.7 and confidence >= 0.1:
                    results.append({
                        "text": segment,
                        "style": style,
                        "confidence": confidence,
                        "quality": quality,
                        "source": file_path.parent.name,
                        "file": file_path.name
                    })

            return results

        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")
            return []

    def process_all_transcripts(self) -> dict[str, list[dict]]:
        """Process all transcript files."""
        all_segments = defaultdict(list)
        total_files = 0
        processed_files = 0

        # Get all directories
        directories = [d for d in self.base_path.iterdir() if d.is_dir()]

        for directory in directories:
            txt_files = list(directory.glob("*.txt"))
            total_files += len(txt_files)

            logger.info(f"Processing {len(txt_files)} files in {directory.name}")

            for file_path in txt_files:
                segments = self.process_file(file_path)

                for segment in segments:
                    style = segment["style"]
                    quality_tier = "high_quality" if segment["quality"] >= 0.85 else "medium_quality"
                    all_segments[f"{style}_{quality_tier}"].append(segment)

                processed_files += 1

                if processed_files % 50 == 0:
                    logger.info(f"Processed {processed_files}/{total_files} files")

        return dict(all_segments)

    def save_results(self, segments: dict[str, list[dict]]):
        """Save extracted segments to JSON files."""
        summary = {}

        for category, segment_list in segments.items():
            # Save segments to file
            output_file = self.output_dir / f"{category}.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(segment_list, f, indent=2, ensure_ascii=False)

            logger.info(f"Exported {len(segment_list)} {category} examples")
            summary[category] = len(segment_list)

        # Create summary
        total_segments = sum(summary.values())
        high_quality = sum(count for key, count in summary.items() if "high_quality" in key)
        medium_quality = sum(count for key, count in summary.items() if "medium_quality" in key)

        # Style distribution
        style_dist = {}
        for style in ["therapeutic", "educational", "empathetic", "practical"]:
            high = summary.get(f"{style}_high_quality", 0)
            medium = summary.get(f"{style}_medium_quality", 0)
            style_dist[style] = {"high": high, "medium": medium}

        final_summary = {
            "total_segments": total_segments,
            "high_quality": high_quality,
            "medium_quality": medium_quality,
            "quality_distribution": style_dist
        }

        # Save summary
        with open(self.output_dir / "enhanced_summary.json", "w") as f:
            json.dump(final_summary, f, indent=2)

        logger.info("Enhanced analysis complete!")
        logger.info(f"Summary: {final_summary}")

def main():
    """Main function to run enhanced analysis."""
    base_path = "/root/pixelated/.notes/transcripts2"

    logger.info("Starting enhanced style analysis on reorganized transcripts")

    analyzer = EnhancedStyleAnalyzer(base_path)
    segments = analyzer.process_all_transcripts()
    analyzer.save_results(segments)

    logger.info("Enhanced analysis completed successfully")

if __name__ == "__main__":
    main()
