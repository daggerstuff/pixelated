import type { FC } from 'react'
import type { TreatmentRecommendation } from '../../lib/ai/services/RecommendationService'

interface RecommendationDisplayProps {
  recommendations: TreatmentRecommendation[]
}

// Define more specific types for treatment and personalization
interface TreatmentDetails {
  approach?: string;
  techniques?: string[];
  duration?: string;
  frequency?: string;
}

interface PersonalizationDetails {
  factors?: string[];
  adaptations?: string;
}

// Extended TreatmentRecommendation with additional properties used in the component
interface ExtendedTreatmentRecommendation extends TreatmentRecommendation {
  efficacy?: number;
  indications?: string[];
  treatment?: string | TreatmentDetails;
  evidence?: string[];
  personalization?: string | PersonalizationDetails;
  alternatives?: Array<{
    name: string;
    description?: string;
    efficacy?: number;
  }>;
  mediaRecommendations?: Array<{
    title: string;
    type: string;
    description?: string;
    url?: string;
  }>;
  timestamp?: string;
}

const RecommendationDisplay: FC<RecommendationDisplayProps> = ({
  recommendations
}) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No recommendations available
      </div>
    )
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getEfficacyColor = (efficacy: number) => {
    if (efficacy >= 0.8) {
      return 'text-green-600'
    } else if (efficacy >= 0.6) {
      return 'text-yellow-600'
    } else {
      return 'text-red-600'
    }
  }

  // Helper function to check if an object has the structure of TreatmentDetails
  const isTreatmentDetails = (treatment: unknown): treatment is TreatmentDetails => {
    if (!treatment || typeof treatment !== 'object') {
      return false;
    }
    const t = treatment as Record<string, unknown>;
    return (
      ('approach' in t && (typeof t['approach'] === 'string' || t['approach'] === undefined)) ||
      ('techniques' in t && (Array.isArray(t['techniques']) || t['techniques'] === undefined)) ||
      ('duration' in t && (typeof t['duration'] === 'string' || t['duration'] === undefined)) ||
      ('frequency' in t && (typeof t['frequency'] === 'string' || t['frequency'] === undefined))
    );
  };

  // Helper function to check if an object has the structure of PersonalizationDetails
  const isPersonalizationDetails = (personalization: unknown): personalization is PersonalizationDetails => {
    if (!personalization || typeof personalization !== 'object') {
      return false;
    }
    const p = personalization as Record<string, unknown>;
    return (
      ('factors' in p && (Array.isArray(p['factors']) || p['factors'] === undefined)) ||
      ('adaptations' in p && (typeof p['adaptations'] === 'string' || p['adaptations'] === undefined))
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Treatment Recommendations ({recommendations.length})
      </h2>
      
      {recommendations.map((baseRec) => {
        // Cast to extended type to handle additional properties
        const rec = baseRec as ExtendedTreatmentRecommendation;
        
        return (
          <div key={rec.id || `rec-${rec.title || 'untitled'}-${rec.metadata?.generatedAt || Date.now()}`} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {rec.title || 'Treatment Recommendation'}
                </h3>
                {rec.description && (
                  <p className="text-gray-600 mb-3">{rec.description}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(rec.priority)}`}>
                  {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} Priority
                </span>
                {typeof rec.efficacy === 'number' && (
                  <span className={`text-sm font-medium ${getEfficacyColor(rec.efficacy)}`}>
                    {Math.round(rec.efficacy * 100)}% Efficacy
                  </span>
                )}
              </div>
            </div>

            {/* Indications */}
            {rec.indications && rec.indications.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Target Indications:</h4>
                <div className="flex flex-wrap gap-2">
                  {rec.indications.map((indication: string) => (
                    <span
                      key={`indication-${indication}`}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                    >
                      {indication}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Treatment Details */}
            {rec.treatment && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Treatment Details:</h4>
                <div className="bg-gray-50 rounded p-3">
                  {typeof rec.treatment === 'string' ? (
                    <p className="text-gray-800">{rec.treatment}</p>
                  ) : isTreatmentDetails(rec.treatment) ? (
                    <div className="space-y-2">
                      {rec.treatment['approach'] && (
                        <div>
                          <span className="font-medium">Approach: </span>
                          <span>{rec.treatment['approach']}</span>
                        </div>
                      )}
                      {rec.treatment['techniques'] && rec.treatment['techniques'].length > 0 && (
                        <div>
                          <span className="font-medium">Techniques: </span>
                          <span>{rec.treatment['techniques'].join(', ')}</span>
                        </div>
                      )}
                      {rec.treatment['duration'] && (
                        <div>
                          <span className="font-medium">Duration: </span>
                          <span>{rec.treatment['duration']}</span>
                        </div>
                      )}
                      {rec.treatment['frequency'] && (
                        <div>
                          <span className="font-medium">Frequency: </span>
                          <span>{rec.treatment['frequency']}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-800">Treatment details available</p>
                  )}
                </div>
              </div>
            )}

            {/* Rationale */}
            {rec.rationale && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Rationale:</h4>
                <p className="text-gray-600 text-sm">{rec.rationale}</p>
              </div>
            )}

            {/* Evidence */}
            {rec.evidence && rec.evidence.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Supporting Evidence:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {rec.evidence.map((evidence: string) => (
                    <li key={`evidence-${evidence.slice(0, 20)}`}>{evidence}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Personalization */}
            {rec.personalization && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Personalization Notes:</h4>
                <div className="bg-blue-50 rounded p-3">
                  {typeof rec.personalization === 'string' ? (
                    <p className="text-blue-800 text-sm">{rec.personalization}</p>
                  ) : isPersonalizationDetails(rec.personalization) ? (
                    <div className="space-y-1 text-sm text-blue-800">
                      {rec.personalization['factors'] && rec.personalization['factors'].length > 0 && (
                        <div>
                          <span className="font-medium">Factors: </span>
                          <span>{rec.personalization['factors'].join(', ')}</span>
                        </div>
                      )}
                      {rec.personalization['adaptations'] && (
                        <div>
                          <span className="font-medium">Adaptations: </span>
                          <span>{rec.personalization['adaptations']}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-blue-800 text-sm">Personalization details available</p>
                  )}
                </div>
              </div>
            )}

            {/* Alternatives */}
            {rec.alternatives && rec.alternatives.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Alternative Approaches:</h4>
                <div className="space-y-2">
                  {rec.alternatives.map((alt) => (
                    <div key={`alt-${alt.name}`} className="bg-gray-50 rounded p-2 text-sm">
                      <div className="font-medium text-gray-800">{alt.name}</div>
                      {alt.description && (
                        <div className="text-gray-600 mt-1">{alt.description}</div>
                      )}
                      {typeof alt.efficacy === 'number' && (
                        <div className={`mt-1 ${getEfficacyColor(alt.efficacy)}`}>
                          Efficacy: {Math.round(alt.efficacy * 100)}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Media Recommendations */}
            {rec.mediaRecommendations && rec.mediaRecommendations.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Recommended Resources:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rec.mediaRecommendations.map((media) => (
                    <div key={`media-${media.title}-${media.type}`} className="bg-gray-50 rounded p-3 text-sm">
                      <div className="font-medium text-gray-800">{media.title}</div>
                      <div className="text-gray-600 mt-1 capitalize">{media.type}</div>
                      {media.description && (
                        <div className="text-gray-600 mt-1 text-xs">{media.description}</div>
                      )}
                      {media.url && (
                        <a
                          href={media.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-xs mt-1 inline-block"
                        >
                          View Resource →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamp */}
            {rec.timestamp && (
              <div className="text-xs text-gray-500 border-t pt-3 mt-4">
                Generated: {new Date(rec.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  )
}

export default RecommendationDisplay
