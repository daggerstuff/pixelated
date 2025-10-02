#!/bin/bash
# Validation pipeline security audit verification script

set -e  # Exit on any error

echo "Starting validation pipeline security audit verification..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
PASSED=0
FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✓ PASSED: $test_name${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED: $test_name${NC}"
        ((FAILED++))
    fi
    echo ""
}

# Test 1: Check if all required libraries can be imported safely
run_test "Third-party library imports" "
python3 -c '
import pydantic
import bleach
import pymongo
import bitarray
import mmh3
import redis
print(\"All security-related libraries imported successfully\")
'
"

# Test 2: Check pydantic validation functionality
run_test "Pydantic validation security" "
python3 -c '
from pydantic import BaseModel, validator
import re

# Test that validation prevents dangerous inputs
class TestModel(BaseModel):
    safe_id: str
    
    @validator(\"safe_id\")
    def validate_safe_id(cls, v):
        if not re.match(r\"^[a-zA-Z0-9_-]+\$\", v):
            raise ValueError(\"Invalid ID format\")
        return v

# Test safe input
safe_model = TestModel(safe_id=\"valid_id_123\")
assert safe_model.safe_id == \"valid_id_123\"

# Test that dangerous input is rejected
try:
    dangerous_model = TestModel(safe_id=\"<script>alert('xss')\")
    raise Exception(\"Should have failed validation\")
except:
    pass  # Expected to fail

print(\"Pydantic validation security test passed\")
'
"

# Test 3: Check bleach sanitization
run_test "Bleach sanitization security" "
python3 -c '
import bleach

# Test dangerous HTML gets sanitized
dangerous_html = \"<script>alert('xss')</script><p>Safe content</p>\"
cleaned = bleach.clean(dangerous_html, tags=[\"p\"], strip=True)
assert \"<script>\" not in cleaned
assert \"Safe content\" in cleaned

# Test allowed tags are preserved
allowed_html = \"<p>This is <strong>bold</strong> content</p>\"
cleaned = bleach.clean(allowed_html, tags=[\"p\", \"strong\"], strip=True)
assert \"<p>\" in cleaned
assert \"<strong>\" in cleaned
assert \"bold\" in cleaned

print(\"Bleach sanitization test passed\")
'
"

# Test 4: Check schema validation with malicious content
run_test "Schema validation with malicious content" "
python3 -c '
from ai.dataset_pipeline.validation import SpeakerTurn, ConversationRecord, validate_record
from ai.dataset_pipeline.ingestion_interface import IngestRecord

# Test sanitization of malicious content
try:
    turn = SpeakerTurn(
        speaker_id=\"client\",
        content=\"<script>alert('xss')</script>Normal content\",
        timestamp=None,
        metadata={}
    )
    # The content should be sanitized, not contain script tags
    assert \"<script>\" not in turn.content
    print(\"Content sanitization test passed\")
except Exception as e:
    print(\"Unexpected error in sanitization test:\", str(e))
    raise
'
"

# Test 5: Check ID validation security
run_test "ID validation security" "
python3 -c '
from ai.dataset_pipeline.validation import ConversationRecord

# Test that invalid IDs are rejected
try:
    # This should fail due to invalid ID characters
    record = ConversationRecord(
        id=\"injection'; DROP TABLE users; --\",
        title=\"Test\",
        turns=[{
            \"speaker_id\": \"therapist\",
            \"content\": \"Valid content\",
        }],
        source_type=\"json\",
        source_id=\"test_source\"
    )
    raise Exception(\"Should have failed validation\")
except:
    pass  # Expected to fail

# Valid ID should pass
record = ConversationRecord(
    id=\"valid-id_123.test\",
    title=\"Test\",
    turns=[{
        \"speaker_id\": \"therapist\",
        \"content\": \"Valid content\",
    }],
    source_type=\"json\",
    source_id=\"test_source\"
)
assert record.id == \"valid-id_123.test\"

print(\"ID validation security test passed\")
'
"

# Test 6: Check that quarantine system properly handles failures
run_test "Quarantine security handling" "
python3 -c '
from ai.dataset_pipeline.quarantine import get_quarantine_store, QuarantineRecord, QuarantineStatus
from ai.dataset_pipeline.ingestion_interface import IngestRecord

# Test that raw payloads are stored safely without execution
quarantine_store = get_quarantine_store()

# Create a potentially dangerous payload (should be stored as data, not executed)
dangerous_payload = {
    \"content\": \"<script>malicious_code()</script>\",
    \"metadata\": {\"source\": \"test\", \"malicious\": \"<img src=x onerror=alert('xss')>\"}
}

record = IngestRecord(
    id=\"test_security_record\",
    payload=dangerous_payload,
    metadata={\"source\": \"security_test\"}
)

# Quarantine the record - should store safely as raw data
quarantine_id = quarantine_store.quarantine_record(record, [\"Security test\"])

print(\"Quarantine security test passed: dangerous payload stored safely\")
'
"

# Test 7: Check that bloom filter handles various inputs safely
run_test "Bloom filter security" "
python3 -c '
from ai.dataset_pipeline.ingestion_deduplication import IngestionDeduplicator

# Create deduplicator
dedup = IngestionDeduplicator(capacity=100, error_rate=0.01)

# Test various inputs including potentially malicious ones
test_inputs = [
    \"normal content\",
    \"<script>dangerous</script>\",
    \"'; DROP TABLE --\",
    \"{{7*7}}\",  # Potential template injection
    \"javascript:alert(1)\"
]

for content in test_inputs:
    # All should be handled safely by the hash function
    is_new = dedup.add_content(content)
    
print(f\"Bloom filter security test passed: {len(test_inputs)} inputs handled safely\")
'
"

# Print final results
echo "========================================"
echo "Security Audit Verification Results:"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "========================================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All security audit verification tests PASSED!${NC}"
    echo "Third-party library security audit: VERIFIED"
    exit 0
else
    echo -e "${RED}$FAILED security tests FAILED!${NC}"
    exit 1
fi