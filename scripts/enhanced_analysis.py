#!/usr/bin/env python3
"""
Enhanced Style Analyzer - Improved pattern matching and quality assessment
"""

import json
import logging
import re
from collections import defaultdict
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("enhanced_analysis")

class EnhancedStyleAnalyzer:
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.output_dir = Path("/root/pixelated/data/training_segments")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Improved style patterns
        self.style_patterns = {
            "therapeutic": [
                r"\b(?:trauma|healing|recovery|therapy|therapeutic|counseling|treatment)\b",
                r"\b(?:emotional|psychological|mental health|wellbeing|wellness)\b",
                r"\b(?:cope|coping|process|heal|recover|work through)\b",
                r"\b(?:boundaries|self-care|validation|support|understanding|compassion)\b",
                r"\b(?:anxiety|depression|ptsd|complex trauma|attachment|shame|guilt)\b",
                r"\b(?:narcissist|abuse|toxic|codependent|dysfunctional)\b"
            ],
            "educational": [
                r"\b(?:understand|learn|explain|teach|educate|inform|clarify)\b",
                r"\b(?:research|study|evidence|science|scientific|data|findings)\b",
                r"\b(?:definition|concept|theory|framework|approach|method|technique)\b",
                r"\b(?:psychology|neuroscience|brain|cognitive|behavioral|clinical)\b",
                r"\b(?:important to|need to understand|let me explain|studies show)\b"
            ],
            "empathetic": [
                r"\b(?:feel|feeling|feelings|emotion|emotional|hurt|pain|suffering)\b",
                r"\b(?:understand|compassion|empathy|support|care|love|kindness)\b",
                r"\b(?:I hear you|I see you|that must be|I can imagine|I know)\b",
                r"\b(?:valid|normal|okay|natural|understandable|makes sense)\b",
                r"\b(?:difficult|hard|challenging|tough|struggle|struggling)\b"
            ],
            "practical": [
                r"\b(?:do|try|practice|step|action|strategy|technique|tool|method)\b",
                r"\b(?:here\'s what|you can|start by|first step|next time|begin)\b",
                r"\b(?:exercise|activity|homework|assignment|goal|plan|routine)\b",
                r"\b(?:daily|habit|schedule|structure|organize|implement)\b",
                r"\b(?:tip|advice|suggestion|recommendation|guideline)\b"
            ]
        }

    def analyze_segment_style(self, text: str) -> tuple[str, float]:
        """Analyze text segment and return dominant style with confidence score."""
        style_scores = {}
        text_lower = text.lower()

        for style, patterns in self.style_patterns.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, text_lower))
                score += matches

            # Normalize by text length (per 100 words)
            words = len(text.split())
            style_scores[style] = (score / max(words, 1)) * 100

        # Find dominant style
        dominant_style = max(style_scores, key=lambda k: style_scores[k])
        confidence = style_scores[dominant_style]

        return dominant_style, confidence

    def _calculate_length_score(self, word_count: int) -> float:
        """Calculate length score based on word count"""
        if word_count < 30:
            return 0.2
        if word_count > 400:
            return 0.6
        return 1.0

    def _calculate_content_score(self, text: str) -> float:
        """Calculate content score based on therapeutic indicators"""
        therapeutic_indicators = [
            "trauma", "healing", "therapy", "emotional", "mental", "psychological",
            "boundaries", "self-care", "coping", "recovery", "support", "anxiety",
            "depression", "relationship", "narcissist", "abuse", "toxic", "healthy"
        ]
        text_lower = text.lower()
        content_score = sum(
            0.08 for indicator in therapeutic_indicators
            if indicator in text_lower
        )
        return min(content_score, 1.0)

    def _calculate_readability_score(self, text: str) -> float:
        """Calculate readability score based on sentence length"""
        sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
        if not sentences:
            return 0.5

        avg_sentence_length = sum(len(s.split()) for s in sentences) / len(sentences)
        return 1.0 if 5 <= avg_sentence_length <= 30 else 0.7

    def assess_quality(self, text: str) -> float:
        """Assess segment quality - more lenient scoring."""
        words = text.split()
        word_count = len(words)

        length_score = self._calculate_length_score(word_count)
        content_score = self._calculate_content_score(text)
        readability_score = self._calculate_readability_score(text)

        # Overall quality (more lenient thresholds)
        quality = (length_score * 0.3 + content_score * 0.5 + readability_score * 0.2)
        return quality

    def _process_paragraph(self, paragraph: str, min_words: int) -> list[str]:
        """Process a single paragraph into segments"""
        word_count = len(paragraph.split())
        if min_words <= word_count <= 400:
            return [paragraph]
        if word_count > 400:
            return self._split_long_paragraph(paragraph, min_words)
        return []

    def _split_long_paragraph(self, paragraph: str, min_words: int) -> list[str]:
        """Split long paragraph into smaller segments"""
        sentences = re.split(r"[.!?]+", paragraph)
        segments = []
        current_segment = []
        current_words = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            sentence_words = len(sentence.split())

            if current_words + sentence_words > 400:
                if current_segment and current_words >= min_words:
                    segments.append(". ".join(current_segment) + ".")
                current_segment = [sentence]
                current_words = sentence_words
            else:
                current_segment.append(sentence)
                current_words += sentence_words

        # Add remaining segment
        if current_segment and current_words >= min_words:
            segments.append(". ".join(current_segment) + ".")

        return segments

    def extract_segments(self, text: str, min_words: int = 30) -> list[str]:
        """Extract segments with more flexible approach."""
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        segments = []

        for paragraph in paragraphs:
            paragraph_segments = self._process_paragraph(paragraph, min_words)
            segments.extend(paragraph_segments)

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

                # More lenient thresholds
                if quality >= 0.4 and len(segment.split()) >= 30:
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

        logger.info(f"Processing {total_files} total files across {len(directories)} directories")

        for directory in directories:
            txt_files = list(directory.glob("*.txt"))

            for file_path in txt_files:
                segments = self.process_file(file_path)

                for segment in segments:
                    style = segment["style"]
                    quality_tier = "high_quality" if segment["quality"] >= 0.7 else "medium_quality"
                    all_segments[f"{style}_{quality_tier}"].append(segment)

                processed_files += 1

                if processed_files % 25 == 0:
                    logger.info(f"Processed {processed_files}/{total_files} files")

        return dict(all_segments)

    def save_results(self, segments: dict[str, list[dict]]):
        """Save extracted segments to JSON files."""
        summary = {}

        for category, segment_list in segments.items():
            if segment_list:  # Only save non-empty categories
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
    base_path = "/root/pixelated/.notes/transcripts2"

    logger.info("Starting enhanced style analysis on reorganized transcripts")

    analyzer = EnhancedStyleAnalyzer(base_path)
    segments = analyzer.process_all_transcripts()
    analyzer.save_results(segments)

    logger.info("Enhanced analysis completed successfully")

if __name__ == "__main__":
    main()

