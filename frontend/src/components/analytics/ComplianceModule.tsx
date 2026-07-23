import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShieldAlert, ShieldCheck, Shield, TrendingDown, Timer } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { PHIInterceptionData, AuditChainStatus, InferenceLatencyPoint } from '@/types/analytics'
import { DEMO_COMPLIANCE } from '@/services/analyticsV2Service'

// PHI Interception Card
function PHICard({ data }: { data: PHIInterceptionData }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">PHI Interceptions</CardTitle>
        <ShieldAlert className={`h-4 w-4 ${data.trend === 'decreasing' ? 'text-green-500' : data.trend === 'stable' ? 'text-amber-500' : 'text-red-500'}`} />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold">{data.totalIntercepted}</span>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingDown className="h-3.5 w-3.5" />
              <span>Trending {data.trend}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {data.byPattern.map((p) => (
              <div key={p.pattern} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-muted-foreground">{p.pattern}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-destructive/70 rounded-full" style={{ width: `${(p.count / data.totalIntercepted) * 100}%` }} />
                </div>
                <span className="font-medium w-6 text-right">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Audit Chain Verification
function AuditChainCard({ data }: { data: AuditChainStatus }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Audit Chain Verification</CardTitle>
        {data.chainValid ? (
          <ShieldCheck className="h-5 w-5 text-green-500" />
        ) : (
          <Shield className="h-5 w-5 text-red-500" />
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`h-4 w-4 rounded-full ${data.chainValid ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`font-semibold ${data.chainValid ? 'text-green-600' : 'text-red-600'}`}>
              {data.chainValid ? 'Chain Integrity Verified' : 'Chain Integrity Breach'}
            </span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
            <p>SHA-256 hash chain: <Badge variant={data.chainValid ? 'success' : 'destructive'} className="text-[10px]">{data.chainValid ? 'Valid' : 'Invalid'}</Badge></p>
            <p>{data.totalEntries.toLocaleString()} audit entries verified</p>
            <p>Last verified: {new Date(data.lastVerifiedAt).toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Inference Latency Chart
function LatencyChart({ data }: { data: InferenceLatencyPoint[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Inference Latency (WebSocket → Celery → Response)</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="timestamp" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={50} unit="ms" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [`${value}ms`, undefined]} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="avgMs" stroke="#2563EB" strokeWidth={2} dot={{ r: 2 }} name="Avg Latency" />
              <Line type="monotone" dataKey="p95Ms" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} name="p95 Latency" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Module 3 Container
export function ComplianceModule() {
  const data = DEMO_COMPLIANCE
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1"><PHICard data={data.phiInterceptions} /></div>
        <div className="lg:col-span-1"><AuditChainCard data={data.auditChain} /></div>
        <div className="lg:col-span-1"></div>
      </div>
      <LatencyChart data={data.inferenceLatency} />
    </div>
  )
}
