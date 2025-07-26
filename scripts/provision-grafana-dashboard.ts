import axios from 'axios'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const { GRAFANA_URL, GRAFANA_API_KEY, GRAFANA_ORG_ID } = process.env

if (!GRAFANA_URL || !GRAFANA_API_KEY || !GRAFANA_ORG_ID) {
  console.error('Missing required environment variables')
  process.exit(1)
}

async function provisionDashboard() {
  try {
    const dashboardConfig = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'src/config/grafana-dashboards.json'),
        'utf-8',
      ),
    )

    const response = await axios.post(
      `${GRAFANA_URL}/api/dashboards/db`,
      {
        dashboard: dashboardConfig,
        overwrite: true,
        message: 'Dashboard updated via provisioning script',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GRAFANA_API_KEY}`,
        },
      },
    )

    if (response.status === 200) {
      console.log('Dashboard provisioned successfully!')
      console.log('Dashboard URL:', `${GRAFANA_URL}/d/${dashboardConfig.uid}`)
    } else {
      console.error('Failed to provision dashboard:', response.data)
    }
  } catch (error) {
    console.error('Error provisioning dashboard:', error.message)
    if (error.response) {
      console.error('Response data:', error.response.data)
    }
    process.exit(1)
  }
}

provisionDashboard()
