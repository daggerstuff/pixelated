## Journal Research Component Documentation

## Overview

This document provides comprehensive documentation for the Journal Research frontend components, hooks, and stores. The Journal Research module is built with React, TypeScript, Zustand for state management, and React Query for data fetching.

## Table of Contents

- [Components](#components)
  - [Feature Components](#feature-components)
  - [Shared Components](#shared-components)
  - [Form Components](#form-components)
  - [List Components](#list-components)
  - [Chart Components](#chart-components)
- [Hooks](#hooks)
- [Stores](#stores)
- [Usage Examples](#usage-examples)

## Components

### Feature Components

#### Dashboard

**Location**: `src/components/journal-research/features/Dashboard.tsx`

Main dashboard component that displays session overview, progress charts, and recent activity.

**Props:**
```typescript
interface DashboardProps {
  className?: string;
}
```

**Features:**
- Displays selected session progress
- Shows recent sessions list
- Real-time progress metrics with auto-refresh (5s interval)
- Quick actions for creating new sessions
- Progress charts visualization

**Usage:**
```tsx
import { Dashboard } from '@/components/journal-research/features'

function DashboardPage() {
  return <Dashboard className="container mx-auto" />
}
```

#### SessionDetail

**Location**: `src/components/journal-research/features/SessionDetail.tsx`

Displays detailed information about a research session.

**Props:**
```typescript
interface SessionDetailProps {
  sessionId: string;
  className?: string;
}
```

**Features:**
- Session metadata display
- Progress metrics visualization
- Phase navigation
- Quick actions (edit, delete, generate report)

#### SourceDiscovery

**Location**: `src/components/journal-research/features/SourceDiscovery.tsx`

Interface for initiating and monitoring source discovery operations.

**Props:**
```typescript
interface SourceDiscoveryProps {
  sessionId?: string | null;
  className?: string;
}
```

**Features:**
- Discovery configuration form
- Discovery progress tracking
- Real-time source updates
- Source filtering and search

#### EvaluationPanel

**Location**: `src/components/journal-research/features/EvaluationPanel.tsx`

Panel for managing source evaluations.

**Props:**
```typescript
interface EvaluationPanelProps {
  sessionId: string;
  className?: string;
}
```

**Features:**
- Evaluation list with filtering
- Manual evaluation override
- Bulk evaluation operations
- Score visualization

#### AcquisitionPanel

**Location**: `src/components/journal-research/features/AcquisitionPanel.tsx`

Panel for managing dataset acquisitions.

**Props:**
```typescript
interface AcquisitionPanelProps {
  sessionId: string;
  className?: string;
}
```

**Features:**
- Acquisition status tracking
- Progress monitoring
- Approval/rejection workflow
- Storage location display

#### IntegrationPanel

**Location**: `src/components/journal-research/features/IntegrationPanel.tsx`

Panel for managing integration plans.

**Props:**
```typescript
interface IntegrationPanelProps {
  sessionId: string;
  className?: string;
}
```

**Features:**
- Integration plan visualization
- Preprocessing script generation
- Schema mapping interface
- Plan execution status

#### ProgressTracker

**Location**: `src/components/journal-research/features/ProgressTracker.tsx`

Component for tracking research session progress.

**Props:**
```typescript
interface ProgressTrackerProps {
  sessionId: string;
  className?: string;
}
```

**Features:**
- Overall progress display
- Phase-by-phase progress
- Target vs actual metrics
- Real-time updates via WebSocket/SSE

#### ReportGenerator

**Location**: `src/components/journal-research/features/ReportGenerator.tsx`

Component for generating research reports.

**Props:**
```typescript
interface ReportGeneratorProps {
  sessionId: string;
  className?: string;
}
```

**Features:**
- Report type selection
- Format selection (PDF, HTML, JSON)
- Section customization
- Report preview

#### ReportViewer

**Location**: `src/components/journal-research/features/ReportViewer.tsx`

Component for viewing generated reports.

**Props:**
```typescript
interface ReportViewerProps {
  reportId: string;
  sessionId: string;
  className?: string;
}
```

**Features:**
- Report display
- Download functionality
- Print support
- Report metadata

### Shared Components

#### SessionCard

**Location**: `src/components/journal-research/shared/SessionCard.tsx`

Card component for displaying session summary.

**Props:**
```typescript
interface SessionCardProps {
  session: Session;
  onClick?: (sessionId: string) => void;
  className?: string;
}
```

**Usage:**
```tsx
import { SessionCard } from '@/components/journal-research/shared'

<SessionCard 
  session={session} 
  onClick={(id) => navigate(`/journal-research/sessions/${id}`)}
/>
```

#### SourceCard

**Location**: `src/components/journal-research/shared/SourceCard.tsx`

Card component for displaying source information.

**Props:**
```typescript
interface SourceCardProps {
  source: Source;
  onClick?: (sourceId: string) => void;
  className?: string;
}
```

#### EvaluationCard

**Location**: `src/components/journal-research/shared/EvaluationCard.tsx`

Card component for displaying evaluation results.

**Props:**
```typescript
interface EvaluationCardProps {
  evaluation: Evaluation;
  onClick?: (evaluationId: string) => void;
  className?: string;
}
```

#### ProgressBar

**Location**: `src/components/journal-research/shared/ProgressBar.tsx`

Progress bar component for displaying progress metrics.

**Props:**
```typescript
interface ProgressBarProps {
  value: number; // 0-100
  max?: number; // default: 100
  label?: string;
  showValue?: boolean;
  className?: string;
}
```

**Usage:**
```tsx
import { ProgressBar } from '@/components/journal-research/shared'

<ProgressBar 
  value={75} 
  label="Discovery Progress" 
  showValue 
/>
```

#### NotificationCenter

**Location**: `src/components/journal-research/shared/NotificationCenter.tsx`

Component for displaying notifications and alerts.

**Props:**
```typescript
interface NotificationCenterProps {
  className?: string;
}
```

**Features:**
- Toast notifications
- Notification history
- Notification preferences
- Real-time updates

### Form Components

#### SessionForm

**Location**: `src/components/journal-research/forms/SessionForm.tsx`

Form for creating and editing research sessions.

**Props:**
```typescript
interface SessionFormProps {
  sessionId?: string; // If provided, form is in edit mode
  onSubmit: (data: CreateSessionRequest) => void | Promise<void>;
  onCancel?: () => void;
  defaultValues?: Partial<CreateSessionRequest>;
}
```

**Usage:**
```tsx
import { SessionForm } from '@/components/journal-research/forms'
import { useCreateSessionMutation } from '@/lib/hooks/journal-research'

function CreateSessionDialog() {
  const createSession = useCreateSessionMutation()
  
  return (
    <SessionForm
      onSubmit={async (data) => {
        await createSession.mutateAsync(data)
      }}
      onCancel={() => closeDialog()}
    />
  )
}
```

#### DiscoveryForm

**Location**: `src/components/journal-research/forms/DiscoveryForm.tsx`

Form for configuring discovery operations.

**Props:**
```typescript
interface DiscoveryFormProps {
  sessionId: string;
  onSubmit: (data: DiscoveryRequest) => void | Promise<void>;
  onCancel?: () => void;
}
```

#### EvaluationForm

**Location**: `src/components/journal-research/forms/EvaluationForm.tsx`

Form for creating and updating evaluations.

**Props:**
```typescript
interface EvaluationFormProps {
  evaluationId?: string; // If provided, form is in edit mode
  sourceId: string;
  sessionId: string;
  onSubmit: (data: EvaluationRequest) => void | Promise<void>;
  onCancel?: () => void;
  defaultValues?: Partial<EvaluationRequest>;
}
```

### List Components

#### SessionList

**Location**: `src/components/journal-research/lists/SessionList.tsx`

List component for displaying sessions with filtering and sorting.

**Props:**
```typescript
interface SessionListProps {
  sessions?: Session[];
  isLoading?: boolean;
  onSessionClick?: (sessionId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  className?: string;
}
```

**Features:**
- Pagination
- Filtering by phase
- Sorting by date/progress
- Search functionality

#### SourceList

**Location**: `src/components/journal-research/lists/SourceList.tsx`

List component for displaying discovered sources.

**Props:**
```typescript
interface SourceListProps {
  sources?: Source[];
  isLoading?: boolean;
  onSourceClick?: (sourceId: string) => void;
  className?: string;
}
```

#### EvaluationList

**Location**: `src/components/journal-research/lists/EvaluationList.tsx`

List component for displaying evaluations.

**Props:**
```typescript
interface EvaluationListProps {
  evaluations?: Evaluation[];
  isLoading?: boolean;
  onEvaluationClick?: (evaluationId: string) => void;
  className?: string;
}
```

#### AcquisitionList

**Location**: `src/components/journal-research/lists/AcquisitionList.tsx`

List component for displaying acquisitions.

**Props:**
```typescript
interface AcquisitionListProps {
  acquisitions?: Acquisition[];
  isLoading?: boolean;
  onAcquisitionClick?: (acquisitionId: string) => void;
  className?: string;
}
```

### Chart Components

#### ProgressCharts

**Location**: `src/components/journal-research/charts/ProgressCharts.tsx`

Component for displaying progress visualizations.

**Props:**
```typescript
interface ProgressChartsProps {
  progress: ProgressMetrics;
  metrics?: ProgressMetrics;
  className?: string;
}
```

**Features:**
- Overall progress chart
- Phase progress breakdown
- Metrics over time
- Target vs actual comparison

#### MetricsChart

**Location**: `src/components/journal-research/charts/MetricsChart.tsx`

Chart component for displaying metrics over time.

**Props:**
```typescript
interface MetricsChartProps {
  data: Array<{
    date: Date;
    sourcesIdentified: number;
    sourcesEvaluated: number;
    sourcesAcquired: number;
  }>;
  className?: string;
}
```

#### PhaseProgressChart

**Location**: `src/components/journal-research/charts/PhaseProgressChart.tsx`

Chart component for displaying phase-by-phase progress.

**Props:**
```typescript
interface PhaseProgressChartProps {
  phaseProgress: Record<string, number>; // phase -> progress (0-100)
  className?: string;
}
```

## Hooks

### useSession

**Location**: `src/lib/hooks/journal-research/useSession.ts`

Hook for session operations.

**Exports:**
- `useSessionQuery(sessionId: string | null, options?)` - Fetch single session
- `useSessionListQuery(params?, options?)` - Fetch session list
- `useCreateSessionMutation()` - Create session mutation
- `useUpdateSessionMutation()` - Update session mutation
- `useDeleteSessionMutation()` - Delete session mutation

**Usage:**
```tsx
import { 
  useSessionQuery, 
  useCreateSessionMutation 
} from '@/lib/hooks/journal-research'

function SessionPage({ sessionId }: { sessionId: string }) {
  const { data: session, isLoading } = useSessionQuery(sessionId)
  const createSession = useCreateSessionMutation()
  
  const handleCreate = async () => {
    await createSession.mutateAsync({
      targetSources: ['pubmed'],
      searchKeywords: { therapeutic: ['therapy'] },
      weeklyTargets: { sources_identified: 10 }
    })
  }
  
  if (isLoading) return <div>Loading...</div>
  return <div>{session?.sessionId}</div>
}
```

### useDiscovery

**Location**: `src/lib/hooks/journal-research/useDiscovery.ts`

Hook for discovery operations.

**Exports:**
- `useSourceListQuery(sessionId: string, params?, options?)` - Fetch source list
- `useSourceQuery(sessionId: string, sourceId: string, options?)` - Fetch single source
- `useInitiateDiscoveryMutation()` - Initiate discovery mutation

### useEvaluation

**Location**: `src/lib/hooks/journal-research/useEvaluation.ts`

Hook for evaluation operations.

**Exports:**
- `useEvaluationListQuery(sessionId: string, params?, options?)` - Fetch evaluation list
- `useEvaluationQuery(sessionId: string, evaluationId: string, options?)` - Fetch single evaluation
- `useInitiateEvaluationMutation()` - Initiate evaluation mutation
- `useUpdateEvaluationMutation()` - Update evaluation mutation

### useAcquisition

**Location**: `src/lib/hooks/journal-research/useAcquisition.ts`

Hook for acquisition operations.

**Exports:**
- `useAcquisitionListQuery(sessionId: string, params?, options?)` - Fetch acquisition list
- `useAcquisitionQuery(sessionId: string, acquisitionId: string, options?)` - Fetch single acquisition
- `useInitiateAcquisitionMutation()` - Initiate acquisition mutation
- `useUpdateAcquisitionMutation()` - Update acquisition mutation

### useIntegration

**Location**: `src/lib/hooks/journal-research/useIntegration.ts`

Hook for integration operations.

**Exports:**
- `useIntegrationPlanListQuery(sessionId: string, params?, options?)` - Fetch integration plan list
- `useIntegrationPlanQuery(sessionId: string, planId: string, options?)` - Fetch single integration plan
- `useInitiateIntegrationMutation()` - Initiate integration mutation

### useProgress

**Location**: `src/lib/hooks/journal-research/useProgress.ts`

Hook for progress tracking.

**Exports:**
- `useProgressQuery(sessionId: string | null, options?)` - Fetch progress metrics
- `useProgressMetricsQuery(sessionId: string | null, options?)` - Fetch detailed progress metrics

**Usage:**
```tsx
import { useProgressQuery } from '@/lib/hooks/journal-research'

function ProgressDisplay({ sessionId }: { sessionId: string }) {
  const { data: progress } = useProgressQuery(sessionId, {
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  })
  
  return (
    <div>
      <div>Overall Progress: {progress?.overallProgress}%</div>
      <div>Current Phase: {progress?.currentPhase}</div>
    </div>
  )
}
```

### useWebSocket

**Location**: `src/lib/hooks/journal-research/useWebSocket.ts`

Hook for WebSocket connections.

**Exports:**
- `useProgressWebSocket(sessionId: string, options?)` - Connect to progress WebSocket stream

**Usage:**
```tsx
import { useProgressWebSocket } from '@/lib/hooks/journal-research'

function RealTimeProgress({ sessionId }: { sessionId: string }) {
  const { data: progressUpdate, isConnected } = useProgressWebSocket(sessionId)
  
  return (
    <div>
      {isConnected ? (
        <div>Progress: {progressUpdate?.progress.overallProgress}%</div>
      ) : (
        <div>Connecting...</div>
      )}
    </div>
  )
}
```

## Stores

### useJournalSessionStore

**Location**: `src/lib/stores/journal-research/sessionStore.ts`

Zustand store for session state management.

**State:**
```typescript
interface SessionStoreState {
  selectedSessionId: string | null;
  filters: SessionFilters;
  isCreateDrawerOpen: boolean;
  
  // Actions
  setSelectedSessionId: (sessionId: string | null) => void;
  setFilters: (filters: Partial<SessionFilters>) => void;
  openCreateDrawer: () => void;
  closeCreateDrawer: () => void;
}
```

**Usage:**
```tsx
import { useJournalSessionStore } from '@/lib/stores/journal-research'

function SessionSelector() {
  const selectedSessionId = useJournalSessionStore(
    (state) => state.selectedSessionId
  )
  const setSelectedSessionId = useJournalSessionStore(
    (state) => state.setSelectedSessionId
  )
  
  return (
    <select 
      value={selectedSessionId ?? ''} 
      onChange={(e) => setSelectedSessionId(e.target.value || null)}
    >
      {/* options */}
    </select>
  )
}
```

### useDiscoveryStore

**Location**: `src/lib/stores/journal-research/discoveryStore.ts`

Zustand store for discovery state management.

**State:**
```typescript
interface DiscoveryStoreState {
  selectedSourceId: string | null;
  highlightSourceId: string | null;
  filters: DiscoveryFilters;
  
  // Actions
  setSelectedSourceId: (sourceId: string | null) => void;
  setHighlightSourceId: (sourceId: string | null) => void;
  toggleSourceType: (sourceType: string) => void;
  toggleKeyword: (keyword: string) => void;
  toggleOpenAccess: () => void;
  setSort: (sortBy: string, sortDirection?: 'asc' | 'desc') => void;
  resetFilters: () => void;
}
```

### useEvaluationStore

**Location**: `src/lib/stores/journal-research/evaluationStore.ts`

Zustand store for evaluation state management.

**State:**
```typescript
interface EvaluationStoreState {
  selectedEvaluationId: string | null;
  editingEvaluationId: string | null;
  filters: EvaluationFilters;
  isBulkEditMode: boolean;
  
  // Actions
  setSelectedEvaluationId: (evaluationId: string | null) => void;
  setEditingEvaluationId: (evaluationId: string | null) => void;
  togglePriorityTier: (tier: string) => void;
  setScoreRange: (min: number | null, max: number | null) => void;
  setSort: (sortBy: string, sortDirection?: 'asc' | 'desc') => void;
  toggleBulkEditMode: () => void;
  resetFilters: () => void;
}
```

### useAcquisitionStore

**Location**: `src/lib/stores/journal-research/acquisitionStore.ts`

Zustand store for acquisition state management.

**State:**
```typescript
interface AcquisitionStoreState {
  selectedAcquisitionId: string | null;
  filters: AcquisitionFilters;
  
  // Actions
  setSelectedAcquisitionId: (acquisitionId: string | null) => void;
  toggleStatus: (status: AcquisitionStatus) => void;
  resetFilters: () => void;
}
```

### useIntegrationStore

**Location**: `src/lib/stores/journal-research/integrationStore.ts`

Zustand store for integration state management.

**State:**
```typescript
interface IntegrationStoreState {
  selectedPlanId: string | null;
  filters: IntegrationFilters;
  
  // Actions
  setSelectedPlanId: (planId: string | null) => void;
  resetFilters: () => void;
}
```

## Usage Examples

### Complete Workflow Example

```tsx
import { Dashboard } from '@/components/journal-research/features'
import { useCreateSessionMutation } from '@/lib/hooks/journal-research'
import { useJournalSessionStore } from '@/lib/stores/journal-research'

function JournalResearchPage() {
  const createSession = useCreateSessionMutation()
  const openCreateDrawer = useJournalSessionStore(
    (state) => state.openCreateDrawer
  )
  
  return (
    <div>
      <Dashboard />
      <button onClick={openCreateDrawer}>
        Create New Session
      </button>
    </div>
  )
}
```

### Session Management Example

```tsx
import { SessionList, SessionForm } from '@/components/journal-research'
import { 
  useSessionListQuery, 
  useCreateSessionMutation 
} from '@/lib/hooks/journal-research'

function SessionsPage() {
  const { data: sessions } = useSessionListQuery({ page: 1, pageSize: 20 })
  const createSession = useCreateSessionMutation()
  
  return (
    <div>
      <SessionList 
        sessions={sessions?.items}
        onSessionClick={(id) => navigate(`/sessions/${id}`)}
      />
      <SessionForm
        onSubmit={async (data) => {
          await createSession.mutateAsync(data)
        }}
      />
    </div>
  )
}
```

### Real-time Progress Tracking

```tsx
import { ProgressTracker } from '@/components/journal-research/features'
import { useProgressWebSocket } from '@/lib/hooks/journal-research'

function SessionProgress({ sessionId }: { sessionId: string }) {
  const { data: progressUpdate, isConnected } = useProgressWebSocket(sessionId)
  
  return (
    <div>
      <div>Connection: {isConnected ? 'Connected' : 'Disconnected'}</div>
      {progressUpdate && (
        <ProgressTracker 
          sessionId={sessionId}
          progress={progressUpdate.progress}
        />
      )}
    </div>
  )
}
```

## Best Practices

1. **Always use hooks for data fetching** - Don't fetch data directly in components
2. **Use stores for UI state** - Use Zustand stores for component state that needs to be shared
3. **Handle loading and error states** - Always check `isLoading` and `error` from queries
4. **Use React Query's caching** - Leverage React Query's built-in caching for better performance
5. **Implement optimistic updates** - Use mutation callbacks for optimistic UI updates
6. **Type safety** - Always use TypeScript types from `@/lib/api/journal-research/types`

## Type Definitions

All TypeScript types are exported from:
- `@/lib/api/journal-research/types` - API types
- Component prop types are defined in each component file

**Last Updated**: January 2025

