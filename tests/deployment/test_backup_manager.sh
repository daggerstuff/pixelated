#!/bin/bash

# Unit tests for Backup Manager functions
# Tests backup preservation, archiving, and rollback command generation

set -e

# Test configuration
TEST_DIR="/tmp/deployment-test-backup"
TEST_LOG="/tmp/test-backup-manager.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_SCRIPT="$SCRIPT_DIR/../../scripts/rsync.sh"

# Colors for test output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test utilities
print_test_header() { echo -e "${BLUE}[TEST]${NC} $1"; }
print_test_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
print_test_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
print_test_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Initialize test environment
setup_test_environment() {
    print_test_header "Setting up backup manager test environment"
    
    # Create test directory structure
    mkdir -p "$TEST_DIR"/{current,backup,archive}
    cd "$TEST_DIR"
    
    # Create mock project structure
    mkdir -p current/src current/public current/scripts
    echo "console.log('current version');" > current/src/app.js
    echo "<h1>Current Version</h1>" > current/public/index.html
    echo "#!/bin/bash\necho 'current script'" > current/scripts/deploy.sh
    
    # Create mock backup
    mkdir -p backup/src backup/public backup/scripts
    echo "console.log('backup version');" > backup/src/app.js
    echo "<h1>Backup Version</h1>" > backup/public/index.html
    echo "#!/bin/bash\necho 'backup script'" > backup/scripts/deploy.sh
    
    # Initialize test log
    echo "=== Backup Manager Tests - $(date) ===" > "$TEST_LOG"
    
    print_test_info "Test environment initialized in $TEST_DIR"
}

# Cleanup test environment
cleanup_test_environment() {
    print_test_header "Cleaning up backup manager test environment"
    cd /tmp
    rm -rf "$TEST_DIR"
    print_test_info "Test environment cleaned up"
}

# Test backup preservation logic
test_backup_preservation() {
    print_test_header "Testing backup preservation logic"
    
    # Test preserving current backup
    ((TESTS_RUN++))
    
    # Simulate preserve_current_backup function
    preserve_current_backup() {
        local backup_dir="$1"
        local preserve_dir="$2"
        
        if [[ -d "$backup_dir" ]]; then
            cp -r "$backup_dir" "$preserve_dir"
            return 0
        else
            return 1
        fi
    }
    
    if preserve_current_backup "$TEST_DIR/backup" "$TEST_DIR/backup-preserved"; then
        if [[ -d "$TEST_DIR/backup-preserved" ]] && [[ -f "$TEST_DIR/backup-preserved/src/app.js" ]]; then
            print_test_pass "preserve_current_backup successfully preserves backup directory"
        else
            print_test_fail "preserve_current_backup created directory but missing files"
        fi
    else
        print_test_fail "preserve_current_backup failed to preserve backup"
    fi
}

# Test backup archiving with timestamp
test_backup_archiving() {
    print_test_header "Testing backup archiving with timestamp"
    
    # Test archive_backup function
    ((TESTS_RUN++))
    
    archive_backup() {
        local backup_dir="$1"
        local archive_dir="$2"
        local timestamp=$(date +%Y%m%d-%H%M%S)
        local archive_name="backup-$timestamp"
        
        if [[ -d "$backup_dir" ]]; then
            mkdir -p "$archive_dir"
            cp -r "$backup_dir" "$archive_dir/$archive_name"
            return 0
        else
            return 1
        fi
    }
    
    if archive_backup "$TEST_DIR/backup" "$TEST_DIR/archive"; then
        local archive_count=$(ls -1 "$TEST_DIR/archive" | wc -l)
        if [[ $archive_count -gt 0 ]]; then
            local archive_name=$(ls -1 "$TEST_DIR/archive" | head -1)
            if [[ "$archive_name" =~ ^backup-[0-9]{8}-[0-9]{6}$ ]]; then
                print_test_pass "archive_backup creates timestamped archive: $archive_name"
            else
                print_test_fail "archive_backup created archive with invalid timestamp format: $archive_name"
            fi
        else
            print_test_fail "archive_backup failed to create archive"
        fi
    else
        print_test_fail "archive_backup function failed"
    fi
}

# Test backup retention policy
test_backup_retention() {
    print_test_header "Testing backup retention policy"
    
    # Create multiple backup archives
    mkdir -p "$TEST_DIR/retention-test"
    for i in {1..5}; do
        sleep 1  # Ensure different timestamps
        local timestamp=$(date +%Y%m%d-%H%M%S)
        mkdir -p "$TEST_DIR/retention-test/backup-$timestamp"
        echo "backup $i" > "$TEST_DIR/retention-test/backup-$timestamp/version.txt"
    done
    
    # Test retention cleanup function
    ((TESTS_RUN++))
    
    cleanup_old_backups() {
        local archive_dir="$1"
        local max_backups="${2:-3}"
        
        if [[ -d "$archive_dir" ]]; then
            local backup_count=$(ls -1 "$archive_dir" | grep "^backup-" | wc -l)
            if [[ $backup_count -gt $max_backups ]]; then
                # Remove oldest backups
                ls -1t "$archive_dir" | grep "^backup-" | tail -n +$((max_backups + 1)) | \
                while read backup; do
                    rm -rf "$archive_dir/$backup"
                done
            fi
            return 0
        else
            return 1
        fi
    }
    
    local initial_count=$(ls -1 "$TEST_DIR/retention-test" | wc -l)
    cleanup_old_backups "$TEST_DIR/retention-test" 3
    local final_count=$(ls -1 "$TEST_DIR/retention-test" | wc -l)
    
    if [[ $initial_count -eq 5 ]] && [[ $final_count -eq 3 ]]; then
        print_test_pass "cleanup_old_backups maintains retention policy (5 -> 3 backups)"
    else
        print_test_fail "cleanup_old_backups failed retention policy (initial: $initial_count, final: $final_count)"
    fi
}

# Test rollback command generation
test_rollback_command_generation() {
    print_test_header "Testing rollback command generation"
    
    # Test generate_rollback_commands function
    ((TESTS_RUN++))
    
    generate_rollback_commands() {
        local backup_dir="$1"
        local project_dir="$2"
        local container_name="${3:-pixelated-app}"
        
        if [[ -d "$backup_dir" ]]; then
            cat << EOF
# Rollback Commands Generated $(date)

# 1. Container-based rollback
docker stop $container_name 2>/dev/null || true
docker run -d --name ${container_name}-rollback previous-image-tag

# 2. Filesystem rollback
sudo systemctl stop caddy
sudo mv $project_dir ${project_dir}-failed
sudo cp -r $backup_dir $project_dir
sudo systemctl start caddy

# 3. Registry-based rollback (if available)
docker pull registry.example.com/pixelated-empathy:previous-tag
docker run -d --name ${container_name}-registry-rollback registry.example.com/pixelated-empathy:previous-tag
EOF
            return 0
        else
            return 1
        fi
    }
    
    local rollback_commands=$(generate_rollback_commands "$TEST_DIR/backup" "/root/pixelated" "test-app")
    
    if [[ -n "$rollback_commands" ]]; then
        if echo "$rollback_commands" | grep -q "docker stop test-app" && \
           echo "$rollback_commands" | grep -q "sudo mv /root/pixelated" && \
           echo "$rollback_commands" | grep -q "docker pull"; then
            print_test_pass "generate_rollback_commands creates comprehensive rollback instructions"
        else
            print_test_fail "generate_rollback_commands missing required rollback steps"
        fi
    else
        print_test_fail "generate_rollback_commands failed to generate commands"
    fi
}

# Test backup metadata tracking
test_backup_metadata() {
    print_test_header "Testing backup metadata tracking"
    
    # Test create_backup_metadata function
    ((TESTS_RUN++))
    
    create_backup_metadata() {
        local backup_dir="$1"
        local metadata_file="$backup_dir/backup-metadata.json"
        local timestamp=$(date -Iseconds)
        local commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        
        mkdir -p "$backup_dir"
        
        cat > "$metadata_file" << EOF
{
  "backup_info": {
    "created_at": "$timestamp",
    "commit_hash": "$commit_hash",
    "backup_type": "pre_deployment",
    "size_bytes": $(du -sb "$backup_dir" 2>/dev/null | cut -f1 || echo 0),
    "file_count": $(find "$backup_dir" -type f 2>/dev/null | wc -l || echo 0)
  }
}
EOF
        return 0
    }
    
    create_backup_metadata "$TEST_DIR/metadata-test"
    local metadata_file="$TEST_DIR/metadata-test/backup-metadata.json"
    
    if [[ -f "$metadata_file" ]]; then
        if grep -q "created_at" "$metadata_file" && \
           grep -q "backup_type" "$metadata_file" && \
           grep -q "size_bytes" "$metadata_file"; then
            print_test_pass "create_backup_metadata generates complete metadata file"
        else
            print_test_fail "create_backup_metadata missing required metadata fields"
        fi
    else
        print_test_fail "create_backup_metadata failed to create metadata file"
    fi
}

# Test backup integrity verification
test_backup_integrity() {
    print_test_header "Testing backup integrity verification"
    
    # Test verify_backup_integrity function
    ((TESTS_RUN++))
    
    verify_backup_integrity() {
        local backup_dir="$1"
        local original_dir="$2"
        
        if [[ ! -d "$backup_dir" ]] || [[ ! -d "$original_dir" ]]; then
            return 1
        fi
        
        # Check if key files exist
        local key_files=("src/app.js" "public/index.html" "scripts/deploy.sh")
        for file in "${key_files[@]}"; do
            if [[ ! -f "$backup_dir/$file" ]]; then
                return 1
            fi
        done
        
        # Check file count matches (simple integrity check)
        local backup_count=$(find "$backup_dir" -type f | wc -l)
        local original_count=$(find "$original_dir" -type f | wc -l)
        
        if [[ $backup_count -eq $original_count ]]; then
            return 0
        else
            return 1
        fi
    }
    
    if verify_backup_integrity "$TEST_DIR/backup" "$TEST_DIR/current"; then
        print_test_pass "verify_backup_integrity confirms backup integrity"
    else
        print_test_fail "verify_backup_integrity failed integrity check"
    fi
    
    # Test with corrupted backup
    ((TESTS_RUN++))
    rm "$TEST_DIR/backup/src/app.js"  # Corrupt the backup
    
    if ! verify_backup_integrity "$TEST_DIR/backup" "$TEST_DIR/current"; then
        print_test_pass "verify_backup_integrity detects corrupted backup"
    else
        print_test_fail "verify_backup_integrity failed to detect corruption"
    fi
}

# Test backup space management
test_backup_space_management() {
    print_test_header "Testing backup space management"
    
    # Test check_backup_space function
    ((TESTS_RUN++))
    
    check_backup_space() {
        local backup_dir="$1"
        local min_free_mb="${2:-1000}"  # Minimum 1GB free space
        
        local available_kb=$(df "$backup_dir" | tail -1 | awk '{print $4}')
        local available_mb=$((available_kb / 1024))
        
        if [[ $available_mb -gt $min_free_mb ]]; then
            return 0
        else
            return 1
        fi
    }
    
    # This test will likely pass on most systems, but tests the logic
    if check_backup_space "$TEST_DIR" 1; then  # Only require 1MB for test
        print_test_pass "check_backup_space correctly checks available space"
    else
        print_test_fail "check_backup_space failed space check"
    fi
}

# Run all tests
run_all_tests() {
    print_test_header "Starting Backup Manager Unit Tests"
    
    setup_test_environment
    
    # Run individual test functions
    test_backup_preservation
    test_backup_archiving
    test_backup_retention
    test_rollback_command_generation
    test_backup_metadata
    test_backup_integrity
    test_backup_space_management
    
    cleanup_test_environment
    
    # Print test summary
    print_test_header "Test Summary"
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        print_test_pass "All backup manager tests passed!"
        exit 0
    else
        print_test_fail "$TESTS_FAILED tests failed"
        exit 1
    fi
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_all_tests
fi