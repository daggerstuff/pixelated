import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackAlerter } from '../slack-alert';

describe('SlackAlerter', () => {
  const mockWebhookUrl = 'https://hooks.slack.com/services/TEST/BOT/TOKEN';
  const mockMessage = { text: 'Test alert message' };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send alert to Slack webhook', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
      }) as Promise<Response>
    );

    const alerter = new SlackAlerter(mockWebhookUrl);
    const result = await alerter.send(mockMessage);

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(mockWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockMessage),
    });
  });

  it('should return success false on webhook failure', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
      }) as Promise<Response>
    );

    const alerter = new SlackAlerter(mockWebhookUrl);
    const result = await alerter.send(mockMessage);

    expect(result.success).toBe(false);
  });

  it('should handle network errors gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const alerter = new SlackAlerter(mockWebhookUrl);
    const result = await alerter.send(mockMessage);

    expect(result.success).toBe(false);
  });
});
