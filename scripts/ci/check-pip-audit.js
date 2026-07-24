#!/usr/bin/env node

/**
 * check-pip-audit.js
 *
 * Parses pip-audit --format json output from one or more files and
 * exits with non-zero code if vulnerabilities at or above a specified
 * severity are found.
 *
 * Usage: node check-pip-audit.js --fail-on high <file1.json> [file2.json ...]
 */

import { readFileSync, existsSync } from 'node:fs';

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];

function parseArgs(argv) {
  const args = argv.slice(2);
  let failOn = 'high';
  const files = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--fail-on' && i + 1 < args.length) {
      failOn = args[i + 1].toLowerCase();
      i++;
    } else if (!args[i].startsWith('--')) {
      files.push(args[i]);
    }
  }

  if (files.length === 0) {
    console.error(
      'Usage: node check-pip-audit.js --fail-on <severity> <file1.json> [file2.json ...]',
    );
    process.exit(1);
  }

  return { failOn, files };
}

function severityIndex(severity) {
  const idx = SEVERITY_ORDER.indexOf(severity.toLowerCase());
  return idx === -1 ? 0 : idx;
}

function extractVulnerabilities(data) {
  const vulns = [];

  if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
    for (const v of data.vulnerabilities) {
      vulns.push({
        id: v.id || v.cve || 'unknown',
        severity: (v.severity || 'unknown').toLowerCase(),
        package: v.package || v.name || 'unknown',
        version: v.version || '',
        fix_versions: v.fix_versions || [],
        description: v.description || 'No description',
      });
    }
  }

  return vulns;
}

function main() {
  const { failOn, files } = parseArgs(process.argv);
  const thresholdIndex = severityIndex(failOn);

  const allVulns = [];
  const perFile = [];

  for (const file of files) {
    if (!existsSync(file)) {
      console.error(`Warning: File not found: ${file}, skipping.`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`Warning: Error parsing ${file}: ${err.message}, skipping.`);
      continue;
    }

    const vulns = extractVulnerabilities(data);
    if (vulns.length > 0) {
      perFile.push({ file, vulns });
    }
    allVulns.push(...vulns);
  }

  // Summary
  const summary = {};
  for (const v of allVulns) {
    summary[v.severity] = (summary[v.severity] || 0) + 1;
  }

  console.log('=== pip-audit summary ===');
  console.log(`Files scanned: ${files.length}`);
  console.log(`Total vulnerabilities: ${allVulns.length}`);

  for (const sev of SEVERITY_ORDER) {
    if (summary[sev]) {
      console.log(`  ${sev}: ${summary[sev]}`);
    }
  }
  console.log(`Threshold: ${failOn} (failing if >= ${failOn})`);

  const failing = allVulns.filter(
    (v) => severityIndex(v.severity) >= thresholdIndex,
  );

  if (failing.length > 0) {
    console.error(`\n❌ ${failing.length} vulnerability(ies) at or above "${failOn}" severity found.`);
    for (const v of failing.slice(0, 20)) {
      const fixInfo = v.fix_versions.length > 0 ? ` (fix: ${v.fix_versions.join(', ')})` : '';
      console.error(`   - [${v.severity}] ${v.package}@${v.version}: ${v.id}${fixInfo}`);
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
