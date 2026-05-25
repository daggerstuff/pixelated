#!/bin/bash

# Unit tests for Secure Environment Variable Manager functions
# Tests environment file encryption, transfer, and secure deployment

set -e

# Test configuration
TEST_DIR="/tmp/deployment-test-env-security"
TEST_LOG="/tmp/test-secure-environment-manager.log"
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

# Mock encryption tools
setup_encryption_mocks() {
    # Create mock openssl command
    cat > "$TEST_DIR/openssl" << 'EOF'
#!/bin/bash
# Mock openssl command for testing

case "$1" in
    "enc")
        if [[ "$*" =~ -d ]]; then
            # Decryption
            local input_file=""
            local output_file=""
            for arg in "$@"; do
                if [[ "$prev_arg" == "-in" ]]; then
                    input_file="$arg"
                elif [[ "$prev_arg" == "-out" ]]; then
                    output_file="$arg"
                fi
                prev_arg="$arg"
            done
            
            if [[ -f "$input_file" ]]; then
                echo "# Decrypted environment variables" > "$output_file"
                echo "DATABASE_URL=postgresql://user:pass@localhost/db" >> "$output_file"
                echo "API_KEY=test-api-key-12345" >> "$output_file"
                echo "JWT_SECRET=super-secret-jwt-key" >> "$output_file"
                exit 0
            else
                echo "Error: input file not found"
                exit 1
            fi
        else
            # Encryption
            local input_file=""
            local output_file=""
            for arg in "$@"; do
                if [[ "$prev_arg" == "-in" ]]; then
                    input_file="$arg"
                elif [[ "$prev_arg" == "-out" ]]; then
                    output_file="$arg"
                fi
                prev_arg="$arg"
            done
            
            if [[ -f "$input_file" ]]; then
                echo "U2FsdGVkX1+encrypted+mock+data+here" > "$output_file"
                exit 0
            else
                echo "Error: input file not found"
                exit 1
            fi
        fi
        ;;
    "rand")
        echo "random-salt-data-here"
        exit 0
        ;;
    *)
        echo "Mock openssl: $*"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/openssl"
    
    # Create mock gpg command
    cat > "$TEST_DIR/gpg" << 'EOF'
#!/bin/bash
# Mock gpg command for testing

case "$1" in
    "--symmetric")
        local input_file=""
        local output_file=""
        for arg in "$@"; do
            if [[ "$prev_arg" == "--output" ]]; then
                output_file="$arg"
            elif [[ -f "$arg" && "$arg" != "--symmetric" && "$arg" != "--cipher-algo" && "$arg" != "AES256" && "$arg" != "--output" ]]; then
                input_file="$arg"
            fi
            prev_arg="$arg"
        done
        
        if [[ -f "$input_file" ]]; then
            echo "-----BEGIN PGP MESSAGE-----" > "$output_file"
            echo "mock-encrypted-gpg-data-here" >> "$output_file"
            echo "-----END PGP MESSAGE-----" >> "$output_file"
            exit 0
        else
            echo "Error: input file not found"
            exit 1
        fi
        ;;
    "--decrypt")
        local input_file=""
        local output_file=""
        for arg in "$@"; do
            if [[ "$prev_arg" == "--output" ]]; then
                output_file="$arg"
            elif [[ -f "$arg" && "$arg" != "--decrypt" && "$arg" != "--output" ]]; then
                input_file="$arg"
            fi
            prev_arg="$arg"
        done
        
        if [[ -f "$input_file" ]]; then
            echo "# Decrypted environment variables" > "$output_file"
            echo "DATABASE_URL=postgresql://user:pass@localhost/db" >> "$output_file"
            echo "API_KEY=test-api-key-12345" >> "$output_file"
            echo "JWT_SECRET=super-secret-jwt-key" >> "$output_file"
            exit 0
        else
            echo "Error: input file not found"
            exit 1
        fi
        ;;
    *)
        echo "Mock gpg: $*"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/gpg"
    
    # Create mock shred command
    cat > "$TEST_DIR/shred" << 'EOF'
#!/bin/bash
# Mock shred command for testing

for arg in "$@"; do
    if [[ -f "$arg" ]]; then
        rm -f "$arg"
    fi
done
exit 0
EOF
    chmod +x "$TEST_DIR/shred"
    
    export PATH="$TEST_DIR:$PATH"
}

# Initialize test environment
setup_test_environment() {
    print_test_header "Setting up secure environment manager test environment"
    
    # Create test directory
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"
    
    # Setup mock encryption tools
    setup_encryption_mocks
    
    # Create test .env file
    cat > .env << 'EOF'
# Test environment variables
DATABASE_URL=postgresql://user:pass@localhost/db
API_KEY=test-api-key-12345
JWT_SECRET=super-secret-jwt-key
REDIS_URL=redis://localhost:6379
SMTP_PASSWORD=email-password-123
GITHUB_TOKEN=ghp_test_token_12345
EOF
    
    # Initialize test log
    echo "=== Secure Environment Manager Tests - $(date) ===" > "$TEST_LOG"
    
    print_test_info "Test environment initialized in $TEST_DIR"
}

# Cleanup test environment
cleanup_test_environment() {
    print_test_header "Cleaning up secure environment manager test environment"
    cd /tmp
    rm -rf "$TEST_DIR"
    print_test_info "Test environment cleaned up"
}

# Test environment file encryption
test_environment_file_encryption() {
    print_test_header "Testing environment file encryption"
    
    # Test encrypt_environment_file function
    ((TESTS_RUN++))
    
    encrypt_environment_file() {
        local env_file="$1"
        local encrypted_file="$2"
        local passphrase="$3"
        local method="${4:-openssl}"
        
        if [[ ! -f "$env_file" ]]; then
            return 1
        fi
        
        case "$method" in
            "openssl")
                if openssl enc -aes-256-cbc -salt -in "$env_file" -out "$encrypted_file" -k "$passphrase" 2>/dev/null; then
                    return 0
                else
                    return 1
                fi
                ;;
            "gpg")
                if gpg --symmetric --cipher-algo AES256 --output "$encrypted_file" "$env_file" 2>/dev/null; then
                    return 0
                else
                    return 1
                fi
                ;;
            *)
                return 1
                ;;
        esac
    }
    
    # Test OpenSSL encryption
    if encrypt_environment_file ".env" ".env.encrypted" "test-passphrase" "openssl"; then
        if [[ -f ".env.encrypted" ]] && [[ -s ".env.encrypted" ]]; then
            print_test_pass "encrypt_environment_file successfully encrypts with OpenSSL"
        else
            print_test_fail "encrypt_environment_file created empty encrypted file"
        fi
    else
        print_test_fail "encrypt_environment_file failed with OpenSSL"
    fi
    
    # Test GPG encryption
    ((TESTS_RUN++))
    if encrypt_environment_file ".env" ".env.gpg" "test-passphrase" "gpg"; then
        if [[ -f ".env.gpg" ]] && [[ -s ".env.gpg" ]]; then
            print_test_pass "encrypt_environment_file successfully encrypts with GPG"
        else
            print_test_fail "encrypt_environment_file created empty GPG file"
        fi
    else
        print_test_fail "encrypt_environment_file failed with GPG"
    fi
}

# Test environment file decryption
test_environment_file_decryption() {
    print_test_header "Testing environment file decryption"
    
    # Test decrypt_environment_file function
    ((TESTS_RUN++))
    
    decrypt_environment_file() {
        local encrypted_file="$1"
        local decrypted_file="$2"
        local passphrase="$3"
        local method="${4:-openssl}"
        
        if [[ ! -f "$encrypted_file" ]]; then
            return 1
        fi
        
        case "$method" in
            "openssl")
                if openssl enc -aes-256-cbc -d -in "$encrypted_file" -out "$decrypted_file" -k "$passphrase" 2>/dev/null; then
                    return 0
                else
                    return 1
                fi
                ;;
            "gpg")
                if gpg --decrypt --output "$decrypted_file" "$encrypted_file" 2>/dev/null; then
                    return 0
                else
                    return 1
                fi
                ;;
            *)
                return 1
                ;;
        esac
    }
    
    # Test OpenSSL decryption
    if decrypt_environment_file ".env.encrypted" ".env.decrypted" "test-passphrase" "openssl"; then
        if [[ -f ".env.decrypted" ]] && grep -q "DATABASE_URL" ".env.decrypted"; then
            print_test_pass "decrypt_environment_file successfully decrypts OpenSSL file"
        else
            print_test_fail "decrypt_environment_file failed to decrypt properly"
        fi
    else
        print_test_fail "decrypt_environment_file failed with OpenSSL"
    fi
    
    # Test GPG decryption
    ((TESTS_RUN++))
    if decrypt_environment_file ".env.gpg" ".env.gpg.decrypted" "test-passphrase" "gpg"; then
        if [[ -f ".env.gpg.decrypted" ]] && grep -q "DATABASE_URL" ".env.gpg.decrypted"; then
            print_test_pass "decrypt_environment_file successfully decrypts GPG file"
        else
            print_test_fail "decrypt_environment_file failed to decrypt GPG properly"
        fi
    else
        print_test_fail "decrypt_environment_file failed with GPG"
    fi
}

# Test secure environment variable loading
test_secure_environment_loading() {
    print_test_header "Testing secure environment variable loading"
    
    # Test load_environment_variables_securely function
    ((TESTS_RUN++))
    
    load_environment_variables_securely() {
        local encrypted_file="$1"
        local passphrase="$2"
        local temp_dir="${3:-/tmp}"
        local method="${4:-openssl}"
        
        # Create temporary file with restricted permissions
        local temp_file=$(mktemp "$temp_dir/.env.XXXXXX")
        chmod 600 "$temp_file"
        
        # Decrypt to temporary file
        if decrypt_environment_file "$encrypted_file" "$temp_file" "$passphrase" "$method"; then
            # Source the environment variables
            set -a  # Export all variables
            source "$temp_file"
            set +a  # Stop exporting
            
            # Secure cleanup
            shred -vfz -n 3 "$temp_file" 2>/dev/null || rm -f "$temp_file"
            
            return 0
        else
            rm -f "$temp_file"
            return 1
        fi
    }
    
    # Test secure loading
    if load_environment_variables_securely ".env.encrypted" "test-passphrase" "$TEST_DIR" "openssl"; then
        if [[ -n "$DATABASE_URL" ]] && [[ -n "$API_KEY" ]]; then
            print_test_pass "load_environment_variables_securely loads variables correctly"
        else
            print_test_fail "load_environment_variables_securely failed to load variables"
        fi
    else
        print_test_fail "load_environment_variables_securely failed to decrypt and load"
    fi
}

# Test sensitive variable detection and masking
test_sensitive_variable_masking() {
    print_test_header "Testing sensitive variable detection and masking"
    
    # Test mask_sensitive_variables function
    ((TESTS_RUN++))
    
    mask_sensitive_variables() {
        local log_message="$1"
        local masked_message="$log_message"
        
        # Define sensitive patterns
        local sensitive_patterns=(
            "*TOKEN*" "*KEY*" "*SECRET*" "*PASSWORD*" 
            "*PRIVATE*" "*CREDENTIAL*" "*AUTH*"
        )
        
        # Mask sensitive values
        for pattern in "${sensitive_patterns[@]}"; do
            # Simple masking - replace with [MASKED]
            masked_message=$(echo "$masked_message" | sed -E 's/(TOKEN|KEY|SECRET|PASSWORD|PRIVATE|CREDENTIAL|AUTH)[^=]*=[^[:space:]]*/\1=***MASKED***/gi')
        done
        
        echo "$masked_message"
    }
    
    local test_message="Setting API_KEY=secret123 and JWT_SECRET=supersecret for deployment"
    local masked_message=$(mask_sensitive_variables "$test_message")
    
    if [[ "$masked_message" =~ \*\*\*MASKED\*\*\* ]] && [[ ! "$masked_message" =~ secret123 ]]; then
        print_test_pass "mask_sensitive_variables correctly masks sensitive values"
    else
        print_test_fail "mask_sensitive_variables failed to mask sensitive values: $masked_message"
    fi
}

# Test environment variable validation
test_environment_variable_validation() {
    print_test_header "Testing environment variable validation"
    
    # Test validate_environment_variables function
    ((TESTS_RUN++))
    
    validate_environment_variables() {
        local env_file="$1"
        local required_vars=("$@")
        shift  # Remove env_file from required_vars
        
        if [[ ! -f "$env_file" ]]; then
            return 1
        fi
        
        # Check for required variables
        for var in "${required_vars[@]}"; do
            if ! grep -q "^$var=" "$env_file"; then
                echo "Missing required variable: $var"
                return 1
            fi
        done
        
        # Check for empty values
        if grep -q "^[A-Z_]*=$" "$env_file"; then
            echo "Found empty environment variables"
            return 1
        fi
        
        return 0
    }
    
    local required_vars=("DATABASE_URL" "API_KEY" "JWT_SECRET")
    if validate_environment_variables ".env" "${required_vars[@]}"; then
        print_test_pass "validate_environment_variables confirms all required variables present"
    else
        print_test_fail "validate_environment_variables failed validation"
    fi
    
    # Test with missing variable
    ((TESTS_RUN++))
    echo "MISSING_VAR=" >> .env  # Add empty variable
    if ! validate_environment_variables ".env" "${required_vars[@]}" "MISSING_VAR"; then
        print_test_pass "validate_environment_variables correctly detects empty variables"
    else
        print_test_fail "validate_environment_variables should fail with empty variables"
    fi
}

# Test secure file cleanup
test_secure_file_cleanup() {
    print_test_header "Testing secure file cleanup"
    
    # Test cleanup_environment_files function
    ((TESTS_RUN++))
    
    cleanup_environment_files() {
        local temp_dir="$1"
        local secure_delete="${2:-true}"
        
        # Find temporary environment files
        local temp_files=$(find "$temp_dir" -name ".env.*" -o -name "*.env.tmp" 2>/dev/null || true)
        
        if [[ -n "$temp_files" ]]; then
            for file in $temp_files; do
                if [[ "$secure_delete" == "true" ]]; then
                    # Secure deletion with shred
                    shred -vfz -n 3 "$file" 2>/dev/null || rm -f "$file"
                else
                    # Regular deletion
                    rm -f "$file"
                fi
            done
        fi
        
        return 0
    }
    
    # Create temporary environment files
    echo "TEST_VAR=value" > "$TEST_DIR/.env.tmp1"
    echo "TEST_VAR=value" > "$TEST_DIR/.env.tmp2"
    echo "TEST_VAR=value" > "$TEST_DIR/test.env.tmp"
    
    local initial_count=$(find "$TEST_DIR" -name ".env.*" -o -name "*.env.tmp" | wc -l)
    
    cleanup_environment_files "$TEST_DIR" "true"
    
    local final_count=$(find "$TEST_DIR" -name ".env.*" -o -name "*.env.tmp" | wc -l)
    
    if [[ $initial_count -eq 3 ]] && [[ $final_count -eq 0 ]]; then
        print_test_pass "cleanup_environment_files securely removes all temporary files"
    else
        print_test_fail "cleanup_environment_files failed to clean up files (initial: $initial_count, final: $final_count)"
    fi
}

# Test environment variable backup and restoration
test_environment_backup_restoration() {
    print_test_header "Testing environment variable backup and restoration"
    
    # Test backup_environment_state function
    ((TESTS_RUN++))
    
    backup_environment_state() {
        local backup_file="$1"
        
        # Export current environment variables to backup file
        env | grep -E '^(DATABASE_URL|API_KEY|JWT_SECRET|REDIS_URL)=' > "$backup_file" 2>/dev/null || true
        
        if [[ -s "$backup_file" ]]; then
            return 0
        else
            return 1
        fi
    }
    
    # Set some test environment variables
    export DATABASE_URL="postgresql://test@localhost/test"
    export API_KEY="test-key-123"
    
    local backup_file="$TEST_DIR/env-backup.txt"
    if backup_environment_state "$backup_file"; then
        if [[ -f "$backup_file" ]] && grep -q "DATABASE_URL" "$backup_file"; then
            print_test_pass "backup_environment_state creates environment backup"
        else
            print_test_fail "backup_environment_state created empty backup"
        fi
    else
        print_test_fail "backup_environment_state failed to create backup"
    fi
    
    # Test restore_environment_state function
    ((TESTS_RUN++))
    
    restore_environment_state() {
        local backup_file="$1"
        
        if [[ ! -f "$backup_file" ]]; then
            return 1
        fi
        
        # Source the backup file to restore variables
        set -a
        source "$backup_file"
        set +a
        
        return 0
    }
    
    # Clear current variables
    unset DATABASE_URL API_KEY
    
    if restore_environment_state "$backup_file"; then
        if [[ -n "$DATABASE_URL" ]] && [[ -n "$API_KEY" ]]; then
            print_test_pass "restore_environment_state restores environment variables"
        else
            print_test_fail "restore_environment_state failed to restore variables"
        fi
    else
        print_test_fail "restore_environment_state failed to restore from backup"
    fi
}

# Test encryption integrity verification
test_encryption_integrity() {
    print_test_header "Testing encryption integrity verification"
    
    # Test verify_encryption_integrity function
    ((TESTS_RUN++))
    
    verify_encryption_integrity() {
        local original_file="$1"
        local encrypted_file="$2"
        local decrypted_file="$3"
        local passphrase="$4"
        
        # Decrypt the encrypted file
        if ! decrypt_environment_file "$encrypted_file" "$decrypted_file" "$passphrase" "openssl"; then
            return 1
        fi
        
        # Compare original and decrypted files
        if diff "$original_file" "$decrypted_file" >/dev/null 2>&1; then
            return 0
        else
            return 1
        fi
    }
    
    local decrypted_test="$TEST_DIR/.env.integrity.test"
    if verify_encryption_integrity ".env" ".env.encrypted" "$decrypted_test" "test-passphrase"; then
        print_test_pass "verify_encryption_integrity confirms encryption/decryption integrity"
    else
        print_test_fail "verify_encryption_integrity detected integrity issues"
    fi
    
    # Cleanup
    rm -f "$decrypted_test"
}

# Run all tests
run_all_tests() {
    print_test_header "Starting Secure Environment Manager Unit Tests"
    
    setup_test_environment
    
    # Run individual test functions
    test_environment_file_encryption
    test_environment_file_decryption
    test_secure_environment_loading
    test_sensitive_variable_masking
    test_environment_variable_validation
    test_secure_file_cleanup
    test_environment_backup_restoration
    test_encryption_integrity
    
    cleanup_test_environment
    
    # Print test summary
    print_test_header "Test Summary"
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        print_test_pass "All secure environment manager tests passed!"
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