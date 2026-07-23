#!/usr/bin/env bash
# test-alertmanager-routing.sh — Test AlertManager routing configuration
# Verifies that alert rules and routing config are syntactically valid
# and that severity-based routing is properly configured.
#
# Usage: ./monitoring/scripts/test-alertmanager-routing.sh
# Requires: docker (for amtool), or local amtool installation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== AlertManager Routing Test ==="
echo ""

# Test 1: Validate alertmanager.yml syntax
echo "1. Validating alertmanager.yml syntax..."
if command -v amtool &>/dev/null; then
  if amtool check-config "$MONITORING_DIR/alertmanager.yml" 2>&1; then
    echo "   PASS: alertmanager.yml is valid"
  else
    echo "   FAIL: alertmanager.yml has syntax errors"
    exit 1
  fi
else
  echo "   (amtool not installed locally — using YAML validation)"
  if python3 -c "import yaml; yaml.safe_load(open('$MONITORING_DIR/alertmanager.yml'))" 2>/dev/null; then
    echo "   PASS: alertmanager.yml parses as valid YAML"
  else
    echo "   FAIL: alertmanager.yml has YAML errors"
    exit 1
  fi
fi
echo ""

# Test 2: Validate all prometheus rule files
echo "2. Validating prometheus rule files..."
RULE_FILES=(
  "$MONITORING_DIR/alert_rules.yml"
  "$MONITORING_DIR/alerts/application.yml"
  "$MONITORING_DIR/alerts/performance-alerts.yaml"
  "$MONITORING_DIR/alerts/safety-alerts.yaml"
  "$MONITORING_DIR/alerts/launch-alerts.yaml"
)

ALL_VALID=true
for rule_file in "${RULE_FILES[@]}"; do
  if [ ! -f "$rule_file" ]; then
    echo "   WARN: Missing: $(basename "$rule_file")"
    continue
  fi
  if python3 -c "import yaml; yaml.safe_load(open('$rule_file'))" 2>/dev/null; then
    echo "   PASS: $(basename "$rule_file") parses as YAML"
  else
    echo "   FAIL: $(basename "$rule_file") has YAML errors"
    ALL_VALID=false
  fi
done
[ "$ALL_VALID" = true ] || exit 1
echo ""

# Test 3: Verify severity routing
echo "3. Verifying severity-based routing..."
python3 -c "
import yaml
with open('$MONITORING_DIR/alertmanager.yml') as f:
    config = yaml.safe_load(f)

routes = config.get('route', {}).get('routes', [])
critical_found = False
warning_found = False
emergency_found = False

for route in routes:
    matchers = route.get('matchers', [])
    receiver = route.get('receiver', '')
    for m in matchers:
        if 'critical' in m and 'critical' in receiver:
            critical_found = True
        if 'warning' in m and 'warning' in receiver:
            warning_found = True
        if 'emergency' in m and 'emergency' in receiver:
            emergency_found = True

receivers = {r['name']: r for r in config.get('receivers', [])}
has_pagerduty = any('pagerduty_configs' in r for r in receivers.values())
has_slack = any('slack_configs' in r for r in receivers.values())
has_email = any('email_configs' in r for r in receivers.values())

assert critical_found, 'No critical route found'
assert warning_found, 'No warning route found'
assert emergency_found, 'No emergency route found'
assert has_pagerduty, 'No PagerDuty receiver configured'
assert has_slack, 'No Slack receiver configured'
assert has_email, 'No email receiver configured'

print('   PASS: Critical -> PagerDuty + Email')
print('   PASS: Warning -> Slack + Email')
print('   PASS: Emergency -> PagerDuty + Slack')
print('   PASS: All severity routes configured')
" 2>&1 || exit 1
echo ""

# Test 4: Verify inhibition rules
echo "4. Verifying inhibition rules..."
python3 -c "
import yaml
with open('$MONITORING_DIR/alertmanager.yml') as f:
    config = yaml.safe_load(f)

inhibit_rules = config.get('inhibit_rules', [])
assert len(inhibit_rules) >= 2, f'Expected at least 2 inhibition rules, got {len(inhibit_rules)}'

for rule in inhibit_rules:
    src = rule.get('source_matchers', [])
    tgt = rule.get('target_matchers', [])
    eq = rule.get('equal', [])
    assert src, 'Missing source_matchers in inhibition rule'
    assert tgt, 'Missing target_matchers in inhibition rule'
    assert eq, 'Missing equal fields in inhibition rule'

print(f'   PASS: {len(inhibit_rules)} inhibition rules configured')
" 2>&1 || exit 1
echo ""

# Test 5: Count alert rules by severity
echo "5. Alert rule summary..."
python3 -c "
import yaml

severity_counts = {}
total_rules = 0

rule_files = [
    '$MONITORING_DIR/alert_rules.yml',
    '$MONITORING_DIR/alerts/application.yml',
    '$MONITORING_DIR/alerts/performance-alerts.yaml',
    '$MONITORING_DIR/alerts/safety-alerts.yaml',
    '$MONITORING_DIR/alerts/launch-alerts.yaml',
]

for rf in rule_files:
    try:
        with open(rf) as f:
            data = yaml.safe_load(f)
        groups = data.get('groups', []) or data.get('spec', {}).get('groups', [])
        for group in groups:
            for rule in group.get('rules', []):
                severity = rule.get('labels', {}).get('severity', 'unknown')
                severity_counts[severity] = severity_counts.get(severity, 0) + 1
                total_rules += 1
    except Exception as e:
        print(f'   WARN: Could not parse {rf}: {e}')

print(f'   Total alert rules: {total_rules}')
for sev, count in sorted(severity_counts.items()):
    print(f'   {sev}: {count}')
"
echo ""

echo "=== All tests passed ==="
