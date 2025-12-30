#!/bin/bash

# Auth0 Migration Rollback Script
# This script rolls back the Auth0 migration and restores the better-auth system

set -e  # Exit on any error

echo "Starting Auth0 migration rollback..."

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo "Error: This script must be run from the project root directory"
    exit 1
fi

# Confirm rollback
echo "WARNING: This will rollback all Auth0 migration changes and restore better-auth."
echo "This action cannot be undone without re-running the migration."
read -p "Are you sure you want to proceed? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

# 1. Backup current Auth0 configuration
echo "Backing up current Auth0 configuration..."
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"

cp .env "$BACKUP_DIR/.env.auth0.backup" 2>/dev/null || echo "No .env file to backup"
cp -r src/services/auth0.service.ts "$BACKUP_DIR/" 2>/dev/null || echo "No Auth0 service file to backup"
cp -r src/lib/auth/ "$BACKUP_DIR/auth0-lib/" 2>/dev/null || echo "No Auth0 lib files to backup"
cp -r src/middleware/auth.middleware.ts "$BACKUP_DIR/" 2>/dev/null || echo "No Auth0 auth middleware to backup"
cp -r src/middleware/rbac.middleware.ts "$BACKUP_DIR/" 2>/dev/null || echo "No Auth0 RBAC middleware to backup"

# 2. Restore better-auth files from git history
echo "Restoring better-auth files..."

# Restore authentication service
if git show HEAD~1:src/services/auth.service.ts >/dev/null 2>&1; then
    git checkout HEAD~1 -- src/services/auth.service.ts
    echo "Restored src/services/auth.service.ts"
else
    echo "Warning: Could not restore auth.service.ts from git history"
fi

# Restore authentication library files
if git show HEAD~1:src/lib/auth/ >/dev/null 2>&1; then
    # Remove current auth0 lib files
    rm -rf src/lib/auth/
    # Restore better-auth lib files
    git checkout HEAD~1 -- src/lib/auth/
    echo "Restored src/lib/auth/ directory"
else
    echo "Warning: Could not restore auth lib files from git history"
fi

# Restore middleware files
if git show HEAD~1:src/middleware/auth.middleware.ts >/dev/null 2>&1; then
    git checkout HEAD~1 -- src/middleware/auth.middleware.ts
    echo "Restored src/middleware/auth.middleware.ts"
else
    echo "Warning: Could not restore auth.middleware.ts from git history"
fi

if git show HEAD~1:src/middleware/rbac.middleware.ts >/dev/null 2>&1; then
    git checkout HEAD~1 -- src/middleware/rbac.middleware.ts
    echo "Restored src/middleware/rbac.middleware.ts"
else
    echo "Warning: Could not restore rbac.middleware.ts from git history"
fi

# 3. Update dependencies
echo "Updating dependencies..."
if command -v pnpm >/dev/null 2>&1; then
    pnpm remove auth0
    # Assuming better-auth was the previous auth solution
    pnpm add better-auth
    echo "Updated dependencies with pnpm"
elif command -v npm >/dev/null 2>&1; then
    npm uninstall auth0
    npm install better-auth
    echo "Updated dependencies with npm"
elif command -v yarn >/dev/null 2>&1; then
    yarn remove auth0
    yarn add better-auth
    echo "Updated dependencies with yarn"
else
    echo "Warning: No package manager found. Please manually update dependencies."
fi

# 4. Restore environment variables
echo "Restoring environment variables..."
# This would typically involve restoring the .env file from backup
# or removing Auth0-specific variables and adding better-auth variables
if [ -f "$BACKUP_DIR/.env.auth0.backup" ]; then
    # Create a backup of current .env
    cp .env .env.auth0.rollback.backup 2>/dev/null || echo "No current .env to backup"
    # Restore previous .env (this is a simplified approach)
    echo "Please manually restore your .env file with better-auth configuration"
    echo "Backup of current .env is at .env.auth0.rollback.backup"
else
    echo "Please manually update your .env file to remove Auth0 variables and restore better-auth variables"
fi

# 5. Clean up Auth0-specific files
echo "Cleaning up Auth0-specific files..."
rm -f src/services/auth0.service.ts
rm -rf src/lib/auth/auth0-*
rm -f scripts/migrate-users-to-auth0.js
rm -f scripts/create-jira-stories.js

# 6. Run tests to verify rollback
echo "Running tests to verify rollback..."
if command -v pnpm >/dev/null 2>&1; then
    pnpm test:auth 2>/dev/null || echo "Auth tests failed - please check manually"
elif command -v npm >/dev/null 2>&1; then
    npm run test:auth 2>/dev/null || echo "Auth tests failed - please check manually"
fi

echo "Rollback completed!"
echo "Please verify the following:"
echo "1. Authentication service is working correctly"
echo "2. User sign-in functionality is restored"
echo "3. Role-based access control is functioning"
echo "4. Environment variables are correctly configured for better-auth"
echo ""
echo "Backup of rolled back files is available in $BACKUP_DIR"