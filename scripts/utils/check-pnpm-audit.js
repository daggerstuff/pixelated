#!/usr/bin/env node

/**
 * check-pnpm-audit.js
 *
 * Parses pnpm audit --json output and exits with non-zero code
 * if vulnerabilities at or above a specified severity are found.
 *
 * Reads only `data.vulnerabilities` (pnpm 11 format). Deliberately ignores
 * `data.advisories` (yarn-style / pnpm <=9) and `data.metadata.vulnerabilities`
 * (aggregate counts that double-count the entries already present in
 * `data.vulnerabilities`). Reading those produced false positives that
 * disagreed with `pnpm audit --json`'s own summary.
 *
 * Usage: node check-pnpm-audit.js --fail-on high audit-results.json
 */

import { readFileSync, existsSync } from 'node:fs';

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];

function parseArgs(argv) {
  const args = argv.slice(2);
  let failOn = 'moderate';
  let filePath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--fail-on' && i + 1 < args.length) {
      failOn = args[i + 1].toLowerCase();
      i++;
    } else if (!args[i].startsWith('--')) {
      filePath = args[i];
    }
  }

  if (!filePath) {
    console.error('Usage: node check-pnpm-audit.js --fail-on <severity> <audit-results.json>');
    process.exit(1);
  }

  return { failOn, filePath };
}

function severityIndex(severity) {
  const idx = SEVERITY_ORDER.indexOf(severity.toLowerCase());
  return idx === -1 ? 0 : idx;
}

/**
 * Read vulnerability entries from a pnpm 11+ audit JSON document.
 *
 * pnpm 11 emits the canonical format under `data.vulnerabilities`, which can
 * be either an Array (older callers) or an Object keyed by package name. We
 * deliberately do NOT read `data.advisories` (yarn-style / pnpm <=9 format,
 * which pnpm 11 leaves empty but stale parsers keep using) or
 * `data.metadata.vulnerabilities` (aggregate counts that double-count the
 * entries already present in `data.vulnerabilities`). Reading those produced
 * false positives that disagreed with `pnpm audit --json`'s own summary.
 */
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
          url: v.url || v.cves?.[0] || '',
        });
      }
    } else if (typeof data.vulnerabilities === 'object') {
      for (const [name, info] of Object.entries(data.vulnerabilities)) {
        const severity = info.severity || (info.severityCount ? Object.keys(info.severityCount || {}).pop() : 'unknown');
        vulnerabilities.push({
          id: info.cves?.[0] || name,
          severity,
          title: info.title || name,
          module_name: name,
          url: info.via?.[0]?.url || info.url || '',
        });
      }
    }
  }

  return vulnerabilities;
}

function main() {
  const { failOn, filePath } = parseArgs(process.argv);

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`Error parsing JSON: ${err.message}`);
    process.exit(1);
  }

  const vulnerabilities = extractVulnerabilities(data);
  const thresholdIndex = severityIndex(failOn);

  const failing = vulnerabilities.filter(
    (v) => severityIndex(v.severity) >= thresholdIndex
  );

  const summary = {};
  for (const v of vulnerabilities) {
    summary[v.severity] = (summary[v.severity] || 0) + 1;
  }

  console.log('=== pnpm audit summary ===');
  for (const sev of SEVERITY_ORDER) {
    if (summary[sev]) {
      console.log(`  ${sev}: ${summary[sev]}`);
    }
  }
  console.log(`Total vulnerabilities: ${vulnerabilities.length}`);
  console.log(`Threshold: ${failOn} (failing if >= ${failOn})`);

  if (failing.length > 0) {
    console.error(`\n❌ ${failing.length} vulnerability(ies) at or above "${failOn}" severity found.`);
    for (const v of failing.slice(0, 20)) {
      console.error(`   - [${v.severity}] ${v.module_name}: ${v.title} (${v.url})`);
    }
    if (failing.length > 20) {
      console.error(`   ... and ${failing.length - 20} more`);
    }
    process.exit(1);
  }

  console.log('\n✅ No vulnerabilities at or above the threshold.');
  process.exit(0);
}

main();
