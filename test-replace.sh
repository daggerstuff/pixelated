#!/bin/bash
cat src/components/dashboard/AnalyticsCharts.tsx | grep -n -B 5 -A 40 "const SessionChart: FC<SessionChartProps>"
