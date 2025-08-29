import { EmotionDataPoint, useSessionAnalytics } from '../../hooks/useSessionAnalytics'
import EmotionTrackingChart from './EmotionTrackingChart'

// Define an interface matching EmotionTimelineData from EmotionTrackingChart
interface EmotionDataPoint {
  timestamp: string
  valence: number
  arousal: number
  dominance: number
  label?: string
}

interface SessionAnalysisProps {
  sessionId: string
  clientId: string
}

export default function SessionAnalysis({
  sessionId,
  clientId,
}: SessionAnalysisProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emotionData, setEmotionData] = useState<EmotionDataPoint[]>([])

  useEffect(() => {
    const fetchSessionEmotionData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Construct API URL with query parameters
        const url = new URL(
          '/api/emotions/session-analysis',
          window.location.origin,
        )
        url.searchParams.append('sessionId', sessionId)

        // Fetch data from API
        const response = await fetch(url.toString())

        if (!response.ok) {
          throw new Error(`Error fetching emotion data: ${response.statusText}`)
        }

        const data = await response.json()

        // Define an interface for the API response items
        interface EmotionApiItem {
          timestamp?: string;
          dimensions?: {
            valence?: number;
            arousal?: number;
            dominance?: number;
          };
          valence?: number;
          arousal?: number;
          dominance?: number;
          label?: string;
        }

        // Transform API data into the expected format
        const formattedData = Array.isArray(data)
          ? data.map((item: EmotionApiItem) => {
              const baseData = {
                timestamp: item.timestamp
                  ? new Date(item.timestamp).toISOString()
                  : '',
                valence:
                  item.dimensions && typeof item.dimensions.valence === 'number'
                    ? item.dimensions.valence
                    : typeof item.valence === 'number'
                      ? item.valence
                      : 0,
                arousal:
                  item.dimensions && typeof item.dimensions.arousal === 'number'
                    ? item.dimensions.arousal
                    : typeof item.arousal === 'number'
                      ? item.arousal
                      : 0,
                dominance:
                  item.dimensions &&
                  typeof item.dimensions.dominance === 'number'
                    ? item.dimensions.dominance
                    : typeof item.dominance === 'number'
                      ? item.dominance
                      : 0,
              }

              // Conditionally add label only when it exists
              return item.dominantEmotion
                ? { ...baseData, label: `${item.dominantEmotion}` }
                : baseData
            })
          : []

        setEmotionData(formattedData)
      } catch (err: unknown) {
        console.error('Error fetching session emotion data:', err)
        setError(
          err instanceof Error ? (err as Error)?.message || String(err) : 'An unknown error occurred',
        )
      } finally {
        setIsLoading(false)
      }
    }

    if (sessionId) {
      fetchSessionEmotionData()
    }
  }, [sessionId, clientId])

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-800">
          Session Analysis
        </h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          <p>Error loading session data: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800">Session Analysis</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium mb-4">Emotional Tracking</h3>
          <EmotionTrackingChart
            data={emotionData}
            isLoading={isLoading}
            height={300}
          />

          <p className="mt-4 text-sm text-gray-500">
            This chart shows the client&apos;s emotional dimensions throughout the
            session, helping identify patterns and significant shifts.
          </p>
        </div>

        {/* Other session analysis components would go here */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium mb-4">Session Insights</h3>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                <h4 className="font-medium">Emotional Patterns</h4>
                <p className="text-sm">
                  Client shows cyclical patterns of emotional arousal, possibly
                  indicating anxiety when discussing specific topics.
                </p>
              </div>

              <div className="p-3 border-l-4 border-green-500 bg-green-50">
                <h4 className="font-medium">Progress Indicators</h4>
                <p className="text-sm">
                  Increased emotional regulation compared to previous sessions,
                  with improved ability to return to baseline after triggers.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
