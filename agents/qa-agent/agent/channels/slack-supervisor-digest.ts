// Slack digest channel for the QA agent. Posts the daily supervisor
// digest into the program's `qa-digest` Slack channel and handles ack
// button clicks back into the QA agent's input requests.

import { slackChannel } from 'eve/channels/slack'

export default slackChannel({
  credentials: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  },
})
