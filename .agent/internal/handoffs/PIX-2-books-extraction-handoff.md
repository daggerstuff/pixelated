# PIX-2: Books-to-Training Extraction Script - Handoff

**Date**: 2026-04-02
**Priority**: P1
**Status**: Ready to Start

---

## Context

PIX-4 (YouTube Transcript Extraction) is complete. The next P1 task is PIX-2: Books-to-Training Extraction Script.

### Completed Tasks (for reference)
- **PIX-5**: ✅ E2E Pipeline Test - `tests/e2e/test_full_pipeline_e2e.py`
- **PIX-4**: ✅ YouTube Transcript Extraction - `scripts/data/extract_youtube_transcripts.py`
- **PIX-6**: ✅ Crisis Detector Fixed (100% sensitivity)

---

## PIX-2 Task Definition

From `metrics/dataset_audit_final_report.md`:
```
6. **🟠 P1: Books Extraction** (PIX-2)
- Implement missing script
- Process therapeutic books to training format
```

### Problem Statement
The dataset audit identified that books-to-training extraction scripts are missing. This blocks expansion of the training dataset with valuable therapeutic book content.

---

## What to Implement

### Core Features
1. **Book Content Extraction**
   - PDF/EPUB processing for therapeutic books
   - Text extraction and cleaning
   - Chapter/section segmentation

2. **Therapeutic Content Detection**
   - Filter for mental health/therapy-related content
   - Classify by therapeutic category
   - Detect crisis content for safety filtering

3. **Training Format Conversion**
   - Convert to conversation format
   - Apply quality scoring
   - Generate JSONL output compatible with pipeline

4. **Safety Integration**
   - Use `ProductionCrisisDetector` (verified 100% sensitivity in PIX-6)
   - Use `HybridTaxonomyClassifier` for categorization
   - Apply same safety gates as PIX-4

---

## Key Files to Reference

### Existing Infrastructure
- `scripts/data/extract_youtube_transcripts.py` - PIX-4 implementation (pattern to follow)
- `ai/safety/crisis_detection/production_crisis_detector.py` - CrisisDetector
- `ai/pipelines/design/hybrid_classifier.py` - HybridTaxonomyClassifier
- `tests/e2e/test_full_pipeline_e2e.py` - E2E test patterns

### S3 Locations
- Bucket: `pixel-data`
- Existing data: Check for any book transcripts already uploaded
- Output path: `books_extracted/` (suggested)

---

## Implementation Pattern (from PIX-4)

```python
@dataclass
class BooksExtractionConfig:
    """Configuration for books extraction."""
    input_path: str | None = None
    output_format: str = "jsonl"
    apply_safety_filter: bool = True
    apply_classification: bool = True
    min_content_length: int = 500
    proxy_url: str | None = None  # If fetching from external sources
```

### Required Output Fields (JSONL)
- `source_id`, `title`, `author`, `content_text`
- `chapter`, `section`, `page_number`
- `therapeutic_category`, `crisis_flag`, `quality_score`
- `extraction_timestamp`, `source` = "books"

---

## CLI Arguments (suggested)

```bash
--input         # Input book file or directory
--output        # Output JSONL path
--format        # Input format (pdf, epub, txt)
--skip-safety   # Skip crisis detection
--skip-classification  # Skip categorization
--upload-s3     # Upload to S3 bucket
--s3-prefix     # S3 path prefix
```

---

## Testing Approach

1. **Unit Tests**: Test extraction, cleaning, format conversion
2. **Integration Tests**: Test with CrisisDetector and HybridTaxonomyClassifier
3. **E2E Test**: Add test case to `tests/e2e/test_full_pipeline_e2e.py`

---

## Dependencies to Check

```bash
# PDF processing
uv pip install pypdf2  # or pymupdf

# EPUB processing
uv pip install ebooklib

# Already installed (from PIX-4)
youtube-transcript-api
boto3
```

---

## Success Criteria

1. Script extracts text from PDF/EPUB files
2. Therapeutic content is properly detected and classified
3. Crisis content is flagged (using ProductionCrisisDetector)
4. Output is valid JSONL compatible with training pipeline
5. S3 upload works (same pattern as PIX-4)
6. Tests pass

---

## Start Command

```bash
# In new session, say:
"Read the PIX-2 handoff at .planning/handoffs/PIX-2-books-extraction-handoff.md and start implementation"
```

---

## Related Context Files

- `metrics/dataset_audit_final_report.md` - Original audit findings
- `metrics/pix4_implementation_report_2026-04-02.md` - PIX-4 report (pattern reference)
- `metrics/pix5_e2e_test_report_2026-04-02.md` - E2E test report
- `.planning/todos/pending/2026-04-02-pix-4-implement-youtube-transcript-extraction-script-for-therapeutic-content.md` - PIX-4 todo (pattern)

---

**Handoff Complete**: Ready for new session to begin PIX-2 implementation.
