#!/usr/bin/env node

const resolveReadFileSync = async () => {
  try {
    const fs = require('fs')
    return fs.readFileSync
  } catch (_error) {
    const fs = await import('fs')
    return fs.readFileSync
  }
}

;(async () => {
  const readFileSync = await resolveReadFileSync()

  const args = process.argv.slice(2)
  let auditPath = 'audit-results.json'
  let failOn = process.env.PNPM_AUDIT_FAIL_ON || process.env.FAIL_ON_SEVERITY || 'moderate'

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg.startsWith('--fail-on=')) {
      failOn = arg.slice('--fail-on='.length)
      continue
    }

    if (arg === '--fail-on') {
      const next = args[index + 1]
      if (!next || next.startsWith('--')) {
        console.error('Missing value for --fail-on. Use one of: low, moderate, high, critical.')
        process.exit(1)
      }
      failOn = next
      index += 1
      continue
    }

    if (!arg.startsWith('-')) {
      auditPath = arg
    }
  }

  failOn = `${failOn}`.toLowerCase()

let data = '{}';
try {
  data = readFileSync(auditPath, 'utf8');
} catch (error) {
  console.error(`Could not read ${auditPath}:`, error.message);
  process.exit(1);
}

if (!data.trim()) {
  console.error('pnpm audit output is empty.');
  process.exit(1);
}

const parseJsonLine = (line) => {
  try {
    return JSON.parse(line);
  } catch (error) {
    return null;
  }
};

let audit;
try {
  let normalized = [];
  const trimmedData = data.trim();
  try {
    const parsed = JSON.parse(trimmedData);
    normalized = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    normalized = trimmedData
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseJsonLine)
      .filter((entry) => entry && typeof entry === 'object');
  }

  if (!normalized.length) {
    console.error('pnpm audit output did not contain valid JSON records.');
    process.exit(1);
  }

  if (normalized.length === 1) {
    audit = normalized[0];
  } else if (normalized.length > 1) {
    audit = {
      metadata: {},
      vulnerabilities: {},
      advisories: {},
      entries: normalized,
    };
    const list = normalized.filter(
      (entry) => entry.type === 'auditAdvisory' || entry.type === 'auditSummary'
    );
    for (const entry of list) {
      if (entry.type === 'auditSummary' && entry.metadata && typeof entry.metadata === 'object') {
        audit.metadata = entry.metadata;
      }
      if (entry.type === 'auditAdvisory' && entry.data && entry.data.advisory) {
        const advisory = entry.data.advisory;
        if (advisory.id != null) {
          audit.advisories[advisory.id] = advisory;
        }
      }
    }
  } else {
    audit = {};
  }
} catch (error) {
  console.error('Failed to parse pnpm audit JSON:', error.message);
  process.exit(1);
}

const summary = audit.metadata && (audit.metadata.vulnerabilities || audit.metadata.vulnerableDependencies);
const advisories = audit.advisories || {};
const vulnerabilityMap = audit.vulnerabilities || {};
const hasVulnSummary = Boolean(summary || advisories || vulnerabilityMap);

if (audit.error || !hasVulnSummary) {
  console.error('pnpm audit did not return a valid vulnerability report:', audit.error || 'unexpected format');
  process.exit(1);
}

const uniqueById = (items) => {
  const byId = new Map();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const key = item.id != null ? `id:${item.id}` : `title:${item.title || JSON.stringify(item)}`;
    byId.set(key, item);
  }
  return [...byId.values()];
};

const isProductionRelevant = (advisory) => {
  if (!advisory || typeof advisory !== 'object') return false;
  const findings = Array.isArray(advisory.findings) ? advisory.findings : [];
  if (!findings.length) {
    return true;
  }
  return findings.some((finding) => !finding.dev);
};

const advisoryList = uniqueById(
  Array.isArray(vulnerabilityMap)
    ? vulnerabilityMap
    : [...Object.values(advisories), ...(Array.isArray(audit.entries) ? audit.entries : []).filter((entry) => entry.type === 'auditAdvisory' && entry.data && entry.data.advisory).map((entry) => entry.data.advisory)]
);

const productionAdvisories = advisoryList.filter((item) => isProductionRelevant(item));
const productionSummary = productionAdvisories.reduce(
  (result, item) => {
    if (!item) return result;
    const severity = (item.severity || '').toLowerCase();
    if (severity === 'low') result.low += 1;
    if (severity === 'moderate') result.moderate += 1;
    if (severity === 'high') result.high += 1;
    if (severity === 'critical') result.critical += 1;
    return result;
  },
  { low: 0, moderate: 0, high: 0, critical: 0 }
);

const prodModerate = productionSummary.moderate || 0;
const prodHigh = productionSummary.high || 0;
const prodCritical = productionSummary.critical || 0;
const prodLow = productionSummary.low || 0;

const prodAuditSummary = {
  low: prodLow,
  moderate: prodModerate,
  high: prodHigh,
  critical: prodCritical,
};

const severityRank = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
}

const toSeverity = (advisory) => ((advisory && advisory.severity) || '').toLowerCase();
const failThreshold = severityRank[failOn]

if (!Number.isInteger(failThreshold)) {
  console.error(
    `Unsupported fail threshold "${failOn}". Use one of: low, moderate, high, critical.`
  )
  process.exit(1)
}

const shouldFail = (severity) => {
  const severityRankValue = severityRank[(severity || '').toLowerCase()]
  return Number.isInteger(severityRankValue) && severityRankValue >= failThreshold
}

const advisoryPackages = (advisory) => {
  const packages = new Set();
  if (!advisory || typeof advisory !== 'object') return [...packages];
  if (advisory.module_name) packages.add(advisory.module_name);
  const findings = Array.isArray(advisory.findings) ? advisory.findings : [];
  for (const finding of findings) {
    if (!finding || typeof finding !== 'object') continue;
    if (finding.name) packages.add(finding.name);
    if (finding.dependency) packages.add(finding.dependency);
    if (finding.package) packages.add(finding.package);
    if (Array.isArray(finding.paths) && finding.paths[0]) {
      packages.add(finding.paths[0]);
    } else if (typeof finding.path === 'string') {
      packages.add(finding.path);
    }
  }
  return [...packages];
};

const severityPriority = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
};

const productionRelevantBlocking = productionAdvisories
  .filter((item) => shouldFail(toSeverity(item)))
  .sort((a, b) => severityPriority[toSeverity(a)] - severityPriority[toSeverity(b)]);

console.log('pnpm audit production summary:', JSON.stringify(prodAuditSummary, null, 2));

if (productionRelevantBlocking.length > 0) {
  console.log(`Production advisories (${failOn}+):`);
  for (const advisory of productionRelevantBlocking) {
    const id = advisory.id != null ? advisory.id : 'unknown';
    const severity = toSeverity(advisory) || 'unknown';
    const title = advisory.title || 'No title provided';
      const via = advisoryPackages(advisory).join(', ') || 'unknown package';
    console.log(`  - [${id}] ${severity.toUpperCase()} - ${title}`);
    console.log(`    Packages: ${via}`);
    console.log(`    Patching: ${advisory.patched_versions || advisory.patchedVersions || 'unknown'}`);
  }
}

const failingSeverities = ['low', 'moderate', 'high', 'critical'].filter(
  (severity) => severityRank[severity] >= failThreshold
);
const failingSummary = failingSeverities
  .map((severity) => `${severity}=${prodAuditSummary[severity] || 0}`)
  .join(', ');
const totalFromProductionAdvisories = failingSeverities.reduce(
  (total, severity) => total + Number(prodAuditSummary[severity] || 0),
  0
);

if (totalFromProductionAdvisories > 0) {
  console.error(
    `Dependency scan found ${failOn}+ production vulnerabilities: ${failingSummary}`
  );
  process.exit(1);
}

if (prodLow) {
  console.log(`Low severity production vulnerabilities found: ${prodLow}`);
}
console.log(`No vulnerabilities at ${failOn} or higher found in production dependencies.`);
})()
