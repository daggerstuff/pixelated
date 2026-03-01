import {
  Shield,
  Activity,
  Users,
  Server,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Download,
  Clock,
  Lock,
} from 'lucide-react'
import { useState, useEffect } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface SystemMetrics {
  uptime: number
  totalRequests: number
  activeUsers: number
  errorRate: number
  averageResponseTime: number
  databaseConnections: number
  cacheHitRate: number
  memoryUsage: number
  cpuUsage: number
}

interface SecurityMetrics {
  authenticationAttempts: number
  failedLogins: number
  blockedIPs: string[]
  securityAlerts: Array<{
    id: string
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    message: string
    timestamp: number
  }>
  lastSecurityScan: number
  vulnerabilities: number
}

interface UserAnalytics {
  totalUsers: number
  activeToday: number
  activeThisWeek: number
  activeThisMonth: number
  newRegistrations: number
  userRetention: number
  averageSessionDuration: number
  mostUsedFeatures: Array<{
    feature: string
    usage: number
  }>
}

interface APIHealth {
  endpoints: Array<{
    name: string
    url: string
    status: 'healthy' | 'degraded' | 'down'
    responseTime: number
    successRate: number
    lastCheck: number
    errors: Array<{
      timestamp: number
      error: string
      count: number
    }>
  }>
  totalRequests: number
  successfulRequests: number
  failedRequests: number
}

export default function EnterpriseAdminDashboard() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)
  const [securityMetrics, setSecurityMetrics] =
    useState<SecurityMetrics | null>(null)
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null)
  const [apiHealth, setApiHealth] = useState<APIHealth | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Initialize demo data
  useEffect(() => {
    const loadDashboardData = () => {
      const metrics: SystemMetrics = {
        uptime: 99.97,
        totalRequests: 2847293,
        activeUsers: 1247,
        errorRate: 0.12,
        averageResponseTime: 234,
        databaseConnections: 23,
        cacheHitRate: 94.7,
        memoryUsage: 67.3,
        cpuUsage: 23.8,
      }

      const security: SecurityMetrics = {
        authenticationAttempts: 45723,
        failedLogins: 127,
        blockedIPs: ['192.168.1.100', '10.0.0.45', '172.16.0.33'],
        securityAlerts: [
          {
            id: '1',
            type: 'Unusual Login Pattern',
            severity: 'medium',
            message: 'Multiple login attempts from new location detected',
            timestamp: Date.now() - 3600000,
          },
          {
            id: '2',
            type: 'Rate Limiting Triggered',
            severity: 'low',
            message: 'API rate limit exceeded for user session',
            timestamp: Date.now() - 7200000,
          },
        ],
        lastSecurityScan: Date.now() - 86400000,
        vulnerabilities: 0,
      }

      const users: UserAnalytics = {
        totalUsers: 28456,
        activeToday: 1834,
        activeThisWeek: 8921,
        activeThisMonth: 18234,
        newRegistrations: 67,
        userRetention: 89.3,
        averageSessionDuration: 23.4,
        mostUsedFeatures: [
          { feature: 'Crisis Detection', usage: 89.2 },
          { feature: 'Chat Analysis', usage: 76.8 },
          { feature: 'Knowledge Parsing', usage: 65.3 },
          { feature: 'Therapy Scenarios', usage: 58.7 },
          { feature: 'Risk Assessment', usage: 45.9 },
        ],
      }

      const api: APIHealth = {
        endpoints: [
          {
            name: 'Psychology Parse',
            url: '/api/psychology/parse',
            status: 'healthy',
            responseTime: 187,
            successRate: 99.8,
            lastCheck: Date.now(),
            errors: [],
          },
          {
            name: 'Crisis Detection',
            url: '/api/mental-health/crisis-detection',
            status: 'healthy',
            responseTime: 423,
            successRate: 99.7,
            lastCheck: Date.now(),
            errors: [],
          },
          {
            name: 'Chat API',
            url: '/api/mental-health/chat',
            status: 'healthy',
            responseTime: 256,
            successRate: 99.9,
            lastCheck: Date.now(),
            errors: [],
          },
          {
            name: 'Scenario Generation',
            url: '/api/psychology/generate-scenario',
            status: 'degraded',
            responseTime: 892,
            successRate: 98.2,
            lastCheck: Date.now(),
            errors: [
              {
                timestamp: Date.now() - 1800000,
                error: 'Timeout on AI model request',
                count: 3,
              },
            ],
          },
        ],
        totalRequests: 2847293,
        successfulRequests: 2844156,
        failedRequests: 3137,
      }

      setSystemMetrics(metrics)
      setSecurityMetrics(security)
      setUserAnalytics(users)
      setApiHealth(api)
      setIsLoading(false)
      setLastRefresh(new Date())
    }

    loadDashboardData()

    // Auto-refresh every 30 seconds if enabled
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadDashboardData()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'down':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const exportMetrics = () => {
    const exportData = {
      systemMetrics,
      securityMetrics,
      userAnalytics,
      apiHealth,
      timestamp: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin-metrics-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='text-center'>
          <div className='border-blue-600 border-t-transparent mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4'></div>
          <p className='text-gray-600'>Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-7xl space-y-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-gray-900 text-3xl font-bold'>
            Enterprise Admin Dashboard
          </h1>
          <p className='text-gray-600 mt-1'>
            Comprehensive system monitoring and analytics • Last updated:{' '}
            {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`}
            />
            Auto Refresh
          </Button>
          <Button variant='outline' size='sm' onClick={exportMetrics}>
            <Download className='mr-2 h-4 w-4' />
            Export
          </Button>
          <Badge
            variant='outline'
            className='bg-green-50 text-green-700 border-green-200'
          >
            <Shield className='mr-2 h-4 w-4' />
            System Healthy
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center gap-3'>
              <div className='bg-green-100 rounded-lg p-2'>
                <Activity className='text-green-600 h-5 w-5' />
              </div>
              <div>
                <p className='text-gray-600 text-sm'>System Uptime</p>
                <p className='text-2xl font-bold'>{systemMetrics?.uptime}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center gap-3'>
              <div className='bg-blue-100 rounded-lg p-2'>
                <Users className='text-blue-600 h-5 w-5' />
              </div>
              <div>
                <p className='text-gray-600 text-sm'>Active Users</p>
                <p className='text-2xl font-bold'>
                  {systemMetrics?.activeUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center gap-3'>
              <div className='bg-purple-100 rounded-lg p-2'>
                <BarChart3 className='text-purple-600 h-5 w-5' />
              </div>
              <div>
                <p className='text-gray-600 text-sm'>Total Requests</p>
                <p className='text-2xl font-bold'>
                  {systemMetrics?.totalRequests.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center gap-3'>
              <div className='bg-yellow-100 rounded-lg p-2'>
                <Clock className='text-yellow-600 h-5 w-5' />
              </div>
              <div>
                <p className='text-gray-600 text-sm'>Avg Response</p>
                <p className='text-2xl font-bold'>
                  {systemMetrics?.averageResponseTime}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue='system' className='w-full'>
        <TabsList className='grid w-full grid-cols-4'>
          <TabsTrigger value='system'>
            <Server className='mr-2 h-4 w-4' />
            System Health
          </TabsTrigger>
          <TabsTrigger value='security'>
            <Shield className='mr-2 h-4 w-4' />
            Security
          </TabsTrigger>
          <TabsTrigger value='users'>
            <Users className='mr-2 h-4 w-4' />
            User Analytics
          </TabsTrigger>
          <TabsTrigger value='api'>
            <Zap className='mr-2 h-4 w-4' />
            API Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value='system' className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Server className='h-5 w-5' />
                  Infrastructure Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-gray-600 text-sm'>CPU Usage</span>
                    <span className='font-medium'>
                      {systemMetrics?.cpuUsage}%
                    </span>
                  </div>
                  <Progress value={systemMetrics?.cpuUsage} className='h-2' />
                </div>

                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-gray-600 text-sm'>Memory Usage</span>
                    <span className='font-medium'>
                      {systemMetrics?.memoryUsage}%
                    </span>
                  </div>
                  <Progress
                    value={systemMetrics?.memoryUsage}
                    className='h-2'
                  />
                </div>

                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-gray-600 text-sm'>
                      Cache Hit Rate
                    </span>
                    <span className='font-medium'>
                      {systemMetrics?.cacheHitRate}%
                    </span>
                  </div>
                  <Progress
                    value={systemMetrics?.cacheHitRate}
                    className='h-2'
                  />
                </div>

                <div className='flex items-center justify-between border-t pt-2'>
                  <span className='text-gray-600 text-sm'>
                    Database Connections
                  </span>
                  <span className='font-medium'>
                    {systemMetrics?.databaseConnections}/100
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <TrendingUp className='h-5 w-5' />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>Error Rate</span>
                  <Badge
                    variant='outline'
                    className={
                      systemMetrics && systemMetrics.errorRate < 1
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }
                  >
                    {systemMetrics?.errorRate}%
                  </Badge>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>
                    Average Response Time
                  </span>
                  <span className='font-medium'>
                    {systemMetrics?.averageResponseTime}ms
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>Uptime</span>
                  <Badge
                    variant='outline'
                    className='bg-green-50 text-green-700 border-green-200'
                  >
                    <CheckCircle className='mr-1 h-3 w-3' />
                    {systemMetrics?.uptime}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value='security' className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Lock className='h-5 w-5' />
                  Authentication & Access
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>
                    Total Auth Attempts
                  </span>
                  <span className='font-medium'>
                    {securityMetrics?.authenticationAttempts.toLocaleString()}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>Failed Logins</span>
                  <Badge
                    variant='outline'
                    className={
                      securityMetrics && securityMetrics.failedLogins < 200
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                    }
                  >
                    {securityMetrics?.failedLogins}
                  </Badge>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>Blocked IPs</span>
                  <span className='font-medium'>
                    {securityMetrics?.blockedIPs.length}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>Vulnerabilities</span>
                  <Badge
                    variant='outline'
                    className='bg-green-50 text-green-700 border-green-200'
                  >
                    {securityMetrics?.vulnerabilities}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <AlertTriangle className='h-5 w-5' />
                  Security Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='max-h-60 space-y-3 overflow-y-auto'>
                  {securityMetrics?.securityAlerts.map((alert) => (
                    <div key={alert.id} className='rounded-lg border p-3'>
                      <div className='mb-2 flex items-center justify-between'>
                        <Badge
                          variant='outline'
                          className={getSeverityColor(alert.severity)}
                        >
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <span className='text-gray-500 text-xs'>
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className='text-sm font-medium'>{alert.type}</p>
                      <p className='text-gray-600 mt-1 text-xs'>
                        {alert.message}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value='users' className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Users className='h-5 w-5' />
                  User Engagement
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>Total Users</span>
                  <span className='font-medium'>
                    {userAnalytics?.totalUsers.toLocaleString()}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>Active Today</span>
                  <span className='font-medium'>
                    {userAnalytics?.activeToday.toLocaleString()}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>
                    Active This Week
                  </span>
                  <span className='font-medium'>
                    {userAnalytics?.activeThisWeek.toLocaleString()}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>
                    New Registrations
                  </span>
                  <span className='font-medium'>
                    {userAnalytics?.newRegistrations}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-600 text-sm'>Retention Rate</span>
                  <Badge
                    variant='outline'
                    className='bg-green-50 text-green-700 border-green-200'
                  >
                    {userAnalytics?.userRetention}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <BarChart3 className='h-5 w-5' />
                  Feature Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {userAnalytics?.mostUsedFeatures.map((feature) => (
                    <div key={feature.feature} className='space-y-2'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-gray-600'>{feature.feature}</span>
                        <span className='font-medium'>{feature.usage}%</span>
                      </div>
                      <Progress value={feature.usage} className='h-2' />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value='api' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Zap className='h-5 w-5' />
                API Endpoint Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {apiHealth?.endpoints.map((endpoint) => (
                  <div
                    key={endpoint.name + endpoint.url}
                    className='flex items-center justify-between rounded-lg border p-4'
                  >
                    <div className='flex items-center gap-3'>
                      <Badge
                        variant='outline'
                        className={getStatusColor(endpoint.status)}
                      >
                        {endpoint.status === 'healthy' && (
                          <CheckCircle className='mr-1 h-3 w-3' />
                        )}
                        {endpoint.status === 'degraded' && (
                          <AlertTriangle className='mr-1 h-3 w-3' />
                        )}
                        {endpoint.status === 'down' && (
                          <AlertTriangle className='mr-1 h-3 w-3' />
                        )}
                        {endpoint.status}
                      </Badge>
                      <div>
                        <h4 className='font-medium'>{endpoint.name}</h4>
                        <p className='text-gray-500 text-sm'>{endpoint.url}</p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <div className='text-sm font-medium'>
                        {endpoint.responseTime}ms
                      </div>
                      <div className='text-gray-500 text-xs'>
                        {endpoint.successRate}% success
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
            <Card>
              <CardContent className='p-6'>
                <div className='flex items-center gap-3'>
                  <div className='bg-blue-100 rounded-lg p-2'>
                    <BarChart3 className='text-blue-600 h-5 w-5' />
                  </div>
                  <div>
                    <p className='text-gray-600 text-sm'>Total Requests</p>
                    <p className='text-2xl font-bold'>
                      {apiHealth?.totalRequests.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-6'>
                <div className='flex items-center gap-3'>
                  <div className='bg-green-100 rounded-lg p-2'>
                    <CheckCircle className='text-green-600 h-5 w-5' />
                  </div>
                  <div>
                    <p className='text-gray-600 text-sm'>Successful</p>
                    <p className='text-2xl font-bold'>
                      {apiHealth?.successfulRequests.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-6'>
                <div className='flex items-center gap-3'>
                  <div className='bg-red-100 rounded-lg p-2'>
                    <AlertTriangle className='text-red-600 h-5 w-5' />
                  </div>
                  <div>
                    <p className='text-gray-600 text-sm'>Failed</p>
                    <p className='text-2xl font-bold'>
                      {apiHealth?.failedRequests.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
