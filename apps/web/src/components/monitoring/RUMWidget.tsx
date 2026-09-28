import { useEffect } from "react";

import { useRUMData, getPerformanceIndicator } from "../../lib/monitoring/hooks";

interface RUMWidgetProps {
  compact?: boolean;
  showTitle?: boolean;
  refreshInterval?: number;
  className?: string;
}

/**
 * A compact widget to display key RUM metrics in React components
 */
export default function RUMWidget({
  compact = false,
  showTitle = true,
  refreshInterval = 60000,
  className = "",
}: RUMWidgetProps) {
  const {
    loadingPerformance,
    interactivityMetrics,
    visualStability,
    isLoading,
    lastUpdated,
    refreshData,
  } = useRUMData();

  // Set up refresh interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      void refreshData();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshData, refreshInterval]);

  const renderMetric = (name: string, value: number, unit: string = "ms") => {
    const status = getPerformanceIndicator(name, value);
    // Sanctioned §2.1 web-vitals marks (same palette as
    // WebPerformanceDashboard): good/watch/poor data tiers.
    const statusColors = {
      good: "text-green-500",
      "needs-improvement": "text-yellow-500",
      poor: "text-red-500",
    };

    return (
      <div className="flex items-center justify-between">
        <span className="text-foreground text-sm">{name}:</span>
        <span className={`${statusColors[status]} font-medium`}>
          {value}
          {unit}
        </span>
      </div>
    );
  };

  // Compact view shows just critical metrics
  if (compact) {
    return (
      <div className={`rum-widget rounded-none border border-border bg-card p-2 ${className}`}>
        {showTitle && (
          <div className="text-muted-foreground mb-1 text-xs font-medium">
            Real User Metrics
          </div>
        )}
        <div className="space-y-1">
          {isLoading ? (
            <div className="text-muted-foreground text-sm">Loading...</div>
          ) : (
            <>
              {renderMetric("LCP", loadingPerformance["lcp"] ?? 0)}
              {renderMetric("CLS", visualStability["cls"] ?? 0, "")}
              {renderMetric("FID", interactivityMetrics["fid"] ?? 0)}
            </>
          )}
        </div>
      </div>
    );
  }

  // Full view shows all metrics organized by category
  return (
    <div className={`rum-widget rounded-none border border-border bg-card p-3 ${className}`}>
      {showTitle && (
        <div className="text-foreground mb-2 text-sm font-medium">
          Real User Monitoring
        </div>
      )}

      {isLoading ? (
        <div className="text-muted-foreground py-2">Loading metrics...</div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-medium">Loading</div>
            <div className="space-y-1">
              {renderMetric("TTFB", loadingPerformance["ttfb"] ?? 0)}
              {renderMetric("FCP", loadingPerformance["fcp"] ?? 0)}
              {renderMetric("LCP", loadingPerformance["lcp"] ?? 0)}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1 text-xs font-medium">
              Interactivity
            </div>
            <div className="space-y-1">
              {renderMetric("FID", interactivityMetrics["fid"] ?? 0)}
              {renderMetric("TBT", interactivityMetrics["tbt"] ?? 0)}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1 text-xs font-medium">
              Stability
            </div>
            <div className="space-y-1">{renderMetric("CLS", visualStability["cls"] ?? 0, "")}</div>
          </div>
        </div>
      )}

      {lastUpdated && !isLoading && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-xs">
              Updated: {lastUpdated.toLocaleTimeString()}
            </div>
            <button
              onClick={async () => refreshData()}
              className="text-foreground hover:underline text-xs"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
