import { useState } from 'react'
import { Download, Activity, PieChart, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricCardsRow } from '@/components/analytics/MetricCardsRow'
import { TimeSeriesChart } from '@/components/analytics/TimeSeriesChart'
import { UsageBreakdown } from '@/components/analytics/UsageBreakdown'
import { QualityScoreGauge } from '@/components/analytics/QualityScoreGauge'
import { EducatorTable } from '@/components/analytics/EducatorTable'
import { ClinicalCompetencyModule } from '@/components/analytics/ClinicalCompetencyModule'
import { ConsumptionModule } from '@/components/analytics/ConsumptionModule'
import { ComplianceModule } from '@/components/analytics/ComplianceModule'

const DEMO_TIMESERIES = [
  { date: 'Jun 1', value: 28 }, { date: 'Jun 2', value: 32 }, { date: 'Jun 3', value: 25 },
  { date: 'Jun 4', value: 38 }, { date: 'Jun 5', value: 41 }, { date: 'Jun 6', value: 35 },
  { date: 'Jun 7', value: 29 }, { date: 'Jun 8', value: 36 }, { date: 'Jun 9', value: 42 },
  { date: 'Jun 10', value: 38 }, { date: 'Jun 11', value: 44 }, { date: 'Jun 12', value: 39 },
  { date: 'Jun 13', value: 33 }, { date: 'Jun 14', value: 37 }, { date: 'Jun 15', value: 41 },
]

const DEMO_BREAKDOWN = [
  { label: 'Chest Pain Assessment', value: 342 },
  { label: 'SOB Assessment', value: 256 },
  { label: 'Pediatric Fever Protocol', value: 198 },
  { label: 'Mental Health Intake', value: 147 },
  { label: 'Trauma Assessment', value: 112 },
  { label: 'Post-op Complications', value: 89 },
]

type TabId = 'overview' | 'clinical' | 'consumption' | 'compliance'

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity className="h-3.5 w-3.5" /> },
  { id: 'clinical', label: 'Clinical Competency', icon: <Activity className="h-3.5 w-3.5" /> },
  { id: 'consumption', label: 'Consumption', icon: <PieChart className="h-3.5 w-3.5" /> },
  { id: 'compliance', label: 'Compliance', icon: <Shield className="h-3.5 w-3.5" /> },
]

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Institutional analytics across clinical, consumption, and compliance dimensions
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <MetricCardsRow />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TimeSeriesChart data={DEMO_TIMESERIES} title="Simulation Hours Over Time" color="#2563EB" />
            </div>
            <div className="lg:col-span-1">
              <QualityScoreGauge passRate={94.2} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <UsageBreakdown data={DEMO_BREAKDOWN} title="Usage by Scenario" />
            </div>
            <div className="lg:col-span-1">
              <EducatorTable />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'clinical' && <ClinicalCompetencyModule />}
      {activeTab === 'consumption' && <ConsumptionModule />}
      {activeTab === 'compliance' && <ComplianceModule />}
    </div>
  )
}
