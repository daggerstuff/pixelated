# Slack Notifications Setup Guide

This guide will help you set up Slack notifications for the monitoring workflow.

## Prerequisites

- Admin access to your Slack workspace
- Admin access to your GitHub repository

## Step 1: Create a Slack App

1. Go to [Slack API: Your Apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Enter app name: "Pixelated Empathy Monitoring"
5. Select your workspace
6. Click "Create App"

## Step 2: Enable Incoming Webhooks

1. In your app settings, go to "Incoming Webhooks"
2. Toggle "Activate Incoming Webhooks" to **On**
3. Click "Add New Webhook to Workspace"
4. Select the channel where you want notifications (e.g., #alerts, #monitoring)
5. Click "Allow"
6. Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)

## Step 3: Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `SLACK_WEBHOOK`
5. Value: Paste the webhook URL from Step 2
6. Click "Add secret"

## Step 4: Test the Setup

You can test the webhook by running the monitoring workflow manually:

1. Go to Actions tab in your repository
2. Select "Monitoring" workflow
3. Click "Run workflow"
4. Select the branch and click "Run workflow"

If configured correctly, you should receive a Slack notification if any tests fail.

## Alternative: Use Slack Bot Token (Advanced)

If you prefer more control over the messages, you can use a bot token instead:

1. In your Slack app, go to "OAuth & Permissions"
2. Add these Bot Token Scopes:
   - `chat:write`
   - `chat:write.public`
3. Install the app to your workspace
4. Copy the "Bot User OAuth Token"
5. In GitHub secrets, create:
   - `SLACK_BOT_TOKEN`: Your bot token
   - `SLACK_CHANNEL`: Channel ID (e.g., `C1234567890`)

Then update the workflow to use `slackapi/slack-github-action@v1.25.0` with:
```yaml
env:
  SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
with:
  channel-id: ${{ secrets.SLACK_CHANNEL }}
  payload: |
    {
      "text": "Your notification message"
    }
```

## Troubleshooting

### Error: invalid_token (403)
- Check that `SLACK_WEBHOOK` secret is correctly set
- Verify the webhook URL is complete and starts with `https://hooks.slack.com/services/`
- Ensure the Slack app has not been revoked or deleted

### Error: channel_not_found
- Verify the webhook is configured for an accessible channel
- Check that the Slack app is installed in your workspace

### No notifications received
- Check the GitHub Actions logs for any error messages
- Verify the workflow conditions are met (e.g., failures are occurring)
- Test the webhook URL directly using curl:
  ```bash
  curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"Test message"}' \
    YOUR_WEBHOOK_URL
  ```

## Security Notes

- Keep your webhook URL secret - it allows posting to your Slack channel
- Use GitHub secrets to store the webhook URL, never commit it to code
- Consider rotating the webhook URL periodically
- Monitor your Slack app's usage in the Slack API dashboard
