export interface SystemMetrics {
  activeUsers: number
  activeSessions: number
  sessionsToday: number
  totalTherapists: number
  totalClients: number
  messagesSent: number
  avgResponseTime: number
  systemLoad: number
  storageUsed: string
  activeSecurityLevel: 'maximum' | 'hipaa' | 'standard'
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  try {
    const response = await fetch('/api/admin/metrics')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error: unknown) {
    console.error('Error fetching system metrics:', error)
    throw error
  }
}
