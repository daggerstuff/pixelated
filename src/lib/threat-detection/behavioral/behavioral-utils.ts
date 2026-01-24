export const detectAnomalies = () => [];
export const calculateBehavioralScore = () => 0;
export const extractBehavioralFeatures = () => ({ loginFrequency: 1, logoutFrequency: 1, dataAccessFrequency: 1, uniqueIPs: 1, uniqueEndpoints: 1 });
export const normalizeBehavioralData = (d: any) => d;
export const detectPatternChanges = () => ({ loginChange: {}, dataAccessChange: {}, newPatterns: {} });
export const getBehavioralInsights = () => ({ riskLevel: 'low', recommendations: [], activityLevel: 'low', typicalBehavior: {} });
