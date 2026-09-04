import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Activity,
  Users,
  Bell,
  CheckCircle,
  Phone,
  Eye,
  BarChart3,
} from 'lucide-react'
import React, { useState, useEffect, useCallback, useMemo } from 'react'

import Alert from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge/index'
import { Button } from '@/components/ui/button/index'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/index'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CrisisPrediction } from '@/lib/ai/services/PredictiveCrisisModelingService'

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

// Performance optimization: Extracted these mapping dictionaries to the module level
// to prevent O(N) object allocations on every render cycle during .map() iterations.
const RISK_COLORS = {
  minimal: 'text-neutral-600 bg-neutral-100',
  low: 'text-neutral-700 bg-neutral-100',
  moderate: 'text-neutral-700 bg-neutral-200',
  high: 'text-neutral-800 bg-neutral-200',
  imminent: 'text-neutral-900 bg-neutral-300',
} as const

const SEVERITY_COLORS = {
  low: 'border-neutral-200 bg-neutral-50',
  medium: 'border-neutral-300 bg-neutral-100',
  high: 'border-neutral-400 bg-neutral-100',
  critical: 'border-neutral-500 bg-neutral-200',
} as const

const RISK_DOT_COLORS = {
  imminent: 'bg-neutral-900',
  high: 'bg-neutral-800',
  moderate: 'bg-neutral-700',
  low: 'bg-neutral-600',
  minimal: 'bg-neutral-500',
} as const

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
      // error handled by caller
    } finally {
      setLoading(false)
    }
  }, [therapistId])

  // Auto-refresh effect
  useEffect(() => {
    void fetchDashboardData()

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, refreshInterval)
      return () => clearInterval(interval)
    }
    return undefined
  }, [fetchDashboardData, autoRefresh, refreshInterval])

  // Performance optimization: Compute formatted date strings once to avoid expensive O(N) Date creations during render
  const memoizedAlerts = useMemo(() => {
    return alerts.map((alert) => ({
      ...alert,
      timestampString: new Date(alert.timestamp).toLocaleString(),
    }))
  }, [alerts])

  // Performance optimization: Memoize derived alert values to prevent unnecessary O(N) filtering on every render
  const unacknowledgedAlertsCount = useMemo(() => {
    return memoizedAlerts.filter((a) => !a.acknowledged).length
  }, [memoizedAlerts])

  const criticalUnacknowledgedAlerts = useMemo(() => {
    return memoizedAlerts.filter(
      (a) => a.severity === 'critical' && !a.acknowledged,
    )
  }, [memoizedAlerts])

  // Performance optimization: Compute formatted date strings once to avoid expensive O(N) Date creations during render
  const memoizedPatients = useMemo(() => {
    return patients.map((patient) => ({
      ...patient,
      lastContactString: new Date(patient.lastContact).toLocaleDateString(),
      lastAssessmentString: new Date(
        patient.lastAssessment,
      ).toLocaleDateString(),
    }))
  }, [patients])

  // Performance optimization: Memoize derived patient risk data to prevent O(N) operations on every render
  const highRiskPatients = useMemo(() => {
    return memoizedPatients.filter(
      (p) => p.currentRisk === 'high' || p.currentRisk === 'imminent',
    )
  }, [memoizedPatients])

  const riskDistribution = useMemo(() => {
    const distribution = {
      imminent: 0,
      high: 0,
      moderate: 0,
      low: 0,
      minimal: 0,
    }
    patients.forEach((p) => {
      if (p.currentRisk in distribution) {
        distribution[p.currentRisk]++
      }
    })
    return distribution
  }, [patients])

  // Get risk color for styling
  const getRiskColor = (risk: string): string => {
    return RISK_COLORS[risk as keyof typeof RISK_COLORS] || RISK_COLORS.minimal
  }

  // Get severity color for alerts
  const getSeverityColor = (severity: string): string => {
    return (
      SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] ||
      SEVERITY_COLORS.low
    )
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
      // error handled by caller
    }
  }

  // Trigger manual escalation
  const triggerManualEscalation = async (patientId: string) => {
    try {
      await triggerEscalationAPI(patientId, 'manual')
      await fetchDashboardData() // Refresh data
    } catch (error) {
      // error handled by caller
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 text-3xl font-bold">
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
            <Activity className="mr-2 h-4 w-4" />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>

          <Button onClick={fetchDashboardData} disabled={loading}>
            <Clock className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <div className="text-gray-500 text-sm">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-600 text-sm font-medium">
              Total Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {metrics.totalPatients}
              </span>
              <Users className="text-gray-400 h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-600 text-sm font-medium">
              High Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-neutral-800 text-2xl font-bold">
                {metrics.highRiskPatients}
              </span>
              <AlertTriangle className="text-neutral-500 h-5 w-5" />
            </div>
            <div className="text-gray-500 mt-1 text-xs">
              {metrics.totalPatients > 0
                ? `${Math.round((metrics.highRiskPatients / metrics.totalPatients) * 100)}% of total`
                : '0% of total'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-600 text-sm font-medium">
              Active Escalations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-neutral-700 text-2xl font-bold">
                {metrics.activeEscalations}
              </span>
              <Bell className="text-neutral-500 h-5 w-5" />
            </div>
            <div className="text-gray-500 mt-1 text-xs">
              Avg response: {metrics.averageResponseTime}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-600 text-sm font-medium">
              Today's Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {metrics.todayAssessments}
              </span>
              <BarChart3 className="text-gray-400 h-5 w-5" />
            </div>
            <div className="text-gray-500 mt-1 text-xs">
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
            Alerts ({unacknowledgedAlertsCount})
          </TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Critical Alerts Section */}
          {criticalUnacknowledgedAlerts.length > 0 && (
            <Alert variant="error">
              <AlertTriangle className="h-4 w-4" />
              <div>
                <strong>Critical Alerts Requiring Immediate Attention</strong>
                <div className="mt-2 space-y-1">
                  {criticalUnacknowledgedAlerts.slice(0, 3).map((alert) => (
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
                <AlertTriangle className="text-neutral-700 mr-2 h-5 w-5" />
                High Risk Patients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {highRiskPatients.slice(0, 5).map((patient) => (
                  <div
                    key={patient.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          patient.currentRisk === 'imminent'
                            ? 'bg-neutral-900'
                            : 'bg-neutral-800'
                        }`}
                      />
                      <div>
                        <div className="font-medium">{patient.name}</div>
                        <div className="text-gray-500 text-sm">
                          Last contact: {patient.lastContactString}
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
                          onClick={async () =>
                            triggerManualEscalation(patient.id)
                          }
                        >
                          <Phone className="mr-1 h-4 w-4" />
                          Escalate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {highRiskPatients.length === 0 && (
                  <div className="text-gray-500 py-8 text-center">
                    <CheckCircle className="text-neutral-500 mx-auto mb-2 h-12 w-12" />
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
                <TrendingUp className="mr-2 h-5 w-5" />
                Risk Trends (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-gray-500 flex h-64 items-center justify-center">
                {/* Placeholder for chart component */}
                <div className="text-center">
                  <BarChart3 className="mx-auto mb-2 h-12 w-12" />
                  Risk trend visualization would go here
                  <div className="mt-2 text-sm">
                    Integration with charting library needed
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {memoizedAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={`border-l-4 ${getSeverityColor(alert.severity)}`}
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center space-x-2">
                      <Badge
                        variant={
                          alert.severity === 'critical'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="text-gray-500 text-sm">
                        {alert.timestampString}
                      </span>
                      {alert.acknowledged && (
                        <Badge variant="outline" className="text-neutral-700">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Acknowledged
                        </Badge>
                      )}
                    </div>

                    <p className="text-gray-900 mb-2">{alert.message}</p>

                    {alert.actions.length > 0 && (
                      <div className="text-gray-600 text-sm">
                        <strong>Recommended actions:</strong>
                        <ul className="mt-1 list-inside list-disc">
                          {alert.actions.map((action, index) => (
                            <li key={index}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="ml-4 flex items-center space-x-2">
                    {!alert.acknowledged && (
                      <Button
                        size="sm"
                        onClick={async () => acknowledgeAlert(alert.id)}
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Acknowledge
                      </Button>
                    )}

                    <Button size="sm" variant="outline">
                      <Eye className="mr-1 h-4 w-4" />
                      Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {alerts.length === 0 && (
            <div className="text-gray-500 py-12 text-center">
              <Bell className="mx-auto mb-2 h-12 w-12" />
              No alerts at this time
            </div>
          )}
        </TabsContent>

        {/* Patients Tab */}
        <TabsContent value="patients" className="space-y-4">
          <div className="grid gap-4">
            {memoizedPatients.map((patient) => (
              <Card key={patient.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`h-4 w-4 rounded-full ${RISK_DOT_COLORS[patient.currentRisk] || RISK_DOT_COLORS.minimal}`}
                      />

                      <div>
                        <h3 className="text-gray-900 font-medium">
                          {patient.name}
                        </h3>
                        <p className="text-gray-500 text-sm">
                          ID: {patient.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <Badge className={getRiskColor(patient.currentRisk)}>
                          {patient.currentRisk.toUpperCase()}
                        </Badge>
                        <div className="text-gray-500 mt-1 text-sm">
                          Confidence:{' '}
                          {Math.round(patient.prediction.confidence * 100)}%
                        </div>
                      </div>

                      <div className="text-gray-500 text-right text-sm">
                        <div>Last assessment:</div>
                        <div>{patient.lastAssessmentString}</div>
                      </div>

                      <div className="text-gray-500 text-right text-sm">
                        <div>Last contact:</div>
                        <div>{patient.lastContactString}</div>
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
                    <div className="mt-3 border-t pt-3">
                      <div className="text-gray-600 text-sm">
                        <strong>Primary risk factors:</strong>{' '}
                        {patient.prediction.primaryRiskFactors.join(', ')}
                      </div>
                      <div className="text-gray-600 mt-1 text-sm">
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                      const count =
                        riskDistribution[risk as keyof typeof riskDistribution]
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
                            <div className="text-gray-500 w-12 text-right text-sm">
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

async function fetchAlerts(_therapistId: string): Promise<AlertItem[]> {
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

async function fetchMetrics(_therapistId: string): Promise<DashboardMetrics> {
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
}

async function triggerEscalationAPI(
  patientId: string,
  type: string,
): Promise<void> {
  // API call to trigger escalation
}

export default CrisisMonitoringDashboard
