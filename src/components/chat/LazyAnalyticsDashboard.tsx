import { Suspense, lazy } from 'react';
import type { SecurityLevel } from '../../hooks/useSecurity';
import type { Message } from '../../types/chat';

// Lazy load the heavy analytics dashboard
const AnalyticsDashboardReact = lazy(() => import('./AnalyticsDashboardReact'));

interface LazyAnalyticsDashboardProps {
  messages: Message[];
  securityLevel: SecurityLevel;
  encryptionEnabled: boolean;
  scenario: string;
}

function AnalyticsLoadingFallback() {
  return (
    <div className="bg-gray-900 text-gray-100 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-black via-purple-900 to-black p-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Therapy Analytics</h2>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-blue-400 bg-black bg-opacity-50 px-2 py-1 rounded">
            Loading...
          </span>
        </div>
      </div>

      {/* Loading Content */}
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
            <div className="text-center">
              <p className="text-lg font-medium text-purple-300">Loading Analytics Dashboard</p>
              <p className="text-sm text-purple-300/70 mt-1">
                Initializing secure analytics engine...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LazyAnalyticsDashboard(props: LazyAnalyticsDashboardProps): void {
  return (
    <Suspense fallback={<AnalyticsLoadingFallback />}>
      <AnalyticsDashboardReact {...props} />
    </Suspense>
  );
}
