---
name: pdf-processing
description: >-
  Extract text and tables from PDF files, fill forms, merge documents, and
  convert PDFs to other formats. Use when working with PDF files or when the
  user mentions PDFs, forms, document extraction, or portable document format.
  Use when the user mentions PDF, forms, extraction, merge, split, or convert.
  Use when user asks about pdfplumber, PyMuPDF, or report generation from PDFs.
---

# PDF Processing

## Rules

- Use **pdfplumber** for text and table extraction on digital PDFs.
- Use **pytesseract** + **pdf2image** only when the PDF is scanned (no text layer).
- Always preserve page numbers when quoting extracted text.
- For multi-page merge, use `pypdf.PdfMerger` and validate output page count.

## Quick start

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## Examples

**Example 1: Extract first page**

```python
import pdfplumber
with pdfplumber.open("report.pdf") as pdf:
    print(pdf.pages[0].extract_text())
```

**Example 2: Extract tables**

```python
import pdfplumber
with pdfplumber.open("report.pdf") as pdf:
    tables = pdf.pages[0].extract_tables()
```

## Template

```markdown
# PDF Analysis Report

## Summary
[overview]

## Extracted text
[content]
```

## Background

PDF (Portable Document Format) is a fixed-layout format. Digital PDFs embed a text
layer; scanned PDFs require OCR. pdfplumber handles embedded text reliably; OCR adds
latency and error risk on low-quality scans.
