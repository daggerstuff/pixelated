/**
 * SlackAlerter - Sends alerts to Slack webhooks
 */
export interface SlackMessage {
  text?: string
  blocks?: Array<{
    type: string
    text?: {
      type: string
      text: string
    }
  }>
  [key: string]: unknown
}

export interface SlackAlertResult {
  success: boolean
}

export class SlackAlerter {
  private webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  async send(message: SlackMessage): Promise<SlackAlertResult> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })

      return { success: response.ok }
    } catch {
      return { success: false }
    }
  }
}
