# Security Breach Notification System

This system provides real-time notification capabilities for security breaches, compliant with HIPAA requirements and security best practices.

## Setup

1. **Environment Variables**

   Copy `.env.example` to `.env` and configure the following variables:

   ```
   # Organization Details
   ORGANIZATION_NAME="Your Organization Name"
   SECURITY_CONTACT="security@yourdomain.com"
   ORGANIZATION_ADDRESS="Your Address"

   # Security Notifications
   HHS_NOTIFICATION_EMAIL="notifications@hhs.gov"
   SECURITY_STAKEHOLDERS="admin@yourdomain.com,security@yourdomain.com"
   SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR_SLACK_WEBHOOK_URL"
   ```

2. **Slack Webhook Setup**

   a. Go to your Slack workspace and create a new app (or use an existing one):
      - Visit https://api.slack.com/apps
      - Click "Create New App" → "From scratch"
      - Name it "Security Breach Alerts" and select your workspace

   b. Enable Incoming Webhooks:
      - In the app settings, go to "Incoming Webhooks"
      - Turn on "Activate Incoming Webhooks"
      - Click "Add New Webhook to Workspace"
      - Select the channel for security alerts (create a private #security-alerts channel if needed)
      - Copy the webhook URL and add it to your .env file as SLACK_WEBHOOK

   c. Customize the app (optional):
      - Set an app icon and description
      - Add the app to your #security-alerts channel

## Usage

### Using the CLI Tools

The system comes with command-line tools to manage breach notifications:

```bash
# Run a test breach notification (doesn't trigger real alerts except for Slack in high/critical severity)
pnpm security:breach-test
pnpm security:breach-test --type data_leak --severity high --users 10

# Report a real breach (USE WITH CAUTION - triggers actual notifications)
pnpm security:breach-report
pnpm security:breach-report --type unauthorized_access --severity high --users user1,user2 --affected-data "PHI,credentials"

# List recent breaches
pnpm security:breach-list
pnpm security:breach-list --limit 5

# Check status of a specific breach
pnpm security:breach-status BREACH_ID
```

### Programmatic Usage

#### Reporting a Breach

```typescript
import { BreachNotificationSystem } from '@/lib/security/breach-notification'

// Report a security breach
const breachId = await BreachNotificationSystem.reportBreach({
  type: 'unauthorized_access', // 'unauthorized_access', 'data_leak', 'system_compromise', 'other'
  severity: 'high', // 'low', 'medium', 'high', 'critical'
  description: 'Detailed description of what happened',
  affectedUsers: ['user1', 'user2', 'user3'], // User IDs of affected users
  affectedData: ['PII', 'PHI', 'credentials'], // Types of affected data
  detectionMethod: 'Automated system monitoring',
  remediation: 'Accounts locked, passwords reset, logs analyzed',
})

console.log(`Breach reported with ID: ${breachId}`)
```

#### Checking Breach Status

```typescript
const breachStatus = await BreachNotificationSystem.getBreachStatus(breachId)
console.log('Current status:', breachStatus.notificationStatus)
```

#### Listing Recent Breaches

```typescript
const recentBreaches = await BreachNotificationSystem.listRecentBreaches()
console.log(`Found ${recentBreaches.length} recent breaches`)
```

#### Running a Test Scenario

```typescript
// Test the notification system without creating a real breach
const testBreachId = await BreachNotificationSystem.runTestScenario({
  type: 'data_leak',
  severity: 'medium',
  affectedUsers: 5, // Number of test users to generate
})
```

## Slack Notification Format

The system sends rich, formatted Slack notifications with the following elements:

1. **Header** - Shows severity level with appropriate icons:
   - Critical: 🚨 RED alert
   - High: ⚠️ Orange alert
   - Medium: ⚠️ Yellow alert
   - Low: 📝 Green alert

2. **Key Information** - Organized in a grid:
   - ID
   - Type
   - Severity
   - Time
   - Affected Users
   - Detection Method

3. **Detailed Sections**:
   - Description
   - Affected Data
   - Remediation Steps

4. **HIPAA Compliance Notice** - Legal reminder of handling requirements

5. **Action Button** - Links to breach management dashboard

6. **Organization Context** - Organization name and security contact

## Notification Flow

1. When a breach is reported:
   - Critical and high severity breaches trigger immediate Slack notifications
   - All affected users receive email notifications
   - Internal stakeholders (specified in SECURITY_STAKEHOLDERS) are notified
   - For breaches affecting 500+ users or marked as critical, authorities are notified (HHS)

2. The system tracks:
   - Notification status (pending, in-progress, completed)
   - Delivery effectiveness
   - Resolution time
   - Historical breach data (retained for 6 years for HIPAA compliance)

## Security Considerations

- All breach data is stored in Redis with appropriate TTL (Time To Live)
- Sensitive breach details are encrypted using FHE (Fully Homomorphic Encryption)
- Notification logs are maintained for compliance purposes
- The system is designed to be fault-tolerant, with appropriate error handling
- Slack notifications include compliance notices and follow secure formatting practices

## Compliance Information

This system adheres to HIPAA Breach Notification Rule requirements:
- Notification within 60 days for breaches affecting 500+ individuals
- Annual reporting of smaller breaches
- Proper documentation of all notification efforts
- Retention of records for at least 6 years 

## Troubleshooting

If Slack notifications aren't working:

1. Verify your `SLACK_WEBHOOK` environment variable is correctly set
2. Ensure the Slack app has proper permissions for the channel
3. Check network connectivity to Slack's API endpoints
4. Examine logs for specific error messages
5. Try running a test with `pnpm security:breach-test --severity high` to test the notification pipeline 