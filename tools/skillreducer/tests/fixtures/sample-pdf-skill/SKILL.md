---
name: sample-pdf-skill
description: >-
  Extract text and tables from PDF files, fill forms, merge documents, and
  convert PDFs to other formats. Use when working with PDF files or when the
  user mentions PDFs, forms, document extraction, or portable document format.
  Use when the user mentions PDF, forms, extraction, merge, split, or convert.
---

# PDF Processing

PDF (Portable Document Format) files are a common file format that contains text,
images, and other content. To extract text from a PDF, you'll need to use a
library. There are many libraries available for PDF processing, but we recommend
pdfplumber because it's easy to use and handles most cases well.

## Quick start

Use pdfplumber for text extraction:

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## Examples

**Example 1: Extract first page**

Input: `report.pdf`
Output: plain text from page 1

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

Use this report template:

```markdown
# PDF Analysis Report

## Summary
[overview]

## Extracted text
[content]
```

## Background

PDF parsing depends on whether the document has a text layer. Scanned PDFs require
OCR. pdfplumber works best on digital PDFs with embedded text.
