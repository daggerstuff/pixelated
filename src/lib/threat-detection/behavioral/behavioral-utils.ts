
export const detectAnomalies = (profile: any, current: any) => {
    const anomalies = []

    // Check IP Anomaly
    const ip = current.metadata?.ip || current.sourceIp
    if (ip && profile.typicalIPs && !profile.typicalIPs.includes(ip)) {
        anomalies.push({ type: 'unusual_ip' })
    }

    // Check Time Anomaly
    let hour = current.metadata?.hour
    if (hour === undefined && current.timestamp) {
        hour = new Date(current.timestamp).getHours()
    }

    if (hour !== undefined && profile.typicalLoginHours && !profile.typicalLoginHours.includes(hour)) {
        anomalies.push({ type: 'unusual_time' })
    }

    return anomalies
};

export const calculateBehavioralScore = (profile: any, current: any) => {
    const anomalies = detectAnomalies(profile, current);
    // Base score is 1.0, each anomaly reduces it
    const score = 1.0 - (anomalies.length * 0.2);
    return Math.max(0, Math.min(1, score));
};

export const extractBehavioralFeatures = (data: any[]) => {
    const loginEvents = data.filter(e => e.action === 'login' || e.eventType === 'login');
    const logoutEvents = data.filter(e => e.action === 'logout' || e.eventType === 'logout');
    const dataAccessEvents = data.filter(e => e.action === 'data_access' || e.eventType === 'data_access');

    const ips = new Set(data.map(e => e.metadata?.ip || e.sourceIp).filter(Boolean));
    const endpoints = new Set(data.map(e => e.metadata?.endpoint || e.endpoint).filter(Boolean));

    return {
        loginFrequency: loginEvents.length,
        logoutFrequency: logoutEvents.length,
        dataAccessFrequency: dataAccessEvents.length,
        uniqueIPs: ips.size,
        uniqueEndpoints: endpoints.size
    };
};

export const normalizeBehavioralData = (data: any) => {
    return {
        loginFrequency: Math.min((data.loginFrequency || 0) / 20, 1),
        sessionDuration: Math.min((data.sessionDuration || 0) / 3600, 1),
        requestPatterns: {
            avgRequestsPerHour: Math.min((data.requestPatterns?.avgRequestsPerHour || 0) / 100, 1),
        },
        uniqueIPs: Math.min((data.uniqueIPs || 0) / 5, 1),
        uniqueEndpoints: Math.min((data.uniqueEndpoints || 0) / 50, 1)
    };
};

export const detectPatternChanges = (historical: any[], current: any[]) => {
    const histFeatures = extractBehavioralFeatures(historical);
    const currFeatures = extractBehavioralFeatures(current);

    const significant = Math.abs(currFeatures.loginFrequency - histFeatures.loginFrequency) > 2;

    return {
        loginChange: { significant, delta: currFeatures.loginFrequency - histFeatures.loginFrequency },
        dataAccessChange: { delta: currFeatures.dataAccessFrequency - histFeatures.dataAccessFrequency },
        newPatterns: {}
    };
};

export const getBehavioralInsights = (profile: any) => {
    const avgRequests = profile.requestPatterns?.avgRequestsPerHour || 0;
    const riskLevel = avgRequests > 50 ? 'high' : avgRequests > 20 ? 'medium' : 'low';

    return {
        riskLevel,
        recommendations: riskLevel !== 'low' ? ['Monitor session activity', 'Enable MFA'] : [],
        activityLevel: avgRequests > 30 ? 'high' : 'normal',
        typicalBehavior: {
            peakHours: profile.timePatterns?.peakHours || []
        }
    };
};
