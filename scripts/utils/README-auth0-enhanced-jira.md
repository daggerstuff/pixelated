# Enhanced Auth0 Jira Issues Creation Script

This script automates the creation of Jira issues for the Enhanced Auth0 migration project, including both the original migration and new enhancement features.

## Prerequisites

Make sure you have the following environment variables set:
- `JIRA_URL` - Your Jira instance URL (defaults to https://pixeldeck.atlassian.net)
- `JIRA_USERNAME` - Your Jira username/email
- `JIRA_API_TOKEN` - Your Jira API token

## Usage

```bash
# Run with default project key (PIX)
./create-auth0-enhanced-jira-issues.sh

# Run with specific project key
./create-auth0-enhanced-jira-issues.sh YOUR_PROJECT_KEY
```

## What it creates

1. One Epic (Enhanced Version): "Enhanced Auth0 Authentication System with Advanced Security and Usability Features"
2. Fifteen Stories covering all aspects of the enhanced migration:
   - Original migration stories (PIX-1248 through PIX-1257)
   - Enhancement stories (PIX-2001 through PIX-2015):
     - Consolidate authentication systems
     - Enhanced security features
     - Advanced user management
     - Analytics and monitoring
     - Streamlined authentication flows
     - Accessibility improvements
     - Modern UI design
     - Enhanced visual feedback
     - Advanced MFA implementation
     - User impersonation features
     - Data management and privacy
     - Real-time activity tracking
     - Comprehensive testing
     - Documentation and training
     - Deployment and monitoring

Each story includes detailed tasks and story points for planning purposes.