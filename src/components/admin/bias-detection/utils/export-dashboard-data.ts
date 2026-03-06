import type { SetStateAction } from "react";

import type { BiasDashboardData } from "@/lib/ai/bias-detection";

type SetState<T> = (value: SetStateAction<T>) => void;

export type ExportFormat = "json" | "csv" | "pdf";

export type ExportDataType = "summary" | "alerts" | "trends" | "demographics" | "sessions" | "recommendations";

export type DateRangeFilter = {
  start: string;
  end: string;
};

export type ExportDateFilter = {
  applyCurrentFilters: boolean;
  minBiasScore: number;
  maxBiasScore: number;
  includeArchived: boolean;
};

export type ExportDataTypes = Record<ExportDataType, boolean>;

export type DashboardExportLogger = {
  info(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
};

export function getEnabledExportTypes(dataTypes: ExportDataTypes): ExportDataType[] {
  return ["summary", "alerts", "trends", "demographics", "sessions", "recommendations"].filter(
    (key): key is ExportDataType => dataTypes[key],
  );
}

function buildEnabledExportTypes(dataTypes: ExportDataTypes): ExportDataType[] {
  return getEnabledExportTypes(dataTypes);
}

type TimeRange =
  | "24h"
  | "7d"
  | "30d"
  | "90d"
  | "custom";

type BiasLevel = "all" | "low" | "medium" | "high" | "critical";

type ExportOptions = {
  format: ExportFormat;
  exportDateRange: DateRangeFilter;
  exportDataTypes: ExportDataTypes;
  exportFilters: ExportDateFilter;
  selectedTimeRange: TimeRange;
  biasScoreFilter: {
    min: number;
    max: number;
  };
  alertLevelFilter: BiasLevel;
  selectedDemographicFilter: string;
  customDateRange?: DateRangeFilter;
  setExportProgress: SetState<{
    isExporting: boolean;
    progress: number;
    status: string;
  }>;
  setShowExportDialog: (value: SetStateAction<boolean>) => void;
  logger: DashboardExportLogger;
  dashboardData: BiasDashboardData | null;
};

export async function exportBiasDashboardData({
  format,
  exportDateRange,
  exportDataTypes,
  exportFilters,
  selectedTimeRange,
  biasScoreFilter,
  alertLevelFilter,
  selectedDemographicFilter,
  customDateRange,
  setExportProgress,
  setShowExportDialog,
  logger,
  dashboardData,
}: ExportOptions): Promise<void> {
  try {
    setExportProgress({
      isExporting: true,
      progress: 0,
      status: "Preparing export...",
    });

    const exportParams = {
      format,
      dateRange: exportDateRange,
      dataTypes: exportDataTypes,
      filters: exportFilters,
      currentFilters: exportFilters.applyCurrentFilters
        ? {
            timeRange: selectedTimeRange,
            biasScoreFilter,
            alertLevelFilter,
            demographicFilter: selectedDemographicFilter,
            customDateRange: selectedTimeRange === "custom" ? customDateRange : undefined,
          }
        : undefined,
    };

    setExportProgress((prev) => ({
      ...prev,
      progress: 25,
      status: "Gathering data...",
    }));

    const response = await fetch("/api/bias-detection/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(exportParams),
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    setExportProgress((prev) => ({
      ...prev,
      progress: 75,
      status: "Generating file...",
    }));

    let blob: Blob;
    let filename: string;
    const timestamp = new Date().toISOString().split("T")[0];

    switch (format) {
      case "json":
      case "csv":
      case "pdf":
        blob = await response.blob();
        filename =
          format === "pdf"
            ? `bias-dashboard-report-${timestamp}.${format}`
            : `bias-dashboard-${timestamp}.${format}`;
        break;
      default:
        throw new Error("Unsupported export format");
    }

    setExportProgress((prev) => ({
      ...prev,
      progress: 90,
      status: "Downloading file...",
    }));

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);

    setExportProgress({
      isExporting: false,
      progress: 100,
      status: "Export completed!",
    });
    setTimeout(() => {
      setShowExportDialog(false);
      setExportProgress({ isExporting: false, progress: 0, status: "" });
    }, 1500);

    logger.info("Dashboard data exported successfully", {
      format,
      dataTypes: buildEnabledExportTypes(exportDataTypes),
      dateRange: exportDateRange,
      filename,
      totalRows: dashboardData ? dashboardData.summary.totalSessions : 0,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err?.message || String(err) : "Export failed";
    setExportProgress({
      isExporting: false,
      progress: 0,
      status: `Error: ${errorMessage}`,
    });
    logger.error("Export failed", {
      error: errorMessage,
      exportParams: { format, dataTypes: exportDataTypes },
    });
    setTimeout(() => {
      setExportProgress({ isExporting: false, progress: 0, status: "" });
    }, 3000);
  }
}

