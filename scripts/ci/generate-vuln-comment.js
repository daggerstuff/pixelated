#!/usr/bin/env node

/**
 * generate-vuln-comment.js
 *
 * Parses pnpm audit --json output and generates a markdown summary
 * suitable for posting as a GitHub PR comment.
 *
 * Usage: node generate-vuln-comment.js <audit-results.json> > pr-comment.md
 */

import { readFileSync, existsSync } from 'node:fs';

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];
const SEVERITY_EMOJI = {
  critical: '🔴',
  high: '🟠',
  moderate: '🟡',
  low: '🟢',
  info: '🔵',
};

function main() {
  const filePath = process.argv[2];
  if (!filePath || !existsSync(filePath)) {
    console.error('Usage: node generate-vuln-comment.js <audit-results.json>');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error parsing JSON: ${err.message}`);
    process.exit(1);
  }

  const vulnerabilities = extractVulnerabilities(data);
  const summary = {};
  for (const v of vulnerabilities) {
    summary[v.severity] = (summary[v.severity] || 0) + 1;
  }

  const hasHighOrCritical =
    (summary.high || 0) > 0 || (summary.critical || 0) > 0;

  const lines = [];
  lines.push('## 🔒 Dependency Vulnerability Scan');
  lines.push('');
  lines.push(`**Total vulnerabilities:** ${vulnerabilities.length}`);
  lines.push('');

  if (vulnerabilities.length === 0) {
    lines.push('✅ No vulnerabilities detected.');
    lines.push('');
    console.log(lines.join('\n'));
    process.exit(0);
  }

  // Summary table
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const sev of SEVERITY_ORDER) {
    if (summary[sev]) {
      lines.push(
        `| ${SEVERITY_EMOJI[sev] || ''} ${sev} | ${summary[sev]} |`,
      );
    }
  }
  lines.push('');

  if (hasHighOrCritical) {
    lines.push('⚠️ **High or critical vulnerabilities detected.** PR merge will be blocked until resolved.');
    lines.push('');
  }

  // List high+ vulnerabilities
  const highPlus = vulnerabilities.filter(
    (v) =>
      SEVERITY_ORDER.indexOf(v.severity) >=
      SEVERITY_ORDER.indexOf('high'),
  );

  if (highPlus.length > 0) {
    lines.push('### High & Critical Vulnerabilities');
    lines.push('');
    lines.push('| Package | Severity | Title | CVE/URL |');
    lines.push('|---------|----------|-------|----------|');
    for (const v of highPlus.slice(0, 20)) {
      const pkg = v.module_name || 'unknown';
      const sev = v.severity || 'unknown';
      const title = (v.title || 'No title').substring(0, 60);
      const url = v.url || '';
      lines.push(`| \`${pkg}\` | ${SEVERITY_EMOJI[sev] || ''} ${sev} | ${title} | ${url} |`);
    }
    if (highPlus.length > 20) {
      lines.push(`| ... | | _${highPlus.length - 20} more_ | |`);
    }
    lines.push('');
  }

  // Suppression info
  lines.push('<details>');
  lines.push('<summary>Vulnerability suppression workflow</summary>');
  lines.push('');
  lines.push('To suppress a false positive or accepted risk:');
  lines.push('1. Add the CVE/advisory ID to `.github/security/trivy/trivy.yaml` under `ignore-unfixed` or `misconfig-scanner` skip rules');
  lines.push('2. Document the rationale in the PR description');
  lines.push('3. Reference `.github/security/vulnerability-suppression.md` for full workflow');
  lines.push('');
  lines.push('</details>');
  lines.push('');

  console.log(lines.join('\n'));
  process.exit(0);
}

function extractVulnerabilities(data) {
  const vulnerabilities = [];

  if (data.vulnerabilities) {
    if (Array.isArray(data.vulnerabilities)) {
      for (const v of data.vulnerabilities) {
        vulnerabilities.push({
          id: v.id || v.cve || 'unknown',
          severity: v.severity || 'unknown',
          title: v.title || v.name || 'No title',
          module_name: v.module_name || v.moduleName || v.name || 'unknown',
          url: v.url || (v.cves && v.cves[0]) || '',
        });
      }
    } else if (typeof data.vulnerabilities === 'object') {
      for (const [name, info] of Object.entries(data.vulnerabilities)) {
        const severity =
          info.severity ||
          (info.severityCount
            ? Object.keys(info.severityCount || {}).pop()
            : 'unknown');
        vulnerabilities.push({
          id: (info.cves && info.cves[0]) || name,
          severity,
          title: info.title || name,
          module_name: name,
          url: (info.via && info.via[0] && info.via[0].url) || info.url || '',
        });
      }
    }
  }

  return vulnerabilities;
}

main();
