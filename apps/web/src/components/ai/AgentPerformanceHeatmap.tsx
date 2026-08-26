import React from 'react';
import { Activity, AlertTriangle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AgentMetric {
  average_latency_ms: number;
  error_rate: number;
  throughput: number;
}

interface AgentPerformanceHeatmapProps {
  stats: Record<string, AgentMetric>;
  className?: string;
}

type State = 'good' | 'warn' | 'bad';

const stateGlyph: Record<State, string> = {
  good: '✓',
  warn: '⚠',
  bad: '✗',
};

// State → value-contrast fill. Good recedes (muted), over-limit advances (text).
// Hue stays banned; the meter's earned weight comes from the neutral ramp.
const stateFill: Record<State, string> = {
  good: 'var(--np-mid)',
  warn: 'var(--np-mid)',
  // bad must read louder without color → advance to full text contrast
  bad: 'var(--np-text)',
}

const MetricCell = ({ label, value, unit, state }: { label: string, value: string | number, unit?: string, state: State }) => (
  <div
    className="flex flex-col gap-2 p-3"
    style={{ background: 'var(--np-surface)', border: '1px solid var(--np-line)' }}
  >
    <span
      className="uppercase np-muted"
      style={{
        fontFamily: 'var(--np-font-mono)',
        fontSize: 'var(--np-text-label)',
        letterSpacing: 'var(--np-tracking-label)',
      }}
    >
      {label}
    </span>
    <div className="flex items-baseline gap-1">
      <span className="np-text font-medium" style={{ fontFamily: 'var(--np-font-mono)', fontSize: 'var(--np-text-title)' }}>{value}</span>
      {unit && (
        <span
          className="np-muted"
          style={{ fontFamily: 'var(--np-font-mono)', fontSize: 'var(--np-text-caption)' }}
        >
          {unit}
        </span>
      )}
      <span
        className={cn('ml-auto', state === 'bad' ? 'np-text' : 'np-mid')}
        role="img"
        aria-label={state === 'good' ? 'within target' : state === 'warn' ? 'approaching limit' : 'over limit'}
        title={state === 'good' ? 'Within target' : state === 'warn' ? 'Approaching limit' : 'Over limit'}
        style={{ fontFamily: 'var(--np-font-mono)' }}
      >
        {stateGlyph[state]}
      </span>
    </div>
  </div>
);

export const AgentPerformanceHeatmap: React.FC<AgentPerformanceHeatmapProps> = ({ stats, className }) => {
  const agents = Object.entries(stats);

  const getLatencyState = (ms: number): State => {
    if (ms < 200) return 'good';
    if (ms < 500) return 'warn';
    return 'bad';
  };

  const getErrorState = (rate: number): State => {
    if (rate === 0) return 'good';
    if (rate < 0.05) return 'warn';
    return 'bad';
  };

  return (
    <div
      className={cn('p-6 np-surface', className)}
      style={{ border: '1px solid var(--np-line)' }}
    >
      <div className="flex items-baseline gap-2 mb-6">
        <BarChart3 className="w-4 h-4 np-mid" style={{ alignSelf: 'center', flexShrink: 0 }} />
        <h3
          className="np-text"
          style={{ fontFamily: 'var(--np-font-display)', fontWeight: 'var(--np-weight-headline)', fontSize: 'var(--np-text-title)', letterSpacing: '-0.01em' }}
        >
          Agent Performance
        </h3>
      </div>

      <div className="space-y-6">
        {agents.length === 0 ? (
          <div className="py-8 text-center">
            <Activity className="w-8 h-8 np-muted mx-auto mb-2" />
            <p className="np-muted" style={{ fontSize: 'var(--np-text-small)' }}>
              No metrics collected yet
            </p>
          </div>
        ) : (
          agents.map(([name, metric]) => {
            const latencyState = getLatencyState(metric.average_latency_ms)
            const latencyPct = Math.min(metric.average_latency_ms / 1000, 1)
            return (
            <div key={name} className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="np-text font-medium" style={{ fontSize: 'var(--np-text-small)' }}>{name}</span>
                <span
                  className="np-muted uppercase"
                  style={{ fontFamily: 'var(--np-font-mono)', fontSize: 'var(--np-text-caption)', letterSpacing: 'var(--np-tracking-label)' }}
                >
                  {metric.throughput} calls
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <MetricCell
                  label="Latency"
                  value={metric.average_latency_ms}
                  unit="ms"
                  state={latencyState}
                />
                <MetricCell
                  label="Error Rate"
                  value={(metric.error_rate * 100).toFixed(1)}
                  unit="%"
                  state={getErrorState(metric.error_rate)}
                />
              </div>

              {/* Latency meter vs 1000ms ceiling. Threshold ticks at 200/500
                  mark the good/warn boundaries; fill advances by value-contrast
                  when over limit. scaleX (transform) not width — no layout anim. */}
              <div className="relative h-1.5 w-full" style={{ background: 'var(--np-elevated)' }}>
                {/* threshold ticks: 200ms (warn), 500ms (bad) */}
                <div className="absolute top-0 bottom-0 z-10 w-px" style={{ left: '20%', background: 'var(--np-line-strong)' }} />
                <div className="absolute top-0 bottom-0 z-10 w-px" style={{ left: '50%', background: 'var(--np-line-strong)' }} />
                <div
                  className="h-full origin-left"
                  style={{
                    width: '100%',
                    transform: `scaleX(${latencyPct})`,
                    background: stateFill[latencyState],
                  }}
                />
              </div>
            </div>
            )
          })
        )}
      </div>

      {agents.length > 0 && (() => {
        const worst = agents.reduce<[string, AgentMetric] | null>((acc, [n, m]) =>
          !acc || m.average_latency_ms > acc[1].average_latency_ms ? [n, m] : acc, null);
        const worstLatency = worst ? worst[1].average_latency_ms : 0;
        const worstName = worst ? worst[0] : '';
        const overTarget = worstLatency >= 200;
        return (
          <div
            className="mt-6 pt-4 flex items-start gap-2"
            style={{ borderTop: '1px solid var(--np-line)' }}
          >
            <AlertTriangle
              className={cn('w-3 h-3', overTarget ? 'np-text' : 'np-mid')}
              style={{ flexShrink: 0, marginTop: '2px' }}
            />
            <p
              className={cn('leading-tight', overTarget ? 'np-text' : 'np-muted')}
              style={{ fontSize: 'var(--np-text-label)', fontFamily: 'var(--np-font-mono)' }}
            >
              Target latency {'<'}200ms. {overTarget
                ? `Highest now: ${worstName} (${worstLatency}ms) — may slow formulation feedback to the trainee.`
                : `All agents within target. Highest: ${worstName} (${worstLatency}ms).`}
            </p>
          </div>
        );
      })()}
    </div>
  );
};
