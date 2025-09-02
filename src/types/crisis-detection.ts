export interface CrisisDetectionResponse {
  assessment: {
    overallRisk: 'none' | 'low' | 'moderate' | 'high' | 'imminent';
    suicidalIdeation: {
      present: boolean;
      severity: 'passive' | 'active' | 'with_plan' | 'with_intent';
    };
    selfHarm: {
      present: boolean;
      risk: 'low' | 'moderate' | 'high';
      frequency: 'rare' | 'occasional' | 'frequent' | 'daily';
    };
    agitation: {
      present: boolean;
      controllable: boolean;
      severity: 'mild' | 'moderate' | 'severe';
    };
    substanceUse: {
      present: boolean;
      acute: boolean;
      impairment: 'none' | 'mild' | 'moderate' | 'severe';
    };
  };
  riskFactors: {
    factor: string;
    confidence: number;
  }[];
  protectiveFactors: {
    factor: string;
    confidence: number;
  }[];
  recommendations: {
    immediate: {
      action: string;
      priority: 'high' | 'medium' | 'low';
    }[];
  };
  resources: {
    crisis: {
      name: string;
      contact: string;
      specialization: string[];
      availability: string;
    }[];
  };
  metadata: {
    confidenceScore: number;
  };
}
