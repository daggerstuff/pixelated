#!/bin/bash
# Ingestion smoke test script
# Performs quick validation tests of the ingestion pipeline

set -e  # Exit on any error

echo "Starting ingestion smoke tests..."

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

# Test 1: Check if required Python modules can be imported
run_test "Python module imports" "
python3 -c '
from ai.dataset_pipeline.ingestion_interface import IngestionConnector, LocalFileConnector
from ai.dataset_pipeline.youtube_connector import YouTubeConnector
from ai.dataset_pipeline.s3_connector import S3Connector
from ai.dataset_pipeline.gcs_connector import GCSConnector
from ai.dataset_pipeline.validation import validate_record
from ai.dataset_pipeline.quarantine import get_quarantine_store
from ai.dataset_pipeline.ingestion_queue import IngestionQueue
from ai.dataset_pipeline.ingestion_deduplication import IngestionDeduplicator
print(\"All modules imported successfully\")
'
"

# Test 2: Check requirements installation
run_test "Check dependencies" "
python3 -c '
import pydantic
import bleach
import pymongo
import bitarray
import mmh3
print(\"All dependencies available\")
'
"

# Test 3: Test basic local connector functionality (create temp file and read it)
run_test "Local connector functionality" "
python3 -c '
import tempfile
import os
from pathlib import Path
from ai.dataset_pipeline.ingestion_interface import LocalFileConnector

# Create a temporary directory and file
with tempfile.TemporaryDirectory() as temp_dir:
    test_file = Path(temp_dir) / \"test_ingestion.txt\"
    test_file.write_text(\"This is a test for smoke testing.\")
    
    # Test connector
    connector = LocalFileConnector(str(temp_dir))
    connector.connect()
    records = list(connector.fetch())
    
    assert len(records) == 1, f\"Expected 1 record, got {len(records)}\"
    assert b\"smoke testing\" in records[0].payload, \"Content not found in record\"
    print(\"Local connector test passed: {} records found\".format(len(records)))
'
"

# Test 4: Test basic validation functionality
run_test "Validation functionality" "
python3 -c '
from ai.dataset_pipeline.ingestion_interface import IngestRecord
from ai.dataset_pipeline.validation import validate_record

# Create a simple test record
record = IngestRecord(
    id=\"test_record_1\",
    payload={
        \"source_type\": \"json\",
        \"title\": \"Test Conversation\",
        \"turns\": [
            {\"speaker_id\": \"client\", \"content\": \"Hello, I need help.\"},
            {\"speaker_id\": \"therapist\", \"content\": \"I'm here to help you.\"}
        ]
    },
    metadata={\"source\": \"smoke_test\", \"test_id\": 1}
)

# Validate the record
validated = validate_record(record)
assert validated.id == \"test_record_1\"
assert len(validated.turns) == 2
print(\"Validation test passed: record validated successfully\")
'
"

# Test 5: Test deduplication functionality
run_test "Deduplication functionality" "
python3 -c '
from ai.dataset_pipeline.ingestion_deduplication import IngestionDeduplicator

# Create deduplicator
dedup = IngestionDeduplicator(capacity=1000, error_rate=0.01)

# Test content
content1 = \"Same content for testing deduplication\"
content2 = \"Different content for testing\"

# First occurrence should be new
is_new1 = dedup.add_content(content1)
assert is_new1 == True, \"First occurrence should be new\"

# Second occurrence should be duplicate  
is_new2 = dedup.add_content(content1)
assert is_new2 == False, \"Second occurrence should be duplicate\"

# Different content should be new
is_new3 = dedup.add_content(content2)
assert is_new3 == True, \"Different content should be new\"

print(\"Deduplication test passed: {} unique, {} duplicate\".format(
    int(is_new1) + int(is_new3), int(not is_new2)
))
'
"

# Test 6: Test quarantine functionality
run_test "Quarantine functionality" "
python3 -c '
from ai.dataset_pipeline.ingestion_interface import IngestRecord
from ai.dataset_pipeline.quarantine import get_quarantine_store, QuarantineStatus

# Create a test record to quarantine
record = IngestRecord(
    id=\"quarantine_test_1\",
    payload=\"Test payload for quarantine\",
    metadata={\"source\": \"smoke_test\", \"stage\": \"ingestion\"}
)

# Get quarantine store and quarantine the record
store = get_quarantine_store()
quarantine_id = store.quarantine_record(record, [\"Test validation error\"])

# Verify record was quarantined
quarantined = list(store.get_quarantined(limit=1))
assert len(quarantined) > 0, \"No quarantined records found\"
assert quarantined[0].original_record_id == \"quarantine_test_1\"

# Clean up - try to delete the record
# Note: The delete may fail if the status is not REJECTED, which is fine for this test
print(\"Quarantine test passed: record quarantined successfully\")
'
"

# Test 7: Test queue functionality
run_test "Queue functionality" "
python3 -c '
import asyncio
from ai.dataset_pipeline.ingestion_queue import IngestionQueue, QueueItem, QueueType

async def test_queue():
    # Create queue
    queue = IngestionQueue(
        queue_type=QueueType.INTERNAL_ASYNC,
        max_size=10
    )
    
    # Create a test item
    item = QueueItem(
        id=\"test_queue_item_1\",
        payload=\"Test payload\",
        metadata={\"source\": \"smoke_test\"},
        priority=5
    )
    
    # Add to queue
    success = await queue.enqueue(item)
    assert success == True, \"Failed to enqueue item\"
    
    # Dequeue batch
    items = await queue.dequeue_batch()
    assert len(items) == 1, f\"Expected 1 item, got {len(items)}\"
    assert items[0].id == \"test_queue_item_1\"
    
    print(\"Queue test passed: {} items processed\".format(len(items)))

# Run the async test
asyncio.run(test_queue())
'
"

# Test 8: Test rate limiter functionality
run_test "Rate limiter functionality" "
python3 -c '
from ai.dataset_pipeline.ingest_utils import RateLimiter

# Create a rate limiter with high capacity for testing
limiter = RateLimiter(capacity=5, refill_rate=2.0)

# Acquire some tokens
for i in range(3):
    acquired = limiter.acquire(blocking=False)
    assert acquired == True, f\"Failed to acquire token {i+1}\"

# Should still be able to acquire more due to refill rate
acquired = limiter.acquire(blocking=False)
assert acquired == True, \"Should still be able to acquire with refill\"

print(\"Rate limiter test passed: tokens acquired successfully\")
'
"

# Print final results
echo "========================================"
echo "Test Results:"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "========================================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All smoke tests PASSED!${NC}"
    exit 0
else
    echo -e "${RED}$FAILED smoke tests FAILED!${NC}"
    exit 1
fi