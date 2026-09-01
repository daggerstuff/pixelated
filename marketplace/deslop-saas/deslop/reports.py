from html import escape
from pathlib import Path

from deslop.models import ScanReport, dump_json


def render_markdown(report: ScanReport) -> str:
    rows = "\n".join(f"| {pattern} | {count} |" for pattern, count in report.top_slop_patterns.items())
    findings = "\n".join(
        f"- `{finding.record_id}` `{finding.field_path}`: **{finding.pattern}** — {finding.snippet}"
        for finding in report.findings[:20]
    )
    return (
        "# Deslop Dataset Quality Report\n\n"
        f"- File: `{report.file}`\n"
        f"- Records scanned: {report.records_scanned}\n"
        f"- Records flagged: {report.records_flagged}\n"
        f"- Slop density: {report.slop_density_pct}%\n\n"
        "## Top patterns\n\n"
        "| Pattern | Hits |\n| --- | ---: |\n"
        f"{rows}\n\n"
        "## Example findings\n\n"
        f"{findings}\n"
    )


def render_html(report: ScanReport) -> str:
    rows = "".join(
        f"<tr><td>{escape(pattern)}</td><td>{count}</td></tr>" for pattern, count in report.top_slop_patterns.items()
    )
    findings = "".join(
        f"<li><code>{escape(finding.record_id)}</code> <code>{escape(finding.field_path)}</code>: <strong>{escape(finding.pattern)}</strong> — {escape(finding.snippet)}</li>"
        for finding in report.findings[:50]
    )
    return (
        "<!doctype html>\n"
        '<html lang="en">\n'
        "<head>\n"
        '  <meta charset="utf-8">\n'
        "  <title>Deslop Dataset Quality Report</title>\n"
        "  <style>\n"
        "    body { background:#0b0f19; color:#e5e7eb; font:16px system-ui; margin:40px; }\n"
        "    main { max-width:960px; margin:auto; }\n"
        "    .hero { border:1px solid #273244; border-radius:20px; padding:28px; background:#111827; }\n"
        "    .density { font-size:56px; font-weight:800; color:#f97316; }\n"
        "    table { border-collapse:collapse; width:100%; margin-top:24px; }\n"
        "    td, th { border-bottom:1px solid #273244; padding:10px; text-align:left; }\n"
        "    code { color:#93c5fd; }\n"
        "  </style>\n"
        "</head>\n"
        "<body>\n"
        "<main>\n"
        '  <section class="hero">\n'
        "    <h1>Deslop Dataset Quality Report</h1>\n"
        f'    <div class="density">{report.slop_density_pct}%</div>\n'
        f"    <p>{report.records_flagged} of {report.records_scanned} records flagged in "
        f"<code>{escape(report.file)}</code>.</p>\n"
        "  </section>\n"
        "  <h2>Top patterns</h2>\n"
        f"  <table><thead><tr><th>Pattern</th><th>Hits</th></tr></thead><tbody>{rows}</tbody></table>\n"
        "  <h2>Example findings</h2>\n"
        f"  <ul>{findings}</ul>\n"
        "</main>\n"
        "</body>\n"
        "</html>\n"
    )


def write_report(path: Path, report: ScanReport) -> None:
    suffix = path.suffix.lower()
    if suffix == ".html":
        path.write_text(render_html(report), encoding="utf-8")
    elif suffix == ".md":
        path.write_text(render_markdown(report), encoding="utf-8")
    else:
        path.write_text(dump_json(report.to_dict()) + "\n", encoding="utf-8")
