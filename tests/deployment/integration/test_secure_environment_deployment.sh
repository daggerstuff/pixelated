#!/bin/bash

# Secure Environment Variable Deployment Integration Tests
# Tests end-to-end secure environment variable handling

set -e

# Test configuration
TEST_DIR="/tmp/deployment-integration-secure-env"
TEST_LOG="/tmp/test-secure-environment-deployment.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
print_test_header() { echo -e "${BLUE}[SECURE-ENV-TEST]${NC} $1"; }
print_test_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
print_test_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
print_test_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Mock encryption and security tools
setup_security_mocks() {
    print_test_info "Setting up security testing mocks"
    
    # Create mock openssl command
    cat > "$TEST_DIR/openssl" << 'EOF'
#!/bin/bash
# Mock openssl command for secure environment testing

case "$1" in
    "enc")
        if [[ "$*" =~ -d ]]; then
            # Decryption
            local input_file=""
            local output_file=""
            local passphrase=""
            
            for i in "${!@}"; do
                case "${!i}" in
                    "-in")
                        ((i++))
                        input_file="${!i}"
                        ;;
                    "-out")
                        ((i++))
                        output_file="${!i}"
                        ;;
                    "-k")
                        ((i++))
                        passphrase="${!i}"
                        ;;
                esac
            done
            
            if [[ -f "$input_file" && "$passphrase" == "test-deployment-key" ]]; then
                cat > "$output_file" << 'ENVEOF'
# Decrypted environment variables
DATABASE_URL=postgresql://user:secure_pass@localhost/pixelated_prod
API_KEY=prod-api-key-abc123def456
JWT_SECRET=super-secure-jwt-production-key
REDIS_URL=redis://localhost:6379/0
SMTP_PASSWORD=secure-email-password-xyz789
GITHUB_TOKEN=ghp_production_token_secure_123
SENTRY_DSN=https://key@sentry.io/project
ENVEOF
                exit 0
            else
                echo "bad decrypt"
                exit 1
            fi
        else
            # Encryption
            local input_file=""
            local output_file=""
            
            for i in "${!@}"; do
                case "${!i}" in
                    "-in")
                        ((i++))
                        input_file="${!i}"
                        ;;
                    "-out")
                        ((i++))
                        output_file="${!i}"
                        ;;
                esac
            done
            
            if [[ -f "$input_file" ]]; then
                echo "U2FsdGVkX1+$(openssl rand -hex 32)" > "$output_file"
                exit 0
            else
                echo "can't open input file"
                exit 1
            fi
        fi
        ;;
    "rand")
        case "$2" in
            "-hex")
                echo "$(printf '%032x' $((RANDOM * RANDOM)))"
                ;;
            *)
                echo "random-binary-data"
                ;;
        esac
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
# Mock gpg command for secure environment testing

case "$1" in
    "--symmetric")
        local input_file=""
        local output_file=""
        
        for i in "${!@}"; do
            case "${!i}" in
                "--output")
                    ((i++))
                    output_file="${!i}"
                    ;;
            esac
        done
        
        # Find input file (last non-option argument)
        for arg in "$@"; do
            if [[ -f "$arg" ]]; then
                input_file="$arg"
            fi
        done
        
        if [[ -f "$input_file" ]]; then
            cat > "$output_file" << 'GPGEOF'
-----BEGIN PGP MESSAGE-----

hQEMA1234567890ABCDEF
encrypted-environment-data-here-with-gpg
mock-encrypted-content-for-testing
-----END PGP MESSAGE-----
GPGEOF
            exit 0
        else
            echo "gpg: can't open input file"
            exit 1
        fi
        ;;
    "--decrypt")
        local input_file=""
        local output_file=""
        
        for i in "${!@}"; do
            case "${!i}" in
                "--output")
                    ((i++))
                    output_file="${!i}"
                    ;;
            esac
        done
        
        # Find input file (last non-option argument)
        for arg in "$@"; do
            if [[ -f "$arg" ]]; then
                input_file="$arg"
            fi
        done
        
        if [[ -f "$input_file" ]]; then
            cat > "$output_file" << 'ENVEOF'
# GPG Decrypted environment variables
DATABASE_URL=postgresql://user:gpg_secure_pass@localhost/pixelated_prod
API_KEY=gpg-prod-api-key-xyz789
JWT_SECRET=gpg-super-secure-jwt-key
REDIS_URL=redis://localhost:6379/1
ENVEOF
            exit 0
        else
            echo "gpg: can't open input file"
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
# Mock shred command for secure deletion

for arg in "$@"; do
    if [[ -f "$arg" ]]; then
        # Simulate secure deletion
        echo "shred: $arg: pass 1/3 (random)..."
        echo "shred: $arg: pass 2/3 (random)..."
        echo "shred: $arg: pass 3/3 (zeros)..."
        rm -f "$arg"
    fi
done
exit 0
EOF
    chmod +x "$TEST_DIR/shred"
    
    # Create mock rsync command
    cat > "$TEST_DIR/rsync" << 'EOF'
#!/bin/bash
# Mock rsync command for secure file transfer

echo "Mock rsync: transferring encrypted files..."
echo "sent 1,234 bytes  received 567 bytes  1,801.00 bytes/sec"
echo "total size is 1,234  speedup is 1.00"
exit 0
EOF
    chmod +x "$TEST_DIR/rsync"
    
    # Create mock ssh command
    cat > "$TEST_DIR/ssh" << 'EOF'
#!/bin/bash
# Mock ssh command for secure environment testing

# Extract the command being run remotely
local remote_command=""
local host=""

# Parse SSH arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|-p|-o)
            shift 2  # Skip option and its value
            ;;
        *@*)
            host="$1"
            shift
            ;;
        *)
            remote_command="$*"
            break
            ;;
    esac
done

# Mock remote command execution
case "$remote_command" in
    *"openssl enc"*"-d"*)
        # Mock decryption on remote host
        echo "Decrypting environment file on remote host..."
        exit 0
        ;;
    *"shred"*)
        # Mock secure deletion on remote host
        echo "Securely deleting temporary files on remote host..."
        exit 0
        ;;
    *"source"*".env"*)
        # Mock environment variable loading
        echo "Loading environment variables on remote host..."
        exit 0
        ;;
    *"env | grep"*)
        # Mock environment variable verification
        echo "DATABASE_URL=postgresql://user:***MASKED***@localhost/pixelated_prod"
        echo "API_KEY=***MASKED***"
        echo "JWT_SECRET=***MASKED***"
        exit 0
        ;;
    *)
        echo "Mock SSH executing: $remote_command"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/ssh"
    
    export PATH="$TEST_DIR:$PATH"
}

# Initialize test environment
setup_test_environment() {
    print_test_header "Setting up secure environment deployment test environment"
    
    # Create test directory structure
    mkdir -p "$TEST_DIR"/{local,remote,encrypted,logs}
    cd "$TEST_DIR"
    
    # Setup security mocks
    setup_security_mocks
    
    # Create test environment files
    cat > local/.env << 'EOF'
# Production environment variables
DATABASE_URL=postgresql://user:secure_pass@localhost/pixelated_prod
API_KEY=prod-api-key-abc123def456
JWT_SECRET=super-secure-jwt-production-key
REDIS_URL=redis://localhost:6379/0
SMTP_PASSWORD=secure-email-password-xyz789
GITHUB_TOKEN=ghp_production_token_secure_123
SENTRY_DSN=https://key@sentry.io/project
STRIPE_SECRET_KEY=sk_live_secure_stripe_key_123
AWS_ACCESS_KEY_ID=AKIA_SECURE_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=secure_aws_secret_access_key_xyz
EOF
    
    # Create test environment with sensitive patterns
    cat > local/.env.test << 'EOF'
# Test environment with various sensitive patterns
DATABASE_PASSWORD=test_db_password_123
API_TOKEN=test_api_token_xyz789
PRIVATE_KEY=-----BEGIN PRIVATE KEY-----test-key-----END PRIVATE KEY-----
AUTH_SECRET=test_auth_secret_abc123
CREDENTIAL_FILE=/path/to/credentials.json
EOF
    
    # Initialize test log
    echo "=== Secure Environment Deployment Integration Tests - $(date) ===" > "$TEST_LOG"
    
    print_test_info "Test environment initialized in $TEST_DIR"
}

# Cleanup test environment
cleanup_test_environment() {
    print_test_header "Cleaning up secure environment deployment test environment"
    cd /tmp
    rm -rf "$TEST_DIR"
    print_test_info "Test environment cleaned up"
}

# Test end-to-end environment encryption and deployment
test_end_to_end_secure_deployment() {
    print_test_header "Testing end-to-end secure environment deployment"
    ((TESTS_RUN++))
    
    simulate_secure_deployment() {
        local env_file="$1"
        local deployment_log="$2"
        
        echo "=== End-to-End Secure Environment Deployment ===" > "$deployment_log"
        
        # Step 1: Encrypt environment file locally
        echo "[$(date)] Step 1: Encrypting environment file locally" >> "$deployment_log"
        local encrypted_file="$TEST_DIR/encrypted/.env.encrypted"
        mkdir -p "$(dirname "$encrypted_file")"
        
        if openssl enc -aes-256-cbc -salt -in "$env_file" -out "$encrypted_file" -k "test-deployment-key" 2>/dev/null; then
            echo "[$(date)] Local encryption: SUCCESS" >> "$deployment_log"
        else
            echo "[$(date)] Local encryption: FAIL" >> "$deployment_log"
            return 1
        fi
        
        # Step 2: Transfer encrypted file to VPS
        echo "[$(date)] Step 2: Transferring encrypted file to VPS" >> "$deployment_log"
        if rsync -avz "$encrypted_file" root@test-vps:/tmp/.env.encrypted >/dev/null 2>&1; then
            echo "[$(date)] Encrypted file transfer: SUCCESS" >> "$deployment_log"
        else
            echo "[$(date)] Encrypted file transfer: FAIL" >> "$deployment_log"
            return 1
        fi
        
        # Step 3: Decrypt on VPS with restricted permissions
        echo "[$(date)] Step 3: Decrypting on VPS with restricted permissions" >> "$deployment_log"
        if ssh root@test-vps "openssl enc -aes-256-cbc -d -in /tmp/.env.encrypted -out /tmp/.env.tmp -k test-deployment-key && chmod 600 /tmp/.env.tmp" >/dev/null 2>&1; then
            echo "[$(date)] Remote decryption: SUCCESS" >> "$deployment_log"
        else
            echo "[$(date)] Remote decryption: FAIL" >> "$deployment_log"
            return 1
        fi
        
        # Step 4: Load environment variables for deployment
        echo "[$(date)] Step 4: Loading environment variables for deployment" >> "$deployment_log"
        if ssh root@test-vps "source /tmp/.env.tmp && env | grep -E '^(DATABASE_URL|API_KEY|JWT_SECRET)=' | wc -l" >/dev/null 2>&1; then
            echo "[$(date)] Environment variable loading: SUCCESS" >> "$deployment_log"
        else
            echo "[$(date)] Environment variable loading: FAIL" >> "$deployment_log"
            return 1
        fi
        
        # Step 5: Secure cleanup of temporary files
        echo "[$(date)] Step 5: Secure cleanup of temporary files" >> "$deployment_log"
        if ssh root@test-vps "shred -vfz -n 3 /tmp/.env.tmp /tmp/.env.encrypted" >/dev/null 2>&1; then
            echo "[$(date)] Secure cleanup: SUCCESS" >> "$deployment_log"
        else
            echo "[$(date)] Secure cleanup: WARNING" >> "$deployment_log"
        fi
        
        echo "[$(date)] End-to-end secure deployment completed" >> "$deployment_log"
        return 0
    }
    
    local deployment_log="$TEST_DIR/logs/secure-deployment.log"
    
    if simulate_secure_deployment "$TEST_DIR/local/.env" "$deployment_log"; then
        local success_count=$(grep -c "SUCCESS" "$deployment_log")
        if [[ $success_count -ge 4 ]]; then
            print_test_pass "End-to-end secure environment deployment completed all security steps"
        else
            print_test_fail "End-to-end secure deployment missing security steps (completed: $success_count)"
        fi
    else
        print_test_fail "End-to-end secure environment deployment failed"
    fi
}

# Test encryption method comparison
test_encryption_method_comparison() {
    print_test_header "Testing encryption method comparison (OpenSSL vs GPG)"
    ((TESTS_RUN++))
    
    compare_encryption_methods() {
        local env_file="$1"
        local comparison_log="$2"
        
        echo "=== Encryption Method Comparison ===" > "$comparison_log"
        
        # Test OpenSSL encryption
        echo "[$(date)] Testing OpenSSL AES-256-CBC encryption" >> "$comparison_log"
        local openssl_encrypted="$TEST_DIR/encrypted/.env.openssl"
        local openssl_decrypted="$TEST_DIR/encrypted/.env.openssl.dec"
        
        local openssl_start=$(date +%s%3N)
        if openssl enc -aes-256-cbc -salt -in "$env_file" -out "$openssl_encrypted" -k "test-key" 2>/dev/null; then
            local openssl_encrypt_end=$(date +%s%3N)
            local openssl_encrypt_time=$((openssl_encrypt_end - openssl_start))
            
            if openssl enc -aes-256-cbc -d -in "$openssl_encrypted" -out "$openssl_decrypted" -k "test-key" 2>/dev/null; then
                local openssl_decrypt_end=$(date +%s%3N)
                local openssl_decrypt_time=$((openssl_decrypt_end - openssl_encrypt_end))
                
                echo "[$(date)] OpenSSL encryption: SUCCESS (${openssl_encrypt_time}ms)" >> "$comparison_log"
                echo "[$(date)] OpenSSL decryption: SUCCESS (${openssl_decrypt_time}ms)" >> "$comparison_log"
                
                # Verify integrity
                if diff "$env_file" "$openssl_decrypted" >/dev/null 2>&1; then
                    echo "[$(date)] OpenSSL integrity check: PASS" >> "$comparison_log"
                else
                    echo "[$(date)] OpenSSL integrity check: FAIL" >> "$comparison_log"
                fi
            else
                echo "[$(date)] OpenSSL decryption: FAIL" >> "$comparison_log"
            fi
        else
            echo "[$(date)] OpenSSL encryption: FAIL" >> "$comparison_log"
        fi
        
        # Test GPG encryption
        echo "[$(date)] Testing GPG symmetric encryption" >> "$comparison_log"
        local gpg_encrypted="$TEST_DIR/encrypted/.env.gpg"
        local gpg_decrypted="$TEST_DIR/encrypted/.env.gpg.dec"
        
        local gpg_start=$(date +%s%3N)
        if gpg --symmetric --cipher-algo AES256 --output "$gpg_encrypted" "$env_file" 2>/dev/null; then
            local gpg_encrypt_end=$(date +%s%3N)
            local gpg_encrypt_time=$((gpg_encrypt_end - gpg_start))
            
            if gpg --decrypt --output "$gpg_decrypted" "$gpg_encrypted" 2>/dev/null; then
                local gpg_decrypt_end=$(date +%s%3N)
                local gpg_decrypt_time=$((gpg_decrypt_end - gpg_encrypt_end))
                
                echo "[$(date)] GPG encryption: SUCCESS (${gpg_encrypt_time}ms)" >> "$comparison_log"
                echo "[$(date)] GPG decryption: SUCCESS (${gpg_decrypt_time}ms)" >> "$comparison_log"
                
                # Verify integrity
                if diff "$env_file" "$gpg_decrypted" >/dev/null 2>&1; then
                    echo "[$(date)] GPG integrity check: PASS" >> "$comparison_log"
                else
                    echo "[$(date)] GPG integrity check: FAIL" >> "$comparison_log"
                fi
            else
                echo "[$(date)] GPG decryption: FAIL" >> "$comparison_log"
            fi
        else
            echo "[$(date)] GPG encryption: FAIL" >> "$comparison_log"
        fi
        
        # Comparison summary
        echo "" >> "$comparison_log"
        echo "=== Method Comparison Summary ===" >> "$comparison_log"
        echo "OpenSSL: Fast, widely available, simple CLI" >> "$comparison_log"
        echo "GPG: More secure key management, better for long-term storage" >> "$comparison_log"
        echo "Recommendation: OpenSSL for deployment automation, GPG for manual operations" >> "$comparison_log"
        
        return 0
    }
    
    local comparison_log="$TEST_DIR/logs/encryption-comparison.log"
    
    if compare_encryption_methods "$TEST_DIR/local/.env" "$comparison_log"; then
        local openssl_success=$(grep -c "OpenSSL.*SUCCESS" "$comparison_log")
        local gpg_success=$(grep -c "GPG.*SUCCESS" "$comparison_log")
        local integrity_pass=$(grep -c "integrity check: PASS" "$comparison_log")
        
        if [[ $openssl_success -ge 2 ]] && [[ $gpg_success -ge 2 ]] && [[ $integrity_pass -ge 2 ]]; then
            print_test_pass "Encryption method comparison validates both OpenSSL and GPG methods"
        else
            print_test_fail "Encryption method comparison failed validation (OpenSSL: $openssl_success, GPG: $gpg_success, Integrity: $integrity_pass)"
        fi
    else
        print_test_fail "Encryption method comparison failed"
    fi
}

# Test sensitive variable detection and masking
test_sensitive_variable_masking() {
    print_test_header "Testing sensitive variable detection and masking"
    ((TESTS_RUN++))
    
    test_variable_masking() {
        local env_file="$1"
        local masking_log="$2"
        
        echo "=== Sensitive Variable Detection and Masking ===" > "$masking_log"
        
        # Define sensitive patterns
        local sensitive_patterns=(
            "*TOKEN*" "*KEY*" "*SECRET*" "*PASSWORD*" 
            "*PRIVATE*" "*CREDENTIAL*" "*AUTH*"
        )
        
        # Test masking function
        mask_sensitive_variables() {
            local log_message="$1"
            local masked_message="$log_message"
            
            # Apply masking patterns
            for pattern in "${sensitive_patterns[@]}"; do
                # Convert pattern to regex and mask values
                local regex_pattern=$(echo "$pattern" | sed 's/\*/[^=]*/g')
                masked_message=$(echo "$masked_message" | sed -E "s/($regex_pattern)=[^[:space:]]*/\1=***MASKED***/gi")
            done
            
            echo "$masked_message"
        }
        
        # Test with various sensitive variable formats
        local test_messages=(
            "Setting DATABASE_PASSWORD=secret123 for deployment"
            "Loading API_TOKEN=abc123xyz789 and JWT_SECRET=supersecret"
            "Configuring PRIVATE_KEY=/path/to/key.pem and AUTH_SECRET=authkey"
            "Environment: DATABASE_URL=postgresql://user:pass@host/db"
        )
        
        echo "[$(date)] Testing sensitive variable masking patterns" >> "$masking_log"
        
        local masked_count=0
        local total_tests=${#test_messages[@]}
        
        for message in "${test_messages[@]}"; do
            local masked_message=$(mask_sensitive_variables "$message")
            
            echo "Original: $message" >> "$masking_log"
            echo "Masked:   $masked_message" >> "$masking_log"
            
            # Check if sensitive values were masked
            if [[ "$masked_message" =~ \*\*\*MASKED\*\*\* ]] && [[ ! "$masked_message" =~ secret123|abc123xyz789|supersecret|authkey ]]; then
                echo "Result:   PASS - Sensitive values masked" >> "$masking_log"
                ((masked_count++))
            else
                echo "Result:   FAIL - Sensitive values not properly masked" >> "$masking_log"
            fi
            echo "" >> "$masking_log"
        done
        
        echo "=== Masking Test Summary ===" >> "$masking_log"
        echo "Total tests: $total_tests" >> "$masking_log"
        echo "Successfully masked: $masked_count" >> "$masking_log"
        echo "Success rate: $(( masked_count * 100 / total_tests ))%" >> "$masking_log"
        
        if [[ $masked_count -eq $total_tests ]]; then
            return 0
        else
            return 1
        fi
    }
    
    local masking_log="$TEST_DIR/logs/variable-masking.log"
    
    if test_variable_masking "$TEST_DIR/local/.env.test" "$masking_log"; then
        local success_rate=$(grep "Success rate:" "$masking_log" | awk '{print $3}' | sed 's/%//')
        print_test_pass "Sensitive variable masking achieved ${success_rate}% success rate"
    else
        print_test_fail "Sensitive variable masking failed to mask all sensitive values"
    fi
}

# Test environment variable validation and integrity
test_environment_validation_integrity() {
    print_test_header "Testing environment variable validation and integrity"
    ((TESTS_RUN++))
    
    validate_environment_integrity() {
        local env_file="$1"
        local validation_log="$2"
        
        echo "=== Environment Variable Validation and Integrity ===" > "$validation_log"
        
        # Test 1: Required variables validation
        echo "[$(date)] Test 1: Required variables validation" >> "$validation_log"
        local required_vars=("DATABASE_URL" "API_KEY" "JWT_SECRET")
        local missing_vars=()
        
        for var in "${required_vars[@]}"; do
            if grep -q "^$var=" "$env_file"; then
                echo "  ✓ $var: PRESENT" >> "$validation_log"
            else
                echo "  ✗ $var: MISSING" >> "$validation_log"
                missing_vars+=("$var")
            fi
        done
        
        if [[ ${#missing_vars[@]} -eq 0 ]]; then
            echo "[$(date)] Required variables validation: PASS" >> "$validation_log"
        else
            echo "[$(date)] Required variables validation: FAIL (missing: ${missing_vars[*]})" >> "$validation_log"
            return 1
        fi
        
        # Test 2: Empty value detection
        echo "[$(date)] Test 2: Empty value detection" >> "$validation_log"
        local empty_vars=$(grep "^[A-Z_]*=$" "$env_file" | cut -d= -f1)
        
        if [[ -z "$empty_vars" ]]; then
            echo "[$(date)] Empty value detection: PASS (no empty variables)" >> "$validation_log"
        else
            echo "[$(date)] Empty value detection: FAIL (empty variables: $empty_vars)" >> "$validation_log"
            return 1
        fi
        
        # Test 3: Format validation
        echo "[$(date)] Test 3: Format validation" >> "$validation_log"
        local format_errors=0
        
        while IFS= read -r line; do
            # Skip comments and empty lines
            if [[ "$line" =~ ^#.*$ ]] || [[ -z "$line" ]]; then
                continue
            fi
            
            # Check format: VARIABLE=value
            if [[ ! "$line" =~ ^[A-Z_][A-Z0-9_]*=.*$ ]]; then
                echo "  ✗ Invalid format: $line" >> "$validation_log"
                ((format_errors++))
            fi
        done < "$env_file"
        
        if [[ $format_errors -eq 0 ]]; then
            echo "[$(date)] Format validation: PASS" >> "$validation_log"
        else
            echo "[$(date)] Format validation: FAIL ($format_errors format errors)" >> "$validation_log"
            return 1
        fi
        
        # Test 4: Security validation (no plaintext secrets in logs)
        echo "[$(date)] Test 4: Security validation" >> "$validation_log"
        local security_issues=0
        
        # Check for common insecure patterns
        if grep -qi "password.*=.*password" "$env_file"; then
            echo "  ✗ Weak password detected" >> "$validation_log"
            ((security_issues++))
        fi
        
        if grep -qi "secret.*=.*secret" "$env_file"; then
            echo "  ✗ Weak secret detected" >> "$validation_log"
            ((security_issues++))
        fi
        
        if [[ $security_issues -eq 0 ]]; then
            echo "[$(date)] Security validation: PASS" >> "$validation_log"
        else
            echo "[$(date)] Security validation: WARNING ($security_issues potential issues)" >> "$validation_log"
        fi
        
        # Test 5: Integrity check (file not corrupted)
        echo "[$(date)] Test 5: Integrity check" >> "$validation_log"
        local file_size=$(wc -c < "$env_file")
        local line_count=$(wc -l < "$env_file")
        
        if [[ $file_size -gt 0 ]] && [[ $line_count -gt 0 ]]; then
            echo "[$(date)] Integrity check: PASS (size: ${file_size} bytes, lines: ${line_count})" >> "$validation_log"
        else
            echo "[$(date)] Integrity check: FAIL (corrupted or empty file)" >> "$validation_log"
            return 1
        fi
        
        echo "[$(date)] Environment validation completed successfully" >> "$validation_log"
        return 0
    }
    
    local validation_log="$TEST_DIR/logs/environment-validation.log"
    
    if validate_environment_integrity "$TEST_DIR/local/.env" "$validation_log"; then
        local pass_count=$(grep -c ": PASS" "$validation_log")
        print_test_pass "Environment variable validation and integrity passed all checks ($pass_count/5)"
    else
        local fail_count=$(grep -c ": FAIL" "$validation_log")
        print_test_fail "Environment variable validation failed $fail_count checks"
    fi
}

# Test secure cleanup and file deletion
test_secure_cleanup_procedures() {
    print_test_header "Testing secure cleanup and file deletion procedures"
    ((TESTS_RUN++))
    
    test_secure_cleanup() {
        local cleanup_log="$1"
        
        echo "=== Secure Cleanup Procedures Test ===" > "$cleanup_log"
        
        # Create temporary sensitive files
        local temp_files=(
            "$TEST_DIR/temp/.env.tmp"
            "$TEST_DIR/temp/.env.decrypted"
            "$TEST_DIR/temp/credentials.tmp"
            "$TEST_DIR/temp/secrets.txt"
        )
        
        mkdir -p "$TEST_DIR/temp"
        
        for file in "${temp_files[@]}"; do
            echo "SENSITIVE_DATA=secret_value_$(date +%s)" > "$file"
            chmod 600 "$file"
        done
        
        echo "[$(date)] Created ${#temp_files[@]} temporary sensitive files" >> "$cleanup_log"
        
        # Test secure deletion with shred
        echo "[$(date)] Testing secure deletion with shred" >> "$cleanup_log"
        local shred_success=0
        
        for file in "${temp_files[@]}"; do
            if [[ -f "$file" ]]; then
                if shred -vfz -n 3 "$file" >/dev/null 2>&1; then
                    if [[ ! -f "$file" ]]; then
                        echo "  ✓ Securely deleted: $(basename "$file")" >> "$cleanup_log"
                        ((shred_success++))
                    else
                        echo "  ✗ Failed to delete: $(basename "$file")" >> "$cleanup_log"
                    fi
                else
                    echo "  ✗ Shred failed for: $(basename "$file")" >> "$cleanup_log"
                fi
            fi
        done
        
        echo "[$(date)] Secure deletion results: $shred_success/${#temp_files[@]} files" >> "$cleanup_log"
        
        # Test cleanup of encryption artifacts
        echo "[$(date)] Testing cleanup of encryption artifacts" >> "$cleanup_log"
        
        # Create mock encryption artifacts
        local artifacts=(
            "$TEST_DIR/temp/salt.tmp"
            "$TEST_DIR/temp/key.tmp"
            "$TEST_DIR/temp/iv.tmp"
        )
        
        for artifact in "${artifacts[@]}"; do
            echo "encryption-artifact-data" > "$artifact"
        done
        
        # Cleanup artifacts
        local artifact_cleanup=0
        for artifact in "${artifacts[@]}"; do
            if rm -f "$artifact" 2>/dev/null; then
                ((artifact_cleanup++))
            fi
        done
        
        echo "[$(date)] Artifact cleanup: $artifact_cleanup/${#artifacts[@]} artifacts removed" >> "$cleanup_log"
        
        # Test memory cleanup (simulate)
        echo "[$(date)] Testing memory cleanup simulation" >> "$cleanup_log"
        
        # Simulate clearing sensitive variables from memory
        unset SENSITIVE_VAR TEST_SECRET TEMP_PASSWORD 2>/dev/null || true
        echo "[$(date)] Memory cleanup: Environment variables cleared" >> "$cleanup_log"
        
        # Overall assessment
        local total_expected=$((${#temp_files[@]} + ${#artifacts[@]}))
        local total_cleaned=$((shred_success + artifact_cleanup))
        
        if [[ $total_cleaned -eq $total_expected ]]; then
            echo "[$(date)] Secure cleanup: PASS (all files and artifacts cleaned)" >> "$cleanup_log"
            return 0
        else
            echo "[$(date)] Secure cleanup: FAIL (cleaned: $total_cleaned/$total_expected)" >> "$cleanup_log"
            return 1
        fi
    }
    
    local cleanup_log="$TEST_DIR/logs/secure-cleanup.log"
    
    if test_secure_cleanup "$cleanup_log"; then
        local cleaned_files=$(grep "Securely deleted:" "$cleanup_log" | wc -l)
        print_test_pass "Secure cleanup procedures successfully cleaned all sensitive files ($cleaned_files files)"
    else
        print_test_fail "Secure cleanup procedures failed to clean all sensitive files"
    fi
}

# Test environment variable rollback scenarios
test_environment_rollback_scenarios() {
    print_test_header "Testing environment variable rollback scenarios"
    ((TESTS_RUN++))
    
    test_environment_rollback() {
        local rollback_log="$1"
        
        echo "=== Environment Variable Rollback Scenarios ===" > "$rollback_log"
        
        # Scenario 1: Backup current environment state
        echo "[$(date)] Scenario 1: Backup current environment state" >> "$rollback_log"
        
        # Create current environment state
        export DATABASE_URL="postgresql://current@localhost/db"
        export API_KEY="current-api-key-123"
        export JWT_SECRET="current-jwt-secret"
        
        # Backup environment
        local backup_file="$TEST_DIR/temp/env-backup.txt"
        mkdir -p "$(dirname "$backup_file")"
        
        env | grep -E '^(DATABASE_URL|API_KEY|JWT_SECRET)=' > "$backup_file" 2>/dev/null
        
        if [[ -s "$backup_file" ]]; then
            echo "[$(date)] Environment backup: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Environment backup: FAIL" >> "$rollback_log"
            return 1
        fi
        
        # Scenario 2: Deploy new environment (simulate failure)
        echo "[$(date)] Scenario 2: Deploy new environment (simulate failure)" >> "$rollback_log"
        
        # Change environment variables (simulate new deployment)
        export DATABASE_URL="postgresql://new@localhost/db"
        export API_KEY="new-api-key-456"
        export JWT_SECRET="new-jwt-secret"
        
        # Simulate deployment failure
        echo "[$(date)] New environment deployment: FAILED (simulated)" >> "$rollback_log"
        
        # Scenario 3: Rollback to previous environment
        echo "[$(date)] Scenario 3: Rollback to previous environment" >> "$rollback_log"
        
        # Clear current environment
        unset DATABASE_URL API_KEY JWT_SECRET
        
        # Restore from backup
        if [[ -f "$backup_file" ]]; then
            set -a  # Export all variables
            source "$backup_file"
            set +a  # Stop exporting
            
            # Verify rollback
            if [[ "$DATABASE_URL" == "postgresql://current@localhost/db" ]] && \
               [[ "$API_KEY" == "current-api-key-123" ]] && \
               [[ "$JWT_SECRET" == "current-jwt-secret" ]]; then
                echo "[$(date)] Environment rollback: SUCCESS" >> "$rollback_log"
            else
                echo "[$(date)] Environment rollback: FAIL (verification failed)" >> "$rollback_log"
                return 1
            fi
        else
            echo "[$(date)] Environment rollback: FAIL (no backup file)" >> "$rollback_log"
            return 1
        fi
        
        # Scenario 4: Verify rollback integrity
        echo "[$(date)] Scenario 4: Verify rollback integrity" >> "$rollback_log"
        
        local rollback_vars=$(env | grep -E '^(DATABASE_URL|API_KEY|JWT_SECRET)=' | wc -l)
        
        if [[ $rollback_vars -eq 3 ]]; then
            echo "[$(date)] Rollback integrity: PASS (all variables restored)" >> "$rollback_log"
        else
            echo "[$(date)] Rollback integrity: FAIL (missing variables: $((3 - rollback_vars)))" >> "$rollback_log"
            return 1
        fi
        
        # Cleanup
        rm -f "$backup_file"
        unset DATABASE_URL API_KEY JWT_SECRET
        
        echo "[$(date)] Environment rollback scenarios completed successfully" >> "$rollback_log"
        return 0
    }
    
    local rollback_log="$TEST_DIR/logs/environment-rollback.log"
    
    if test_environment_rollback "$rollback_log"; then
        local success_count=$(grep -c "SUCCESS" "$rollback_log")
        print_test_pass "Environment variable rollback scenarios completed successfully ($success_count successes)"
    else
        local fail_count=$(grep -c "FAIL" "$rollback_log")
        print_test_fail "Environment variable rollback scenarios failed ($fail_count failures)"
    fi
}

# Run all secure environment deployment tests
run_all_secure_environment_tests() {
    print_test_header "Starting Secure Environment Deployment Integration Tests"
    
    setup_test_environment
    
    # Run individual secure environment test scenarios
    test_end_to_end_secure_deployment
    test_encryption_method_comparison
    test_sensitive_variable_masking
    test_environment_validation_integrity
    test_secure_cleanup_procedures
    test_environment_rollback_scenarios
    
    cleanup_test_environment
    
    # Print test summary
    print_test_header "Secure Environment Deployment Test Summary"
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        print_test_pass "All secure environment deployment tests passed!"
        exit 0
    else
        print_test_fail "$TESTS_FAILED secure environment deployment tests failed"
        exit 1
    fi
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_all_secure_environment_tests
fi