const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 9093;

app.use(express.json());

// Slack webhook URL from environment
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Webhook endpoint for Prometheus alerts
app.post('/webhook', async (req, res) => {
  try {
    const alerts = req.body.alerts || [];
    
    for (const alert of alerts) {
      const message = {
        text: `🚨 Alert: ${alert.annotations?.summary || alert.labels?.alertname}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${alert.status === 'firing' ? '🚨 FIRING' : '✅ RESOLVED'}*: ${alert.annotations?.summary || alert.labels?.alertname}\n\n*Description:* ${alert.annotations?.description || 'No description'}\n*Instance:* ${alert.labels?.instance || 'Unknown'}\n*Job:* ${alert.labels?.job || 'Unknown'}\n*Severity:* ${alert.labels?.severity || 'Unknown'}`
            }
          }
        ]
      };

      if (SLACK_WEBHOOK) {
        await axios.post(SLACK_WEBHOOK, message);
        console.log(`Alert sent to Slack: ${alert.labels?.alertname}`);
      } else {
        console.log('Alert received but no Slack webhook configured:', alert.labels?.alertname);
      }
    }
    
    res.json({ status: 'ok', processed: alerts.length });
  } catch (error) {
    console.error('Error processing alert:', error);
    res.status(500).json({ error: 'Failed to process alert' });
  }
});

app.listen(PORT, () => {
  console.log(`Alert receiver running on port ${PORT}`);
  console.log('Webhook endpoint: /webhook');
  console.log('Health check: /health');
});
