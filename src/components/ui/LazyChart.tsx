import React, { Suspense, lazy } from 'react';

// Lazy load chart components to reduce bundle size
const LazyAreaChart = lazy(() => import('recharts').then(module => ({ default: module.AreaChart })));
const LazyBarChart = lazy(() => import('recharts').then(module => ({ default: module.BarChart })));
const LazyPieChart = lazy(() => import('recharts').then(module => ({ default: module.PieChart })));
const LazyRadarChart = lazy(() => import('recharts').then(module => ({ default: module.RadarChart })));
const LazyLineChart = lazy(() => import('recharts').then(module => ({ default: module.LineChart })));
const LazyResponsiveContainer = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));

// Also lazy load chart components
const LazyXAxis = lazy(() => import('recharts').then(module => ({ default: module.XAxis })));
const LazyYAxis = lazy(() => import('recharts').then(module => ({ default: module.YAxis })));
const LazyCartesianGrid = lazy(() => import('recharts').then(module => ({ default: module.CartesianGrid })));
const LazyTooltip = lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const LazyLegend = lazy(() => import('recharts').then(module => ({ default: module.Legend })));
const LazyBar = lazy(() => import('recharts').then(module => ({ default: module.Bar })));
const LazyArea = lazy(() => import('recharts').then(module => ({ default: module.Area })));
const LazyLine = lazy(() => import('recharts').then(module => ({ default: module.Line })));
const LazyPie = lazy(() => import('recharts').then(module => ({ default: module.Pie })));
const LazyCell = lazy(() => import('recharts').then(module => ({ default: module.Cell })));
const LazyRadar = lazy(() => import('recharts').then(module => ({ default: module.Radar })));
const LazyPolarGrid = lazy(() => import('recharts').then(module => ({ default: module.PolarGrid })));
const LazyPolarAngleAxis = lazy(() => import('recharts').then(module => ({ default: module.PolarAngleAxis })));
const LazyPolarRadiusAxis = lazy(() => import('recharts').then(module => ({ default: module.PolarRadiusAxis })));
const LazyReferenceLine = lazy(() => import('recharts').then(module => ({ default: module.ReferenceLine })));

interface ChartLoadingProps {
  height?: number;
  className?: string;
}

function ChartLoading({ height = 300, className = '' }: ChartLoadingProps) {
  return (
    <div 
      className={`flex items-center justify-center bg-muted/10 rounded-lg ${className}`}
      style={{ height: `${height}px` }}
    >
      <div className="flex flex-col items-center space-y-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Loading chart...</p>
      </div>
    </div>
  );
}

// Export wrapped components with Suspense
export function ResponsiveContainer({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
  return (
    <Suspense fallback={<ChartLoading height={props['height']} />}>
      <LazyResponsiveContainer {...props}>
        {children}
      </LazyResponsiveContainer>
    </Suspense>
  );
}

export function AreaChart({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyAreaChart {...props}>
        {children}
      </LazyAreaChart>
    </Suspense>
  );
}

export function BarChart({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyBarChart {...props}>
        {children}
      </LazyBarChart>
    </Suspense>
  );
}

export function PieChart({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyPieChart {...props}>
        {children}
      </LazyPieChart>
    </Suspense>
  );
}

export function RadarChart({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyRadarChart {...props}>
        {children}
      </LazyRadarChart>
    </Suspense>
  );
}

export function LineChart({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyLineChart {...props}>
        {children}
      </LazyLineChart>
    </Suspense>
  );
}

// Export other chart components
export function XAxis(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyXAxis {...props} />
    </Suspense>
  );
}

export function YAxis(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyYAxis {...props} />
    </Suspense>
  );
}

export function CartesianGrid(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyCartesianGrid {...props} />
    </Suspense>
  );
}

export function Tooltip(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyTooltip {...props} />
    </Suspense>
  );
}

export function Legend(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyLegend {...props} />
    </Suspense>
  );
}

export function Bar(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyBar {...props} />
    </Suspense>
  );
}

export function Area(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyArea {...props} />
    </Suspense>
  );
}

export function Line(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyLine {...props} />
    </Suspense>
  );
}

export function Pie(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyPie {...props} />
    </Suspense>
  );
}

export function Cell(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyCell {...props} />
    </Suspense>
  );
}

export function Radar(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyRadar {...props} />
    </Suspense>
  );
}

export function PolarGrid(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyPolarGrid {...props} />
    </Suspense>
  );
}

export function PolarAngleAxis(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyPolarAngleAxis {...props} />
    </Suspense>
  );
}

export function PolarRadiusAxis(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyPolarRadiusAxis {...props} />
    </Suspense>
  );
}

export function ReferenceLine(props: { [key: string]: unknown }) {
  return (
    <Suspense fallback={null}>
      <LazyReferenceLine {...props} />
    </Suspense>
  );
}
