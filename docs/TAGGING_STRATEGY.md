# Tagging Strategy Documentation

This document outlines the comprehensive tagging strategy implemented for the Pixelated project. Our tagging system provides robust deployment tracking, rollback capabilities, and version management.

## Overview

Our tagging strategy uses multiple types of tags to track different aspects of the project lifecycle:

- **Production Tags**: Track production deployments
- **Staging Tags**: Track staging deployments  
- **Version Tags**: Semantic versioning releases
- **Hotfix Tags**: Emergency fixes
- **Rollback Tags**: Track rollback operations

## Tag Naming Conventions

### Production Tags
- **Format**: `production-YYYY-MM-DDTHH-MM-SS`
- **Example**: `production-2025-06-04T21-55-07`
- **Purpose**: Track production deployments with timestamps

Additional production tags created automatically:
- **Date-based**: `production-YYYY-MM-DD` (for easy rollback by date)
- **Version-based**: `production-vX.Y.Z` (semantic version)
- **Release tags**: `vX.Y.Z` (standard semver)

### Staging Tags
- **Format**: `staging-YYYY-MM-DDTHH-MM-SS`
- **Example**: `staging-2025-06-04T21-55-07`
- **Purpose**: Track staging deployments

### Version Tags
- **Format**: `vX.Y.Z` or `vX.Y.Z-prerelease`
- **Examples**: `v1.2.0`, `v1.2.1-rc.0`, `v2.0.0-beta.1`
- **Purpose**: Semantic versioning releases

### Hotfix Tags
- **Format**: `hotfix-X.Y.Z-YYYY-MM-DDTHH-MM-SS`
- **Example**: `hotfix-1.2.1-2025-06-04T21-55-07`
- **Purpose**: Track emergency fixes

### Rollback Tags
- **Format**: `rollback-{environment}-YYYY-MM-DDTHH-MM-SS`
- **Example**: `rollback-production-2025-06-04T21-55-07`
- **Purpose**: Track rollback operations

## Scripts and Tools

### 1. Tag Manager (`scripts/tag-manager.js`)

The main tool for creating and managing deployment tags.

#### Usage Examples:

```bash
# Create production tags
node scripts/tag-manager.js create production --message="Release v1.2.0" --push

# Create staging tags
node scripts/tag-manager.js create staging --push

# Create hotfix tags
node scripts/tag-manager.js hotfix 1.2.3 "Fix critical security issue" --push

# List tags
node scripts/tag-manager.js list production
node scripts/tag-manager.js list staging

# Validate rollback capability
node scripts/tag-manager.js validate production
node scripts/tag-manager.js validate staging

# Cleanup old tags (keep 10 most recent)
node scripts/tag-manager.js cleanup production 10
node scripts/tag-manager.js cleanup staging 5

# Push all tags to remote
node scripts/tag-manager.js push
```

#### NPM Scripts:
```bash
npm run tags:create production --push
npm run tags:list production
npm run tags:validate production
npm run tags:cleanup production
```

### 2. Version Manager (`scripts/version-manager.js`)

Handles semantic versioning and release management.

#### Usage Examples:

```bash
# Bump version types
node scripts/version-manager.js bump patch
node scripts/version-manager.js bump minor  
node scripts/version-manager.js bump major
node scripts/version-manager.js bump prerelease --prerelease="rc"

# Create releases (includes commit, tag, and push)
node scripts/version-manager.js release minor --message="New features added"
node scripts/version-manager.js release patch --message="Bug fixes"
node scripts/version-manager.js release prerelease --prerelease="beta"

# Get version info
node scripts/version-manager.js current
node scripts/version-manager.js info
```

#### NPM Scripts:
```bash
npm run version:bump minor
npm run version:release patch
npm run version:info
```

### 3. Enhanced Deployment (`scripts/enhanced-deploy.js`)

Improved deployment script with integrated tagging.

#### Usage Examples:

```bash
# Deploy with automatic tagging
node scripts/enhanced-deploy.js deploy staging
node scripts/enhanced-deploy.js deploy production --message="Production release"

# Rollback deployments
node scripts/enhanced-deploy.js rollback staging
node scripts/enhanced-deploy.js rollback production
```

#### NPM Scripts:
```bash
npm run deploy:enhanced           # Deploy to staging
npm run deploy:enhanced:prod      # Deploy to production
npm run rollback                  # Rollback staging
npm run rollback:prod            # Rollback production
```

### 4. Tag Maintenance (`scripts/tag-maintenance.js`)

Maintains tag health and consistency.

#### Usage Examples:

```bash
# Generate comprehensive tag report
node scripts/tag-maintenance.js report

# Validate tag structure
node scripts/tag-maintenance.js validate

# Sync with remote tags
node scripts/tag-maintenance.js sync

# Auto-fix common issues
node scripts/tag-maintenance.js autofix

# Cleanup old tags
node scripts/tag-maintenance.js cleanup production --keep=10
node scripts/tag-maintenance.js cleanup all --keep=5

# Run full maintenance
node scripts/tag-maintenance.js full-maintenance
```

#### NPM Scripts:
```bash
npm run tags:maintenance
```

## GitHub Actions Integration

### Production Deployment Workflow

The production deployment workflow (`deploy-production.yml`) automatically:

1. Creates comprehensive production tags
2. Deploys to production
3. Pushes tags to remote repository

### Staging Deployment Workflow

The staging deployment workflow (`deploy-staging.yml`) automatically:

1. Creates staging tags
2. Deploys to staging
3. Pushes tags to remote repository

### Rollback Workflow

The rollback workflow (`rollback.yml`) handles rollbacks with improved error handling:

1. Validates rollback capability
2. Creates initial tags if none exist
3. Performs rollback to previous deployment
4. Creates rollback tracking tags

## Best Practices

### 1. Production Deployments

Always use the enhanced deployment script for production:

```bash
# Recommended approach
npm run version:release minor --message="New feature release"
npm run deploy:enhanced:prod
```

This ensures:
- Proper semantic versioning
- Comprehensive tagging
- Deployment tracking
- Rollback capability

### 2. Staging Deployments

For staging deployments:

```bash
npm run deploy:enhanced
```

### 3. Hotfixes

For emergency fixes:

```bash
# Create hotfix
npm run version:bump patch
node scripts/tag-manager.js hotfix 1.2.3 "Critical security fix" --push
npm run deploy:enhanced:prod
```

### 4. Regular Maintenance

Run maintenance regularly to keep tags healthy:

```bash
# Weekly maintenance
npm run tags:maintenance

# Manual cleanup when needed
node scripts/tag-maintenance.js cleanup all --keep=20
```

## Rollback Procedures

### Automatic Rollback

Use the GitHub Actions rollback workflow or scripts:

```bash
# Script-based rollback
npm run rollback:prod
npm run rollback
```

### Manual Rollback

If you need to manually rollback:

```bash
# List available tags
npm run tags:list production

# Rollback to specific tag
git checkout production-2025-06-04T20-00-00
npm run build:prod
# Deploy manually
```

## Troubleshooting

### No Production Tags Found

If you encounter "No production tags found" error:

```bash
# Create initial tags
node scripts/tag-manager.js create production --message="Initial production tag" --push

# Or run auto-fix
node scripts/tag-maintenance.js autofix
```

### Tag Sync Issues

If tags are out of sync:

```bash
# Sync with remote
node scripts/tag-maintenance.js sync

# Or fetch tags manually
git fetch --tags --force
```

### Rollback Validation Failures

If rollback validation fails:

```bash
# Check what's wrong
npm run tags:validate production

# Generate detailed report
node scripts/tag-maintenance.js report

# Auto-fix common issues
node scripts/tag-maintenance.js autofix
```

## Migration from Old System

If you're migrating from an existing deployment system:

1. **Run initial setup**:
   ```bash
   npm run tags:maintenance
   ```

2. **Create initial tags for existing deployments**:
   ```bash
   node scripts/tag-manager.js create production --message="Migrated production tag"
   node scripts/tag-manager.js create staging --message="Migrated staging tag"
   ```

3. **Update deployment workflows** to use the new scripts

4. **Train team** on new tagging procedures

## Security Considerations

- Tags are immutable once pushed to remote
- Production tags should only be created from `main` branch
- Use signed tags for production releases:
  ```bash
  git config tag.gpgSign true
  ```

## Monitoring and Alerts

Consider setting up monitoring for:
- Failed deployments
- Missing tags
- Rollback operations
- Tag drift between environments

## Support

For issues with the tagging system:

1. Run diagnostic report: `node scripts/tag-maintenance.js report`
2. Check GitHub Actions logs
3. Review tag consistency: `npm run tags:validate production`
4. Run auto-fix: `node scripts/tag-maintenance.js autofix`

---

This tagging strategy provides robust deployment tracking and rollback capabilities. Regular use of the maintenance scripts will ensure the system remains healthy and reliable.
