// Slack events channel for the pipeline orchestrator.
// Posts Agent Activities on every state transition and renders each
// approval gate as a Slack block with approve/hold/rollback buttons.

import { slackChannel } from 'eve/channels/slack'

export default slackChannel({
  credentials: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  },
})
