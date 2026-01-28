# Auth0 Jira Issues Creation Script

This script automates the creation of Jira issues for the Auth0 migration project.

## Prerequisites

Make sure you have the following environment variables set:
- `JIRA_URL` - Your Jira instance URL (defaults to https://ratchetaf.atlassian.net)
- `JIRA_USERNAME` - Your Jira username/email
- `JIRA_API_TOKEN` - Your Jira API token

## Usage

```bash
# Run with default project key (PIX)
node create-auth0-jira-issues.js

# Run with specific project key
node create-auth0-jira-issues.js YOUR_PROJECT_KEY
```

## What it creates

1. One Epic (PIX-1247): "Migrate Authentication System from Better-Auth to Auth0"
2. Ten Stories (PIX-1248 through PIX-1257) covering all aspects of the migration:
   - Account setup and configuration
   - User migration planning and implementation
   - SDK integration
   - JWT token handling
   - Role-based access control
   - Social authentication
   - Middleware updates
   - Testing and validation
   - Deployment and monitoring

Each story includes detailed tasks and story points for planning purposes.