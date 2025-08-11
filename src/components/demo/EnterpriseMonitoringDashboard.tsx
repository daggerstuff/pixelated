import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Zap,
  Brain,
  Heart,
  BarChart3,
  PieChart
} from 'lucide-react'

interface PerformanceMetric {
  id: string
  name: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  status: 'good' | 'warning' | 'critical'
  threshold: number
  history: Array<{ timestamp: number; value: number }>
}

interface SystemHealth {
  apis: Array<{
    name: string
    endpoint: string
    status: 'online' | 'degraded' | 'offline'
    responseTime: number
    successRate: number
    lastCheck: number
  }>
  database: {
    status: 'online' | 'degraded' | 'offline'
    responseTime: number
    connections: number
    maxConnections: number
  }
  cache: {
    status: 'online' | 'offline'
    hitRate: number
    memory: number
    maxMemory: number
  }
}

interface UsageAnalytics {
  totalSessions: number
  activeSessions: number
  averageSessionDuration: number
  crisisInterventions: number
  successfulInterventions: number
  userSatisfaction: number
  peakUsageTime: string
  dailyActiveUsers: number
  weeklyActiveUsers: number
  monthlyActiveUsers: number
}

export default function EnterpriseMonitoringDashboard() {
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Initialize demo data
  useEffect(() => {
    const initializeData = () => {
      const metrics: PerformanceMetric[] = [
        {
          id: 'response_time',
          name: 'Average Response Time',
          value: 234,
          unit: 'ms',
          trend: 'down',
          status: 'good',
          threshold: 500,
          history: generateTimeSeriesData(50, 200, 300)
        },
        {
          id: 'accuracy',
          name: 'Crisis Detection Accuracy',
          value: 94.7,
          unit: '%',
          trend: 'up',
          status: 'good',
          threshold: 90,
          history: generateTimeSeriesData(50, 92, 96)
        },
        {
          id: 'throughput',
          name: 'Requests per Minute',
          value: 1247,
          unit: 'req/min',
          trend: 'up',
          status: 'good',
          threshold: 1000,
          history: generateTimeSeriesData(50, 800, 1400)
        },
        {
          id: 'error_rate',
          name: 'Error Rate',
          value: 0.3,
          unit: '%',
          trend: 'down',
          status: 'good',
          threshold: 1,
          history: generateTimeSeriesData(50, 0.1, 0.8)
        },
        {
          id: 'intervention_success',
          name: 'Intervention Success Rate',
          value: 89.2,
          unit: '%',
          trend: 'stable',
          status: 'good',
          threshold: 85,
          history: generateTimeSeriesData(50, 87, 92)
        },
        {
          id: 'user_satisfaction',
          name: 'User Satisfaction',
          value: 4.6,
          unit: '/5',
          trend: 'up',
          status: 'good',
          threshold: 4,
          history: generateTimeSeriesData(50, 4.2, 4.8)
        }
      ]

      const health: SystemHealth = {
        apis: [
          {
            name: 'Psychology Parse API',
            endpoint: '/api/psychology/parse',
            status: 'online',
            responseTime: 187,
            successRate: 99.8,
            lastCheck: Date.now()
          },
          {
            name: 'Scenario Generation API',
            endpoint: '/api/psychology/generate-scenario',
            status: 'online',
            responseTime: 312,
            successRate: 99.2,
            lastCheck: Date.now()
          },
          {
            name: 'Mental Health Chat API',
            endpoint: '/api/mental-health/chat',
            status: 'online',
            responseTime: 256,
            successRate: 99.9,
            lastCheck: Date.now()
          },
          {
            name: 'Crisis Detection API',
            endpoint: '/api/mental-health/crisis-detection',
            status: 'online',
            responseTime: 423,
            successRate: 99.7,
            lastCheck: Date.now()
          },
          {
            name: 'Frameworks API',
            endpoint: '/api/psychology/frameworks',
            status: 'online',
            responseTime: 89,
            successRate: 99.9,
            lastCheck: Date.now()
          },
          {
            name: 'Clinical Analysis API',
            endpoint: '/api/psychology/analyze',
            status: 'online',
            responseTime: 445,
            successRate: 99.5,
            lastCheck: Date.now()
          }
        ],
        database: {
          status: 'online',
          responseTime: 23,
          connections: 12,
          maxConnections: 100
        },
        cache: {
          status: 'online',
          hitRate: 94.3,
          memory: 2.1,
          maxMemory: 8
        }
      }

      const analytics: UsageAnalytics = {
        totalSessions: 15247,
        activeSessions: 127,
        averageSessionDuration: 23.4,
        crisisInterventions: 342,
        successfulInterventions: 305,
        userSatisfaction: 4.6,
        peakUsageTime: '14:00-16:00',
        dailyActiveUsers: 1834,
        weeklyActiveUsers: 8921,
        monthlyActiveUsers: 28456
      }

      setPerformanceMetrics(metrics)
      setSystemHealth(health)
      setUsageAnalytics(analytics)
      setIsLoading(false)
      setLastUpdate(new Date())
    }

    initializeData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      initializeData()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  // Cryptographically secure random number generator for browser
  const secureRandom = () => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    // Defensive: array is always length 1, but TypeScript may warn
    return (array?.[0] ?? 0) / (0xFFFFFFFF + 1);
  }

  const generateTimeSeriesData = (points: number, min: number, max: number) => {
    return Array.from({ length: points }, (_, i) => ({
      timestamp: Date.now() - (points - i) * 60000,
      value: min + secureRandom() * (max - min)
    }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
      case 'online':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'warning':
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'critical':
      case 'offline':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
      case 'online':
        return <CheckCircle className="w-4 h-4" />
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="w-4 h-4" />
      case 'critical':
      case 'offline':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'down':
        return <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />
      default:
        return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading monitoring dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enterprise Monitoring Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Real-time system performance and analytics • Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Activity className="w-4 h-4 mr-2" />
          All Systems Operational
        </Badge>
      </div>

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Performance Metrics
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            System Health
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Usage Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-6">
          {/* Key Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {performanceMetrics.map((metric) => (
              <Card key={metric.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      {metric.name}
                    </CardTitle>
                    {getTrendIcon(metric.trend)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {metric.value.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500">{metric.unit}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Threshold: {metric.threshold}{metric.unit}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getStatusColor(metric.status)}`}
                      >
                        {getStatusIcon(metric.status)}
                        <span className="ml-1 capitalize">{metric.status}</span>
                      </Badge>
                    </div>
                    
                    <Progress 
                      value={(metric.value / metric.threshold) * 100} 
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          {/* API Health Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                API Endpoints Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemHealth?.apis.map((api) => (
                  <div key={api.endpoint} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="outline" 
                        className={`${getStatusColor(api.status)}`}
                      >
                        {getStatusIcon(api.status)}
                        <span className="ml-1 capitalize">{api.status}</span>
                      </Badge>
                      <div>
                        <h4 className="font-medium">{api.name}</h4>
                        <p className="text-sm text-gray-500">{api.endpoint}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{api.responseTime}ms</div>
                      <div className="text-xs text-gray-500">{api.successRate}% uptime</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Infrastructure Health */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Database Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <Badge 
                      variant="outline" 
                      className={`${getStatusColor(systemHealth?.database.status || '')}`}
                    >
                      {getStatusIcon(systemHealth?.database.status || '')}
                      <span className="ml-1 capitalize">{systemHealth?.database.status}</span>
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Response Time</span>
                    <span className="font-medium">{systemHealth?.database.responseTime}ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Connections</span>
                    <span className="font-medium">
                      {systemHealth?.database.connections}/{systemHealth?.database.maxConnections}
                    </span>
                  </div>
                  <Progress 
                    value={(systemHealth?.database.connections || 0) / (systemHealth?.database.maxConnections || 1) * 100} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Cache Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <Badge 
                      variant="outline" 
                      className={`${getStatusColor(systemHealth?.cache.status || '')}`}
                    >
                      {getStatusIcon(systemHealth?.cache.status || '')}
                      <span className="ml-1 capitalize">{systemHealth?.cache.status}</span>
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Hit Rate</span>
                    <span className="font-medium">{systemHealth?.cache.hitRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Memory Usage</span>
                    <span className="font-medium">
                      {systemHealth?.cache.memory}GB / {systemHealth?.cache.maxMemory}GB
                    </span>
                  </div>
                  <Progress 
                    value={(systemHealth?.cache.memory || 0) / (systemHealth?.cache.maxMemory || 1) * 100} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Usage Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Active Sessions</p>
                    <p className="text-2xl font-bold">{usageAnalytics?.activeSessions.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Heart className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Crisis Interventions</p>
                    <p className="text-2xl font-bold">{usageAnalytics?.crisisInterventions.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Clock className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Avg Session Duration</p>
                    <p className="text-2xl font-bold">{usageAnalytics?.averageSessionDuration}min</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">User Satisfaction</p>
                    <p className="text-2xl font-bold">{usageAnalytics?.userSatisfaction}/5</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Daily Active Users</span>
                    <span className="font-medium">{usageAnalytics?.dailyActiveUsers.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Weekly Active Users</span>
                    <span className="font-medium">{usageAnalytics?.weeklyActiveUsers.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Monthly Active Users</span>
                    <span className="font-medium">{usageAnalytics?.monthlyActiveUsers.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Peak Usage Time</span>
                    <span className="font-medium">{usageAnalytics?.peakUsageTime}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Intervention Effectiveness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Interventions</span>
                    <span className="font-medium">{usageAnalytics?.crisisInterventions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Successful Interventions</span>
                    <span className="font-medium">{usageAnalytics?.successfulInterventions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Success Rate</span>
                    <span className="font-medium">
                      {((usageAnalytics?.successfulInterventions || 0) / (usageAnalytics?.crisisInterventions || 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={(usageAnalytics?.successfulInterventions || 0) / (usageAnalytics?.crisisInterventions || 1) * 100} 
                    className="h-3"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
