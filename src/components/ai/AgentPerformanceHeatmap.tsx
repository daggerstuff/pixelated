import React from 'react';
import { Activity, Clock, AlertTriangle, BarChart3 } from 'lucide-react';
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

const MetricCell = ({ label, value, unit, colorClass }: { label: string, value: string | number, unit?: string, colorClass: string }) => (
  <div className="flex flex-col gap-1 p-2 rounded bg-black/20 border border-white/5">
    <span className="text-[9px] uppercase tracking-wider text-white/40">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className={cn("text-xs font-bold", colorClass)}>{value}</span>
      {unit && <span className="text-[8px] text-white/20">{unit}</span>}
    </div>
  </div>
);

export const AgentPerformanceHeatmap: React.FC<AgentPerformanceHeatmapProps> = ({ stats, className }) => {
  const agents = Object.entries(stats);

  const getLatencyColor = (ms: number) => {
    if (ms < 200) return 'text-emerald-400';
    if (ms < 500) return 'text-amber-400';
    return 'text-red-400';
  };

  const getErrorColor = (rate: number) => {
    if (rate === 0) return 'text-emerald-400';
    if (rate < 0.05) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className={cn("p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm", className)}>
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Agent Performance</h3>
      </div>

      <div className="space-y-6">
        {agents.length === 0 ? (
          <div className="py-8 text-center">
            <Activity className="w-8 h-8 text-white/5 mx-auto mb-2" />
            <p className="text-xs text-white/30 italic">No metrics collected yet</p>
          </div>
        ) : (
          agents.map(([name, metric]) => (
            <div key={name} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/80">{name}</span>
                <span className="text-[10px] text-white/40">{metric.throughput} total calls</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <MetricCell 
                  label="Latency" 
                  value={metric.average_latency_ms} 
                  unit="ms" 
                  colorClass={getLatencyColor(metric.average_latency_ms)} 
                />
                <MetricCell 
                  label="Error Rate" 
                  value={(metric.error_rate * 100).toFixed(1)} 
                  unit="%" 
                  colorClass={getErrorColor(metric.error_rate)} 
                />
              </div>

              {/* Visual mini-bar for latency vs target (200ms) */}
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    metric.average_latency_ms < 200 ? "bg-emerald-500" : 
                    metric.average_latency_ms < 500 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${Math.min((metric.average_latency_ms / 1000) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {agents.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-amber-500/50" />
          <p className="text-[9px] text-white/30 leading-tight">
            Target latency for clinical agents is &lt;200ms. High latency in Psychology agent may indicate complex formulation.
          </p>
        </div>
      )}
    </div>
  );
};
