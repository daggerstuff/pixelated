import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Alert from '@/components/ui/alert'
import {
  AlertTriangle,
  Shield,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Bell,
  CheckCircle,
  XCircle,
  Phone,
  AlertCircle,
  Eye,
  BarChart3,
  Calendar,
  MessageSquare,
  Settings,
} from 'lucide-react'
import type { CrisisPrediction } from '@/lib/ai/services/PredictiveCrisisModelingService'
import type { EscalationEvent } from '@/lib/ai/services/AutomatedEscalationService'

export interface PatientRiskData {
  id: string
  name: string
  currentRisk: 'minimal' | 'low' | 'moderate' | 'high' | 'imminent'
  prediction: CrisisPrediction
  lastAssessment: string
  lastContact: string
  escalationStatus?: 'active' | 'resolved' | 'monitoring'
  therapistId: string
  alerts: AlertItem[]
}

export interface AlertItem {
  id: string
  type: 'prediction' | 'escalation' | 'missed_session' | 'manual' | 'system'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: string
  acknowledged: boolean
  actions: string[]
}

export interface DashboardMetrics {
  totalPatients: number
  highRiskPatients: number
  activeEscalations: number
  todayAssessments: number
  averageResponseTime: string
  escalationRate: number
  falsePositiveRate: number
}

export interface CrisisMonitoringDashboardProps {
  therapistId?: string
  refreshInterval?: number
  showEmergencyControls?: boolean
}

export const CrisisMonitoringDashboard: React.FC<
  CrisisMonitoringDashboardProps
> = ({
  therapistId = 'current_therapist',
  refreshInterval = 30000, // 30 seconds
  showEmergencyControls = true,
}) => {
  const [patients, setPatients] = useState<PatientRiskData[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalPatients: 0,
    highRiskPatients: 0,
    activeEscalations: 0,
    todayAssessments: 0,
    averageResponseTime: '0m',
    escalationRate: 0,
    falsePositiveRate: 0,
  })
  const [activeTab, setActiveTab] = useState('overview')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [loading, setLoading] = useState(false)

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      // Simulated API calls - replace with actual endpoints
      const [patientsResponse, alertsResponse, metricsResponse] =
        await Promise.all([
          fetchPatientRiskData(therapistId),
          fetchAlerts(therapistId),
          fetchMetrics(therapistId),
        ])

      setPatients(patientsResponse)
      setAlerts(alertsResponse)
      setMetrics(metricsResponse)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [therapistId])

  // Auto-refresh effect
  useEffect(() => {
    fetchDashboardData()

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchDashboardData, autoRefresh, refreshInterval])

  // Get risk color for styling
  const getRiskColor = (risk: string): string => {
    const colors = {
      minimal: 'text-green-600 bg-green-50',
      low: 'text-blue-600 bg-blue-50',
      moderate: 'text-yellow-600 bg-yellow-50',
      high: 'text-orange-600 bg-orange-50',
      imminent: 'text-red-600 bg-red-50',
    }
    return colors[risk as keyof typeof colors] || colors.minimal
  }

  // Get severity color for alerts
  const getSeverityColor = (severity: string): string => {
    const colors = {
      low: 'border-blue-200 bg-blue-50',
      medium: 'border-yellow-200 bg-yellow-50',
      high: 'border-orange-200 bg-orange-50',
      critical: 'border-red-200 bg-red-50',
    }
    return colors[severity as keyof typeof colors] || colors.low
  }

  // Handle alert acknowledgment
  const acknowledgeAlert = async (alertId: string) => {
    try {
      await acknowledgeAlertAPI(alertId)
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, acknowledged: true } : alert,
        ),
      )
    } catch (error) {
      console.error('Error acknowledging alert:', error)
    }
  }

  // Trigger manual escalation
  const triggerManualEscalation = async (patientId: string) => {
    try {
      await triggerEscalationAPI(patientId, 'manual')
      await fetchDashboardData() // Refresh data
    } catch (error) {
      console.error('Error triggering escalation:', error)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Crisis Monitoring Dashboard
          </h1>
          <p className="text-gray-600">
            Real-time crisis risk monitoring and escalation management
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>

          <Button onClick={fetchDashboardData} disabled={loading}>
            <Clock className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          <div className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {metrics.totalPatients}
              </span>
              <Users className="h-5 w-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              High Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-red-600">
                {metrics.highRiskPatients}
              </span>
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {metrics.totalPatients > 0
                ? `${Math.round((metrics.highRiskPatients / metrics.totalPatients) * 100)}% of total`
                : '0% of total'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Escalations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-orange-600">
                {metrics.activeEscalations}
              </span>
              <Bell className="h-5 w-5 text-orange-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Avg response: {metrics.averageResponseTime}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Today's Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {metrics.todayAssessments}
              </span>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {metrics.escalationRate.toFixed(1)}% escalation rate
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts ({alerts.filter((a) => !a.acknowledged).length})
          </TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Critical Alerts Section */}
          {alerts.filter((a) => a.severity === 'critical' && !a.acknowledged)
            .length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <div>
                <strong>Critical Alerts Requiring Immediate Attention</strong>
                <div className="mt-2 space-y-1">
                  {alerts
                    .filter((a) => a.severity === 'critical' && !a.acknowledged)
                    .slice(0, 3)
                    .map((alert) => (
                      <div key={alert.id} className="text-sm">
                        {alert.message}
                      </div>
                    ))}
                </div>
              </div>
            </Alert>
          )}

          {/* High Risk Patients Quick View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                High Risk Patients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {patients
                  .filter(
                    (p) =>
                      p.currentRisk === 'high' || p.currentRisk === 'imminent',
                  )
                  .slice(0, 5)
                  .map((patient) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            patient.currentRisk === 'imminent'
                              ? 'bg-red-500'
                              : 'bg-orange-500'
                          }`}
                        />
                        <div>
                          <div className="font-medium">{patient.name}</div>
                          <div className="text-sm text-gray-500">
                            Last contact:{' '}
                            {new Date(patient.lastContact).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge className={getRiskColor(patient.currentRisk)}>
                          {patient.currentRisk.toUpperCase()}
                        </Badge>

                        {showEmergencyControls && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => triggerManualEscalation(patient.id)}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Escalate
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                {patients.filter(
                  (p) =>
                    p.currentRisk === 'high' || p.currentRisk === 'imminent',
                ).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    No high-risk patients at this time
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Risk Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Risk Trends (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500">
                {/* Placeholder for chart component */}
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                  Risk trend visualization would go here
                  <div className="text-sm mt-2">
                    Integration with charting library needed
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`border-l-4 ${getSeverityColor(alert.severity)}`}
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge
                        variant={
                          alert.severity === 'critical'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                      {alert.acknowledged && (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Acknowledged
                        </Badge>
                      )}
                    </div>

                    <p className="text-gray-900 mb-2">{alert.message}</p>

                    {alert.actions.length > 0 && (
                      <div className="text-sm text-gray-600">
                        <strong>Recommended actions:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {alert.actions.map((action, index) => (
                            <li key={index}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {!alert.acknowledged && (
                      <Button
                        size="sm"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Acknowledge
                      </Button>
                    )}

                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {alerts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-2" />
              No alerts at this time
            </div>
          )}
        </TabsContent>

        {/* Patients Tab */}
        <TabsContent value="patients" className="space-y-4">
          <div className="grid gap-4">
            {patients.map((patient) => (
              <Card key={patient.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-4 h-4 rounded-full ${
                          patient.currentRisk === 'imminent'
                            ? 'bg-red-500'
                            : patient.currentRisk === 'high'
                              ? 'bg-orange-500'
                              : patient.currentRisk === 'moderate'
                                ? 'bg-yellow-500'
                                : patient.currentRisk === 'low'
                                  ? 'bg-blue-500'
                                  : 'bg-green-500'
                        }`}
                      />

                      <div>
                        <h3 className="font-medium text-gray-900">
                          {patient.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          ID: {patient.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <Badge className={getRiskColor(patient.currentRisk)}>
                          {patient.currentRisk.toUpperCase()}
                        </Badge>
                        <div className="text-sm text-gray-500 mt-1">
                          Confidence:{' '}
                          {Math.round(patient.prediction.confidence * 100)}%
                        </div>
                      </div>

                      <div className="text-right text-sm text-gray-500">
                        <div>Last assessment:</div>
                        <div>
                          {new Date(
                            patient.lastAssessment,
                          ).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="text-right text-sm text-gray-500">
                        <div>Last contact:</div>
                        <div>
                          {new Date(patient.lastContact).toLocaleDateString()}
                        </div>
                      </div>

                      {patient.escalationStatus && (
                        <Badge
                          variant={
                            patient.escalationStatus === 'active'
                              ? 'destructive'
                              : patient.escalationStatus === 'monitoring'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {patient.escalationStatus}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {patient.prediction.primaryRiskFactors.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-sm text-gray-600">
                        <strong>Primary risk factors:</strong>{' '}
                        {patient.prediction.primaryRiskFactors.join(', ')}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <strong>Intervention window:</strong>{' '}
                        {patient.prediction.interventionWindow.optimal}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Prediction Accuracy</span>
                      <span>87%</span>
                    </div>
                    <Progress value={87} className="mt-1" />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm">
                      <span>False Positive Rate</span>
                      <span>{metrics.falsePositiveRate.toFixed(1)}%</span>
                    </div>
                    <Progress
                      value={metrics.falsePositiveRate}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Average Response Time</span>
                      <span>{metrics.averageResponseTime}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['imminent', 'high', 'moderate', 'low', 'minimal'].map(
                    (risk) => {
                      const count = patients.filter(
                        (p) => p.currentRisk === risk,
                      ).length
                      const percentage =
                        patients.length > 0
                          ? (count / patients.length) * 100
                          : 0

                      return (
                        <div
                          key={risk}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm capitalize">
                            {risk} Risk
                          </span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 text-right text-sm">
                              {count} patients
                            </div>
                            <div className="w-12 text-right text-sm text-gray-500">
                              {percentage.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      )
                    },
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Simulated API functions - replace with actual implementations
async function fetchPatientRiskData(
  therapistId: string,
): Promise<PatientRiskData[]> {
  // Simulated data
  return [
    {
      id: 'patient_001',
      name: 'Jane Doe',
      currentRisk: 'high',
      prediction: {
        riskLevel: 'high',
        timeframe: 'within_day',
        confidence: 0.89,
        primaryRiskFactors: ['Social isolation', 'Recent trauma disclosure'],
        protectiveFactors: ['Strong therapeutic alliance'],
        interventionWindow: {
          optimal: 'Within 24 hours',
          critical: 'Within 72 hours',
        },
        escalationTriggers: ['Immediate clinical review required'],
      },
      lastAssessment: '2025-10-29T10:30:00Z',
      lastContact: '2025-10-28T14:20:00Z',
      escalationStatus: 'monitoring',
      therapistId,
      alerts: [],
    },
  ]
}

async function fetchAlerts(therapistId: string): Promise<AlertItem[]> {
  return [
    {
      id: 'alert_001',
      type: 'prediction',
      severity: 'high',
      message: 'Patient Jane Doe showing elevated crisis risk indicators',
      timestamp: '2025-10-29T11:15:00Z',
      acknowledged: false,
      actions: [
        'Schedule urgent session',
        'Contact emergency contact if no response',
      ],
    },
  ]
}

async function fetchMetrics(therapistId: string): Promise<DashboardMetrics> {
  return {
    totalPatients: 25,
    highRiskPatients: 3,
    activeEscalations: 1,
    todayAssessments: 12,
    averageResponseTime: '2.3m',
    escalationRate: 8.5,
    falsePositiveRate: 4.2,
  }
}

async function acknowledgeAlertAPI(alertId: string): Promise<void> {
  // API call to acknowledge alert
  console.log('Acknowledging alert:', alertId)
}

async function triggerEscalationAPI(
  patientId: string,
  type: string,
): Promise<void> {
  // API call to trigger escalation
  console.log('Triggering escalation for patient:', patientId, 'type:', type)
}

export default CrisisMonitoringDashboard
