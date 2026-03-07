---
title: "Disaster Recovery Plan"
description: "Disaster Recovery Plan documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Disaster Recovery Plan

## Overview

This document outlines the disaster recovery procedures for the Pixelated Astro application. It provides step-by-step instructions for recovering from various types of failures and outages.

## Quick Response Guide

### Site Down / Inaccessible

1. **Check Monitoring Alerts**

   - Review Slack alerts for specific error details
   - Check GitHub Actions monitoring workflow results

2. **Verify Deployment Status**

   - Check AWS CloudFormation stack status
   - Verify DNS resolution is working properly

3. **Initial Recovery Steps**
   - If the issue is with the latest deployment, initiate a rollback:
     ```bash
     # Trigger rollback workflow in GitHub Actions
     gh workflow run rollback.yml -f environment=production
     ```
   - If DNS issue, check domain registrar DNS settings

### Database Issues

1. **Check Database Connection**

   - Verify MongoDB Atlas status at [MongoDB Status](https://status.cloud.mongodb.com/)
   - Run health check against the API endpoint manually:
     ```bash
     curl -v https://app.gradiantastro.com/api/health
     ```

2. **Database Recovery Steps**

   - If database corruption is suspected, restore from the latest backup:

     ```bash
     # List available backups in MongoDB Atlas
     # Use Atlas CLI or web interface

     # Download the latest backup
     # mongorestore command for local restoration
     mongorestore --uri="mongodb+srv://username:password@cluster.mongodb.net/dbname" /path/to/backup

     # Or use Atlas automated backup restoration via web interface
     ```

### API Issues

1. **Check API Health**
   - Verify API routes are responding correctly:
     ```bash
     curl -v https://app.gradiantastro.com/api/health
     ```
2. **API Recovery Steps**
   - Check application logs for specific error details
   - Verify environment variables are correctly set
   - If necessary, redeploy the latest stable version

## Backup and Restore Procedures

### Database Backups

Backups are automatically created every 6 hours and stored in AWS S3. The backup workflow:

1. Creates a full PostgreSQL dump of the Supabase database
2. Compresses the backup file with gzip
3. Uploads to S3 with proper encryption
4. Maintains the last 20 backups with rotation

### Manual Backup Procedure

If an immediate backup is needed:

1. Trigger the backup workflow manually:

   ```bash
   gh workflow run backup.yml
   ```

2. Or create a manual backup:

   ```bash
   # Set environment variables
   export PGPASSWORD=[PASSWORD]
   export TIMESTAMP=$(date +%Y%m%d_%H%M%S)

   # Create backup
   pg_dump -h [HOST] -U [USER] -d [DATABASE] -F p > supabase_backup_${TIMESTAMP}.sql

   # Compress
   gzip supabase_backup_${TIMESTAMP}.sql

   # Upload to S3
   aws s3 cp supabase_backup_${TIMESTAMP}.sql.gz s3://[BACKUP_BUCKET]/database-backups/ --profile gradiant
   ```

### Restore Procedure

To restore a database from backup:

1. Identify the backup to restore:

   ```bash
   aws s3 ls s3://[BACKUP_BUCKET]/database-backups/ --profile gradiant
   ```

2. Download and restore:

   ```bash
   # Download
   aws s3 cp s3://[BACKUP_BUCKET]/database-backups/[BACKUP_FILENAME] ./ --profile gradiant

   # Decompress
   gunzip [BACKUP_FILENAME]

   # Restore
   PGPASSWORD=[PASSWORD] psql -h [HOST] -U [USER] -d [DATABASE] < [BACKUP_SQL_FILE]
   ```

## Deployment Rollback

### Automated Rollback

The system supports automated rollbacks through GitHub Actions:

1. Navigate to GitHub Actions tab in the repository
2. Select the "Rollback Deployment" workflow
3. Click "Run workflow"
4. Select environment (production or staging)
5. Optionally specify a specific deployment tag to roll back to
6. Click "Run workflow"

### Manual Rollback

If GitHub Actions is unavailable:

1. Check out the repository locally
2. View available deployment tags:

   ```bash
   git fetch --tags
   git tag -l "production-*" --sort=-committerdate
   ```

3. Check out the last stable deployment:

   ```bash
   git checkout [TAG_NAME]
   ```

4. Build and deploy manually:

   ```bash
   # Install dependencies
   pnpm install --no-frozen-lockfile

   # Build
   NODE_ENV=production pnpm build

   # Deploy using AWS CLI
   ./scripts/deploy-aws.sh
   ```

## Incident Response Protocol

### Severity Levels

- **Critical (P0)**: Complete service outage, data breach
- **Major (P1)**: Partial service outage, major feature unavailable
- **Minor (P2)**: Non-critical feature unavailable, performance degradation
- **Low (P3)**: Cosmetic issues, minor bugs

### Response Procedures

1. **Identification**

   - Determine severity level
   - Document initial findings
   - Notify appropriate team members

2. **Containment**

   - Implement immediate mitigation (e.g., rollback)
   - Isolate affected components
   - Prevent further damage

3. **Eradication**

   - Identify and fix the root cause
   - Deploy and test fixes
   - Verify security of all components

4. **Recovery**

   - Restore service to normal operation
   - Verify data integrity
   - Monitor for any recurring issues

5. **Post-Incident**
   - Conduct thorough analysis
   - Document lessons learned
   - Implement preventative measures

## Contact Information

### Primary Contacts

- **DevOps Lead**: [Name] - [Phone] - [Email]
- **Backend Lead**: [Name] - [Phone] - [Email]
- **Frontend Lead**: [Name] - [Phone] - [Email]
- **Security Lead**: [Name] - [Phone] - [Email]

### External Services

- **AWS Support**: [Support Center](https://console.aws.amazon.com/support)
- **Supabase Support**: [Support Portal](https://supabase.com/support)

## Emergency Access Procedures

### Emergency Access to Production

If emergency access to production is required:

1. Request temporary credentials from the DevOps lead
2. All emergency access is logged and audited
3. Credentials are revoked after the incident

### Break Glass Procedure

In case primary access methods are unavailable:

1. Contact the DevOps and Security leads
2. Use emergency credentials stored in the company password manager
3. All "break glass" access is logged, audited, and requires post-incident review

## Recovery Testing

The disaster recovery plan should be tested quarterly:

1. Schedule a disaster recovery drill
2. Simulate failures in controlled environments
3. Practice recovery procedures
4. Document results and improve procedures

## Appendices

### Required Credentials

- GitHub repository access
- AWS S3 access
- Database credentials
- AWS Console access

### Recovery Checklists

#### Site Outage Checklist

- [ ] Verify monitoring alerts
- [ ] Check deployment status
- [ ] Examine application logs
- [ ] Test API endpoints
- [ ] Check database connectivity
- [ ] Verify third-party integrations
- [ ] Test user authentication
- [ ] Initiate rollback if necessary

#### Database Recovery Checklist

- [ ] Identify corruption scope
- [ ] Select appropriate backup
- [ ] Verify backup integrity
- [ ] Restore to staging first if possible
- [ ] Verify restored data
- [ ] Update connection strings if necessary
- [ ] Monitor system after recovery

### Maintenance Window Procedures

For planned maintenance:

1. Schedule at least 48 hours in advance
2. Post notification to status page
3. Implement changes during low-traffic periods
4. Have rollback plan prepared
5. Verify all systems after maintenance
