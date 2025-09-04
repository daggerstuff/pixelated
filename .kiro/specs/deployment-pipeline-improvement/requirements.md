# Requirements Document

## Introduction

This specification outlines improvements to the existing rsync deployment script for Pixelated Empathy. The current script has several reliability and safety issues that need to be addressed to create a robust, pipeline-style deployment process with proper health checks, backup management, and rollback capabilities.

## Requirements

### Requirement 1: Node.js Environment Modernization

**User Story:** As a DevOps engineer, I want the deployment script to use the latest stable Node.js version (24.7.0) and pnpm (10.15.0), so that the deployment environment matches our development environment and benefits from the latest performance improvements.

#### Acceptance Criteria

1. WHEN the deployment script runs THEN it SHALL install and configure Node.js version 24.7.0
2. WHEN Node.js is installed THEN the script SHALL install pnpm version 10.15.0
3. WHEN version installation completes THEN the script SHALL verify both versions are correctly installed
4. IF version verification fails THEN the script SHALL terminate with a clear error message

### Requirement 2: Safe Pipeline-Style Deployment

**User Story:** As a system administrator, I want deployments to follow a safe pipeline approach with health checks and validation, so that failed deployments don't take down the running application.

#### Acceptance Criteria

1. WHEN a new deployment starts THEN the script SHALL keep the current running container active
2. WHEN the new container is built THEN the script SHALL perform comprehensive health checks
3. WHEN health checks pass THEN the script SHALL switch traffic to the new container
4. WHEN traffic switching completes THEN the script SHALL stop the old container
5. IF health checks fail THEN the script SHALL terminate the new container and keep the old one running
6. WHEN deployment fails THEN the script SHALL provide clear failure reasons and rollback instructions

### Requirement 3: Backup Management and Retention

**User Story:** As a system administrator, I want intelligent backup management that preserves working deployments until new ones are verified, so that I can quickly recover from failed deployments.

#### Acceptance Criteria

1. WHEN a deployment starts THEN the script SHALL preserve the current backup until the new deployment is verified
2. WHEN a new deployment is verified THEN the script SHALL archive the previous backup with a timestamp
3. WHEN backup archiving completes THEN the script SHALL maintain up to 3 previous backups
4. IF backup space is limited THEN the script SHALL remove the oldest backup after creating a new one
5. WHEN deployment fails THEN the script SHALL provide commands to restore from the most recent backup

### Requirement 4: Container Registry Integration

**User Story:** As a DevOps engineer, I want built container images pushed to our GitLab registry for backup and rollback purposes, so that I can quickly deploy previous versions if needed.

#### Acceptance Criteria

1. WHEN a container builds successfully THEN the script SHALL tag it with a timestamp and commit hash
2. WHEN container tagging completes THEN the script SHALL push the image to GitLab registry (https://git.pixelatedempathy.tech)
3. WHEN registry push completes THEN the script SHALL verify the image was uploaded successfully
4. IF registry push fails THEN the script SHALL continue with local deployment but log the failure
5. WHEN deployment completes THEN the script SHALL provide commands to pull and deploy previous registry images

### Requirement 5: Git Repository Synchronization

**User Story:** As a developer, I want the deployed code to maintain git history and enable git pull updates, so that I can make quick updates directly on the server when needed.

#### Acceptance Criteria

1. WHEN rsync runs THEN it SHALL include the .git directory in the synchronization
2. WHEN git sync completes THEN the script SHALL verify git status and remote configuration
3. WHEN git verification passes THEN the script SHALL provide instructions for git-based updates
4. IF git sync fails THEN the script SHALL continue with deployment but warn about missing git functionality
5. WHEN deployment completes THEN the final message SHALL include accurate git pull instructions

### Requirement 6: Comprehensive Health Check System

**User Story:** As a system administrator, I want thorough health checks that verify application functionality before switching traffic, so that users never experience downtime from broken deployments.

#### Acceptance Criteria

1. WHEN a new container starts THEN the script SHALL wait for the application to be ready (up to 60 seconds)
2. WHEN the application is ready THEN the script SHALL test the root endpoint for 200 status
3. WHEN basic health passes THEN the script SHALL test critical API endpoints
4. WHEN API tests pass THEN the script SHALL verify static asset serving
5. WHEN all health checks pass THEN the script SHALL log successful validation
6. IF any health check fails THEN the script SHALL log the specific failure and terminate the new container
7. WHEN health checks complete THEN the script SHALL provide a health check summary report

### Requirement 7: Rollback and Recovery Mechanisms

**User Story:** As a system administrator, I want clear rollback procedures and automated recovery options, so that I can quickly restore service if a deployment causes issues.

#### Acceptance Criteria

1. WHEN deployment fails THEN the script SHALL provide specific rollback commands
2. WHEN rollback commands are provided THEN they SHALL include both container and file system restoration
3. WHEN a rollback is needed THEN the script SHALL support rolling back to the previous backup
4. WHEN registry integration is available THEN rollback commands SHALL include pulling previous container images
5. IF multiple rollback options exist THEN the script SHALL prioritize them by speed and reliability

### Requirement 8: Secure Environment Variable Management

**User Story:** As a DevOps engineer, I want my local environment variables (including sensitive tokens and credentials) to be securely transferred and used on the VPS during deployment, so that registry authentication and other services work properly without exposing secrets.

#### Acceptance Criteria

1. WHEN deployment starts THEN the script SHALL securely encrypt the local .env file before transfer
2. WHEN environment files are transferred THEN they SHALL be encrypted using industry-standard encryption (GPG or OpenSSL)
3. WHEN environment variables are needed on VPS THEN they SHALL be decrypted and loaded securely
4. WHEN deployment completes THEN all temporary decrypted environment files SHALL be automatically cleaned up
5. WHEN environment variables are logged THEN sensitive values SHALL be masked or redacted
6. WHEN rollback occurs THEN environment variable state SHALL be restored to previous deployment
7. IF environment file transfer fails THEN deployment SHALL continue with warnings about missing authentication

### Requirement 9: Enhanced Logging and Monitoring

**User Story:** As a DevOps engineer, I want detailed logging throughout the deployment process, so that I can troubleshoot issues and monitor deployment performance.

#### Acceptance Criteria

1. WHEN deployment starts THEN the script SHALL log all major steps with timestamps
2. WHEN errors occur THEN the script SHALL log detailed error information and context
3. WHEN deployment completes THEN the script SHALL provide a deployment summary with timing information
4. WHEN health checks run THEN the script SHALL log each check result with response times
5. WHEN the script finishes THEN it SHALL create a deployment log file for future reference