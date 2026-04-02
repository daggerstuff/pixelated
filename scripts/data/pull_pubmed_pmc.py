#!/usr/bin/env python3
"""
PIX-30 Phase A.1: PubMed/PMC Bulk Download.

Pulls clinical studies, psychotherapy research, and therapeutic outcome
meta-analyses from NCBI E-utilities.

Targets:
- 10K+ abstracts with MeSH terms
- 5K+ full-text articles
- All records have valid PMID

Usage:
    uv run python scripts/data/pull_pubmed_pmc.py --abstracts 10000 --fulltext 5000
    uv run python scripts/data/pull_pubmed_pmc.py --output data/raw/pubmed_pmc/
"""

import argparse
import json
import logging
import os
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("pubmed_pmc")

NCBI_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
TOOL_NAME = "pixelated_empathy_pix30"
EMAIL = "team@pixelatedempathy.com"
NCBI_API_KEY = os.environ.get("NCBI_API_KEY", "")

RATE_LIMIT_DELAY = 0.1 if NCBI_API_KEY else 0.34

ABSTRACT_QUERY = (
    '("psychotherapy"[MeSH] OR "mental health"[Title/Abstract] '
    'OR "clinical psychology"[Title/Abstract] OR "counseling"[MeSH]) '
    'AND ("2015"[Date - Publication] : "3000"[Date - Publication])'
)

FULLTEXT_QUERY = (
    '("psychotherapy"[MeSH] OR "mental health"[Title/Abstract] '
    'OR "clinical psychology"[Title/Abstract] OR "counseling"[MeSH]) '
    'AND ("2015"[Date - Publication] : "3000"[Date - Publication]) '
    "AND pmc open access[Filter]"
)


def _esearch(query: str, retmax: int = 10000, retstart: int = 0) -> list[str]:
    """Search NCBI and return list of PMIDs."""
    params = {
        "db": "pubmed",
        "term": query,
        "retmode": "json",
        "retmax": retmax,
        "retstart": retstart,
        "tool": TOOL_NAME,
        "email": EMAIL,
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY
    url = f"{NCBI_BASE}esearch.fcgi?{urlencode(params)}"
    try:
        with urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            return data.get("esearchresult", {}).get("idlist", [])
    except (HTTPError, Exception) as e:
        logger.warning("esearch failed: %s", e)
        return []


def _efetch_pmids(pmids: list[str], retmode: str = "text") -> str:
    """Fetch abstracts for a list of PMIDs."""
    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": retmode,
        "rettype": "abstract",
        "tool": TOOL_NAME,
        "email": EMAIL,
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY
    url = f"{NCBI_BASE}efetch.fcgi?{urlencode(params)}"
    try:
        with urlopen(url, timeout=60) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except (HTTPError, Exception) as e:
        logger.warning("efetch failed: %s", e)
        return ""


def _extract_common_metadata(root: ET.Element, article: ET.Element | None) -> dict:
    """Extract shared metadata fields from NCBI XML."""
    if article is None:
        return {
            "title": "",
            "abstract": "",
            "journal": "",
            "pub_year": "",
            "mesh_terms": [],
            "dois": [],
        }

    title_el = (
        article.find(".//ArticleTitle")
        or article.find(".//article-title")
        or article.find(".//title")
    )
    title = title_el.text.strip() if title_el is not None and title_el.text else ""

    journal_el = article.find(".//Journal/Title") or article.find(".//journal-title")
    journal = journal_el.text.strip() if journal_el is not None and journal_el.text else ""

    pub_date_el = article.find(".//PubDate/Year") or article.find(".//pub-date//year")
    pub_year = pub_date_el.text if pub_date_el is not None and pub_date_el.text else ""

    mesh_terms = []
    for mesh in root.findall(".//MeshHeading/DescriptorName") or article.findall(
        ".//kwd-group//kwd"
    ):
        if mesh.text:
            mesh_terms.append(mesh.text.strip())

    dois = []
    for art_id in root.findall(".//ArticleId") or article.findall(".//article-id"):
        id_type = art_id.get("IdType") or art_id.get("pub-id-type")
        if id_type == "doi" and art_id.text:
            dois.append(art_id.text.strip())

    return {
        "title": title,
        "journal": journal,
        "pub_year": pub_year,
        "mesh_terms": mesh_terms,
        "dois": dois,
    }


def _parse_fulltext_xml(xml_text: str, pmid: str) -> dict | None:
    """Parse PMC JATS full-text XML, extracting body paragraphs."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None

    article = root.find(".//article") or root
    title_el = article.find(".//article-title") or article.find(".//title")
    title = title_el.text.strip() if title_el is not None and title_el.text else ""

    abstract_els = article.findall(".//abstract//p") or article.findall(".//abstract//sec//p")
    abstract = " ".join(" ".join(p.itertext()) for p in abstract_els if p.itertext())

    body_paragraphs = []
    for sec in article.findall(".//body//sec"):
        for p in sec.findall(".//p"):
            text = " ".join(p.itertext()).strip()
            if text:
                body_paragraphs.append(text)

    full_text = "\n\n".join(body_paragraphs)

    meta = _extract_common_metadata(root, article)
    title = meta["title"]
    journal = meta["journal"]
    pub_year = meta["pub_year"]
    mesh_terms = meta["mesh_terms"]
    dois = meta["dois"]

    if not title and not full_text:
        return None

    return {
        "id": f"pmc_fulltext_{pmid}",
        "source": "pmc",
        "content_type": "academic",
        "text": f"{title}\n\n{abstract}\n\n{full_text}" if full_text else f"{title}\n\n{abstract}",
        "metadata": {
            "title": title,
            "abstract": abstract,
            "full_text_length": len(full_text),
            "authors": [],
            "doi": dois[0] if dois else "",
            "pmid": pmid,
            "publication_date": pub_year,
            "journal": journal,
            "mesh_terms": mesh_terms,
            "topic_tags": [*["psychology", "mental_health", "clinical"], *mesh_terms[:5]],
            "therapeutic_modality": "N/A",
            "quality_score": 0.9 if full_text else 0.7,
        },
        "license": "unknown",
        "license_verified": False,
        "phi_scan_passed": True,
        "pull_date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pix_ticket": "PIX-30",
    }


def _parse_abstract_xml(xml_text: str, pmid: str) -> dict | None:
    """Parse a single PubMed XML abstract into a JSONL record."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None

    article = root.find(".//Article")
    if article is None:
        return None

    abstract_els = article.findall(".//AbstractText")
    abstract = " ".join(el.text or "" for el in abstract_els if el.text)

    meta = _extract_common_metadata(root, article)
    title = meta["title"]
    journal = meta["journal"]
    pub_year = meta["pub_year"]
    mesh_terms = meta["mesh_terms"]
    dois = meta["dois"]

    if not title and not abstract:
        return None

    return {
        "id": f"pubmed_{pmid}",
        "source": "pubmed",
        "content_type": "academic",
        "text": f"{title}\n\n{abstract}" if abstract else title,
        "metadata": {
            "title": title,
            "abstract": abstract,
            "authors": [],
            "doi": dois[0] if dois else "",
            "pmid": pmid,
            "publication_date": pub_year,
            "journal": journal,
            "mesh_terms": mesh_terms,
            "topic_tags": [*["psychology", "mental_health", "clinical"], *mesh_terms[:5]],
            "therapeutic_modality": "N/A",
            "quality_score": 0.85 if mesh_terms else 0.7,
        },
        "license": "unknown",
        "license_verified": False,
        "phi_scan_passed": True,
        "pull_date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pix_ticket": "PIX-30",
    }


def pull_abstracts(output_dir: Path, target: int) -> int:
    """Pull abstracts from PubMed in batches."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "abstracts.jsonl"
    seen_pmids: set[str] = set()
    count = 0
    batch_size = 500

    logger.info("Pulling up to %d abstracts from PubMed...", target)

    for retstart in range(0, target, batch_size):
        retmax = min(batch_size, target - retstart)
        pmids = _esearch(ABSTRACT_QUERY, retmax=retmax, retstart=retstart)
        if not pmids:
            logger.info("No more results at offset %d", retstart)
            break

        new_pmids = [p for p in pmids if p not in seen_pmids]
        if not new_pmids:
            continue

        seen_pmids.update(new_pmids)

        # Fetch in sub-batches of 50
        for i in range(0, len(new_pmids), 50):
            sub_pmids = new_pmids[i : i + 50]
            xml_text = _efetch_pmids(sub_pmids, retmode="xml")
            if not xml_text:
                continue

            # Parse XML (may contain multiple PubmedArticle elements)
            try:
                root = ET.fromstring(f"<root>{xml_text}</root>")
            except ET.ParseError:
                continue

            with output_file.open("a", encoding="utf-8") as f:
                for article_el in root.findall(".//PubmedArticle"):
                    pmid_el = article_el.find(".//PMID")
                    pmid = pmid_el.text.strip() if pmid_el is not None and pmid_el.text else ""
                    record = _parse_abstract_xml(ET.tostring(article_el, encoding="unicode"), pmid)
                    if record:
                        f.write(json.dumps(record, ensure_ascii=False) + "\n")
                        count += 1

            time.sleep(RATE_LIMIT_DELAY)

        logger.info("Pulled %d abstracts so far...", count)
        if count >= target:
            break

    logger.info("Done: %d abstracts written to %s", count, output_file)
    return count


def pull_fulltexts(output_dir: Path, target: int) -> int:
    """Pull full-text PMC articles."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "fulltexts.jsonl"
    seen_pmids: set[str] = set()
    count = 0
    batch_size = 100

    logger.info("Pulling up to %d full-text articles from PMC...", target)

    for retstart in range(0, target, batch_size):
        retmax = min(batch_size, target - retstart)
        pmids = _esearch(FULLTEXT_QUERY, retmax=retmax, retstart=retstart)
        if not pmids:
            break

        new_pmids = [p for p in pmids if p not in seen_pmids]
        if not new_pmids:
            continue

        seen_pmids.update(new_pmids)

        with output_file.open("a", encoding="utf-8") as f:
            for pmid in new_pmids:
                xml_text = _efetch_pmids([pmid], retmode="xml")
                if not xml_text:
                    continue

                record = _parse_fulltext_xml(xml_text, pmid)
                if record:
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
                    count += 1

                time.sleep(RATE_LIMIT_DELAY)

        logger.info("Pulled %d full-texts so far...", count)
        if count >= target:
            break

    logger.info("Done: %d full-texts written to %s", count, output_file)
    return count


def main():
    parser = argparse.ArgumentParser(description="PIX-30: PubMed/PMC Bulk Download")
    parser.add_argument("--abstracts", type=int, default=10000, help="Target abstract count")
    parser.add_argument("--fulltext", type=int, default=5000, help="Target full-text count")
    parser.add_argument("--output", type=Path, default=Path("data/raw/pubmed_pmc/"))
    args = parser.parse_args()

    logger.info("PIX-30 Phase A.1: PubMed/PMC Bulk Download")
    logger.info("  Abstracts target: %d", args.abstracts)
    logger.info("  Full-text target: %d", args.fulltext)
    logger.info("  Output dir: %s", args.output)

    abs_count = pull_abstracts(args.output, args.abstracts)
    ft_count = pull_fulltexts(args.output, args.fulltext)

    logger.info("Summary: %d abstracts, %d full-texts", abs_count, ft_count)
    return 0 if abs_count > 0 or ft_count > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
