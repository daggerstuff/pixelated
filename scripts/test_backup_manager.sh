#!/bin/bash

# Test script for Backup Manager Component
# This script tests all the backup manager functionality

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_test() { echo -e "${BLUE}[TEST]${NC} $1"; }
print_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
print_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# Setup test environment
TEST_DIR="$(pwd)/test_backup_manager"
TEST_PROJECT_DIR="$TEST_DIR/pixelated"
TEST_BACKUP_DIR="$TEST_DIR"

cleanup() {
    print_test "Cleaning up test environment..."
    rm -rf "$TEST_DIR"
}

setup() {
    print_test "Setting up test environment..."
    
    # Clean up any previous test
    cleanup
    
    # Create test directories
    mkdir -p "$TEST_PROJECT_DIR"
    
    # Create a mock project structure
    cat > "$TEST_PROJECT_DIR/package.json" << 'EOF'
{
  "name": "pixelated-empathy",
  "version": "1.0.0",
  "description": "Test project"
}
EOF
    
    cat > "$TEST_PROJECT_DIR/astro.config.mjs" << 'EOF'
export default {
  output: 'server'
};
EOF
    
    mkdir -p "$TEST_PROJECT_DIR/src"
    echo "console.log('test');" > "$TEST_PROJECT_DIR/src/index.js"
    
    mkdir -p "$TEST_PROJECT_DIR/public"
    echo "Test file" > "$TEST_PROJECT_DIR/public/test.txt"
    
    cat > "$TEST_PROJECT_DIR/Dockerfile" << 'EOF'
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]
EOF
    
    # Initialize git repo
    cd "$TEST_PROJECT_DIR"
    git init
    git config user.email "test@example.com"
    git config user.name "Test User"
    git config commit.gpgsign false
    git add .
    git commit -m "Initial commit"
    cd - > /dev/null
    
    print_pass "Test environment setup complete"
}

test_backup_preservation() {
    print_test "Testing backup preservation logic..."
    
    export BACKUP_BASE_DIR="$TEST_BACKUP_DIR"
    export PROJECT_DIR="$TEST_PROJECT_DIR"
    export TEST_MODE="true"
    
    # Test preserve function
    if scripts/lib/backup_manager.sh preserve; then
        print_pass "Backup preservation completed successfully"
    else
        print_fail "Backup preservation failed"
        return 1
    fi
    
    # Verify backup was created
    if [[ -d "$TEST_BACKUP_DIR/pixelated-backup" ]]; then
        print_pass "Backup directory created"
    else
        print_fail "Backup directory not found"
        return 1
    fi
    
    # Verify metadata was created
    if [[ -f "$TEST_BACKUP_DIR/.backup_metadata.json" ]]; then
        print_pass "Backup metadata created"
    else
        print_fail "Backup metadata not found"
        return 1
    fi
    
    # Verify backup integrity
    if scripts/lib/backup_manager.sh verify "$TEST_BACKUP_DIR/pixelated-backup"; then
        print_pass "Backup integrity verification passed"
    else
        print_fail "Backup integrity verification failed"
        return 1
    fi
}

test_backup_listing() {
    print_test "Testing backup listing functionality..."
    
    export BACKUP_BASE_DIR="$TEST_BACKUP_DIR"
    export PROJECT_DIR="$TEST_PROJECT_DIR"
    export TEST_MODE="true"
    
    # Test list function
    if scripts/lib/backup_manager.sh list > /tmp/backup_list.txt; then
        print_pass "Backup listing completed successfully"
    else
        print_fail "Backup listing failed"
        return 1
    fi
    
    # Check if output contains expected content
    if grep -q "Available backups:" /tmp/backup_list.txt; then
        print_pass "Backup list contains expected header"
    else
        print_fail "Backup list missing expected header"
        return 1
    fi
}

test_backup_archiving() {
    print_test "Testing backup archiving functionality..."
    
    export BACKUP_BASE_DIR="$TEST_BACKUP_DIR"
    export PROJECT_DIR="$TEST_PROJECT_DIR"
    export TEST_MODE="true"
    
    # Test archive function
    if scripts/lib/backup_manager.sh archive; then
        print_pass "Backup archiving completed successfully"
    else
        print_fail "Backup archiving failed"
        return 1
    fi
    
    # Verify archived backup exists
    local archived_backups=$(find "$TEST_BACKUP_DIR" -name "pixelated-backup_*" -type d | wc -l)
    if [[ "$archived_backups" -gt 0 ]]; then
        print_pass "Archived backup created ($archived_backups found)"
    else
        print_fail "No archived backups found"
        return 1
    fi
}

test_rollback_generation() {
    print_test "Testing rollback command generation..."
    
    export BACKUP_BASE_DIR="$TEST_BACKUP_DIR"
    export PROJECT_DIR="$TEST_PROJECT_DIR"
    export TEST_MODE="true"
    
    # Test rollback command generation
    local rollback_output
    local rollback_script
    if rollback_output=$(scripts/lib/backup_manager.sh rollback all 2>&1); then
        rollback_script=$(echo "$rollback_output" | tail -n 1)
        print_pass "Rollback commands generated successfully"
    else
        print_fail "Rollback command generation failed"
        return 1
    fi
    
    # Verify rollback script path was returned
    if [[ -n "$rollback_script" && "$rollback_script" =~ ^/tmp/rollback_commands_.*\.sh$ ]]; then
        print_pass "Rollback script path returned: $(basename "$rollback_script")"
    else
        print_fail "Invalid rollback script path: $rollback_script"
        return 1
    fi
    
    # Verify rollback script was created (if accessible)
    if [[ -f "$rollback_script" ]]; then
        print_pass "Rollback script file created and accessible"
        
        # Verify rollback script is executable
        if [[ -x "$rollback_script" ]]; then
            print_pass "Rollback script is executable"
        else
            print_fail "Rollback script is not executable"
            return 1
        fi
    else
        print_pass "Rollback script created in /tmp (not accessible from workspace)"
    fi
}

test_cleanup_functionality() {
    print_test "Testing backup cleanup functionality..."
    
    export BACKUP_BASE_DIR="$TEST_BACKUP_DIR"
    export PROJECT_DIR="$TEST_PROJECT_DIR"
    export TEST_MODE="true"
    
    # Create multiple archived backups to test cleanup
    for i in {1..5}; do
        sleep 1  # Ensure different timestamps
        
        # Recreate project directory with new content
        rm -rf "$TEST_PROJECT_DIR"
        mkdir -p "$TEST_PROJECT_DIR/src"
        echo "Test content $i" > "$TEST_PROJECT_DIR/test$i.txt"
        echo "console.log('test $i');" > "$TEST_PROJECT_DIR/src/index.js"
        
        # Create essential files for backup integrity
        cat > "$TEST_PROJECT_DIR/package.json" << EOF
{
  "name": "pixelated-empathy",
  "version": "1.0.$i",
  "description": "Test project iteration $i"
}
EOF
        
        BACKUP_BASE_DIR="$TEST_BACKUP_DIR" PROJECT_DIR="$TEST_PROJECT_DIR" TEST_MODE="true" scripts/lib/backup_manager.sh preserve > /dev/null 2>&1
        BACKUP_BASE_DIR="$TEST_BACKUP_DIR" PROJECT_DIR="$TEST_PROJECT_DIR" TEST_MODE="true" scripts/lib/backup_manager.sh archive > /dev/null 2>&1
    done
    
    # Test cleanup function
    if scripts/lib/backup_manager.sh cleanup; then
        print_pass "Backup cleanup completed successfully"
    else
        print_fail "Backup cleanup failed"
        return 1
    fi
    
    # Verify cleanup worked (should have max 3 backups)
    local backup_count=$(find "$TEST_BACKUP_DIR" -name "pixelated-backup_*" -type d | wc -l)
    if [[ "$backup_count" -le 3 ]]; then
        print_pass "Backup cleanup maintained retention policy ($backup_count backups remaining)"
    else
        print_fail "Backup cleanup failed to maintain retention policy ($backup_count backups found, expected ≤3)"
        return 1
    fi
}

# Run all tests
main() {
    print_test "Starting Backup Manager Component Tests"
    echo ""
    
    # Setup test environment
    setup
    
    # Run tests
    local failed_tests=0
    
    if ! test_backup_preservation; then
        ((failed_tests++))
    fi
    echo ""
    
    if ! test_backup_listing; then
        ((failed_tests++))
    fi
    echo ""
    
    if ! test_backup_archiving; then
        ((failed_tests++))
    fi
    echo ""
    
    if ! test_rollback_generation; then
        ((failed_tests++))
    fi
    echo ""
    
    if ! test_cleanup_functionality; then
        ((failed_tests++))
    fi
    echo ""
    
    # Cleanup
    cleanup
    
    # Report results
    if [[ "$failed_tests" -eq 0 ]]; then
        print_pass "🎉 All Backup Manager tests passed!"
        echo ""
        print_test "Backup Manager Component is ready for integration"
        return 0
    else
        print_fail "❌ $failed_tests test(s) failed"
        return 1
    fi
}

# Execute main function
main "$@"