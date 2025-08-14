import type { APIRoute, APIContext } from 'astro'
export const prerender = false

export interface ChatRequest {
  message: string
  sessionId?: string
  userContext?: {
    userId?: string
    previousMessages?: ChatMessage[]
    riskLevel?: 'low' | 'moderate' | 'high'
    preferences?: {
      communicationStyle?: 'supportive' | 'direct' | 'cognitive' | 'behavioral'
      culturalBackground?: string
      triggerWords?: string[]
    }
  }
  options?: {
    includeRiskAssessment?: boolean
    includeCopingStrategies?: boolean
    enableCrisisDetection?: boolean
    responseStyle?: 'therapeutic' | 'psychoeducational' | 'supportive'
  }
}

export interface ChatResponse {
  response: {
    message: string
    type: 'supportive' | 'psychoeducational' | 'coping_strategy' | 'crisis_intervention' | 'referral'
    confidence: number
    sessionId: string
  }
  analysis: {
    sentimentScore: number // -1 to 1
    emotionalState: string
    stressLevel: 'low' | 'moderate' | 'high' | 'crisis'
    keyTopics: string[]
    concernSeverity: number // 1-10
  }
  riskAssessment?: {
    suicidalIdeation: boolean
    selfHarmIndicators: boolean
    crisisLevel: 'none' | 'low' | 'moderate' | 'high' | 'imminent'
    immediateAction: boolean
    recommendedActions: string[]
  }
  copingStrategies?: {
    immediate: CopingStrategy[]
    shortTerm: CopingStrategy[]
    longTerm: CopingStrategy[]
  }
  resources?: {
    crisisHotlines: ContactResource[]
    professionalHelp: ContactResource[]
    selfHelpResources: Resource[]
  }
  followUp: {
    checkInTime: string
    suggestedTopics: string[]
    scheduledReminders: string[]
  }
  metadata: {
    responseGenerated: string
    processingTime: number
    conversationLength: number
    flags: string[]
  }
}

export interface ChatMessage {
  id: string
  message: string
  timestamp: string
  role: 'user' | 'assistant'
  type?: string
  metadata?: Record<string, unknown>
}

export interface CopingStrategy {
  name: string
  description: string
  instructions: string[]
  duration: string
  effectiveness: 'high' | 'moderate' | 'low'
  category: 'breathing' | 'grounding' | 'cognitive' | 'behavioral' | 'social'
  suitability: string[]
}

export interface ContactResource {
  name: string
  phone: string
  website?: string
  availability: string
  specialization: string[]
  languages: string[]
}

export interface Resource {
  title: string
  type: 'article' | 'video' | 'app' | 'book' | 'worksheet'
  url?: string
  description: string
  category: string
  duration: string
}

// Crisis keywords and patterns
const CRISIS_PATTERNS = {
  suicidal: [
    /kill myself/gi, /suicide/gi, /end it all/gi, /want to die/gi, /better off dead/gi,
    /not worth living/gi, /end my life/gi, /can't go on/gi, /no point/gi
  ],
  selfHarm: [
    /cut myself/gi, /hurt myself/gi, /self harm/gi, /cutting/gi, /burning myself/gi,
    /punish myself/gi, /deserve pain/gi
  ],
  immediate: [
    /right now/gi, /tonight/gi, /today/gi, /this moment/gi, /immediately/gi,
    /can't wait/gi, /going to/gi, /will do/gi
  ]
}

const STRESS_INDICATORS = {
  high: [
    'overwhelmed', 'can\'t cope', 'breaking down', 'falling apart', 'can\'t handle',
    'too much', 'exhausted', 'burnt out', 'panicking', 'freaking out'
  ],
  moderate: [
    'stressed', 'worried', 'anxious', 'concerned', 'upset', 'frustrated',
    'difficult', 'challenging', 'struggling', 'hard time'
  ],
  low: [
    'okay', 'fine', 'managing', 'coping', 'better', 'good', 'stable',
    'improving', 'hopeful', 'positive'
  ]
}

const COPING_STRATEGIES: Record<string, CopingStrategy[]> = {
  immediate: [
    {
      name: '4-7-8 Breathing',
      description: 'Calming breathing technique to reduce anxiety',
      instructions: [
        'Breathe in through your nose for 4 counts',
        'Hold your breath for 7 counts',
        'Exhale through your mouth for 8 counts',
        'Repeat 3-4 times'
      ],
      duration: '2-3 minutes',
      effectiveness: 'high',
      category: 'breathing',
      suitability: ['anxiety', 'panic', 'stress', 'sleep issues']
    },
    {
      name: '5-4-3-2-1 Grounding',
      description: 'Sensory grounding technique for overwhelming emotions',
      instructions: [
        'Name 5 things you can see',
        'Name 4 things you can touch',
        'Name 3 things you can hear',
        'Name 2 things you can smell',
        'Name 1 thing you can taste'
      ],
      duration: '3-5 minutes',
      effectiveness: 'high',
      category: 'grounding',
      suitability: ['anxiety', 'panic', 'dissociation', 'overwhelm']
    },
    {
      name: 'Progressive Muscle Relaxation',
      description: 'Physical tension release technique',
      instructions: [
        'Tense your toes for 5 seconds, then release',
        'Work your way up through each muscle group',
        'Notice the contrast between tension and relaxation',
        'End with deep breathing'
      ],
      duration: '10-15 minutes',
      effectiveness: 'moderate',
      category: 'behavioral',
      suitability: ['stress', 'physical tension', 'sleep issues']
    }
  ],
  shortTerm: [
    {
      name: 'Thought Record',
      description: 'Identify and challenge negative thought patterns',
      instructions: [
        'Write down the troubling thought',
        'Rate your belief in it (1-10)',
        'List evidence for and against',
        'Develop a more balanced thought',
        'Re-rate your belief in the original thought'
      ],
      duration: '15-20 minutes',
      effectiveness: 'high',
      category: 'cognitive',
      suitability: ['depression', 'anxiety', 'negative thinking']
    },
    {
      name: 'Behavioral Activation',
      description: 'Schedule meaningful activities to improve mood',
      instructions: [
        'List activities that used to bring joy',
        'Choose one small activity for today',
        'Schedule it for a specific time',
        'Notice your mood before and after',
        'Gradually increase meaningful activities'
      ],
      duration: '30+ minutes',
      effectiveness: 'high',
      category: 'behavioral',
      suitability: ['depression', 'motivation', 'mood improvement']
    }
  ],
  longTerm: [
    {
      name: 'Mindfulness Meditation',
      description: 'Build emotional regulation through mindfulness practice',
      instructions: [
        'Start with 5 minutes daily',
        'Focus on breath or body sensations',
        'Notice thoughts without judgment',
        'Gently return attention when mind wanders',
        'Gradually increase duration'
      ],
      duration: '5-30 minutes daily',
      effectiveness: 'high',
      category: 'cognitive',
      suitability: ['anxiety', 'depression', 'stress management', 'emotional regulation']
    }
  ]
}

const CRISIS_RESOURCES = {
  crisisHotlines: [
    {
      name: 'National Suicide Prevention Lifeline',
      phone: '988',
      website: 'https://suicidepreventionlifeline.org',
      availability: '24/7',
      specialization: ['suicide prevention', 'crisis intervention'],
      languages: ['English', 'Spanish']
    },
    {
      name: 'Crisis Text Line',
      phone: 'Text HOME to 741741',
      website: 'https://crisistextline.org',
      availability: '24/7',
      specialization: ['crisis intervention', 'text support'],
      languages: ['English', 'Spanish']
    },
    {
      name: 'SAMHSA National Helpline',
      phone: '1-800-662-4357',
      website: 'https://samhsa.gov',
      availability: '24/7',
      specialization: ['mental health', 'substance abuse'],
      languages: ['English', 'Spanish']
    }
  ],
  professionalHelp: [
    {
      name: 'Psychology Today',
      phone: '',
      website: 'https://psychologytoday.com',
      availability: 'Varies by provider',
      specialization: ['therapist finder', 'mental health professionals'],
      languages: ['Multiple languages available']
    },
    {
      name: 'NAMI (National Alliance on Mental Illness)',
      phone: '1-800-950-6264',
      website: 'https://nami.org',
      availability: 'Monday-Friday 10am-10pm ET',
      specialization: ['mental health support', 'family support'],
      languages: ['English', 'Spanish']
    }
  ]
}

import crypto from 'crypto';

function generateSessionId(): string {
  // Use cryptographically secure random bytes for session ID
  const secureRandom = crypto.randomBytes(6).toString('hex');
  return `chat_${Date.now()}_${secureRandom}`;
}

function analyzeSentiment(message: string): number {
  const positiveWords = ['good', 'better', 'happy', 'hopeful', 'positive', 'grateful', 'thankful', 'improved', 'helping']
  const negativeWords = ['bad', 'worse', 'sad', 'hopeless', 'negative', 'terrible', 'awful', 'depressed', 'anxious']
  
  const words = message.toLowerCase().split(/\s+/)
  let score = 0
  
  words.forEach(word => {
    if (positiveWords.some(pos => word.includes(pos))) { score += 1; }
    if (negativeWords.some(neg => word.includes(neg))) { score -= 1; }
  })
  
  return Math.max(-1, Math.min(1, score / words.length * 10))
}

function assessRisk(message: string, userContext?: ChatRequest['userContext']): ChatResponse['riskAssessment'] {
  let crisisLevel: 'none' | 'low' | 'moderate' | 'high' | 'imminent' = 'none'
  let suicidalIdeation = false
  let selfHarmIndicators = false
  let immediateAction = false
  const recommendedActions: string[] = []

  // Defensive: limit message length to prevent ReDoS risk
  const safeMessage = typeof message === 'string' ? message.slice(0, 500) : '';
  const lowerSafeMessage = safeMessage.toLowerCase();
  
  // Check for suicidal ideation (ReDoS-safe: use includes)
  if (
    CRISIS_PATTERNS.suicidal.some(pattern => {
      // Convert regex to string and match as phrase
      const phrase = pattern.source.replace(/\\\w\b|\W/g, '').toLowerCase();
      return lowerSafeMessage.includes(phrase);
    })
  ) {
    suicidalIdeation = true;
    crisisLevel = 'high';
  }

  // Check for self-harm indicators (ReDoS-safe: use includes)
  if (
    CRISIS_PATTERNS.selfHarm.some(pattern => {
      const phrase = pattern.source.replace(/\\\w\b|\W/g, '').toLowerCase();
      return lowerSafeMessage.includes(phrase);
    })
  ) {
    selfHarmIndicators = true;
    if (crisisLevel === 'none') { crisisLevel = 'moderate'; }
  }

  // Check for immediate intent (ReDoS-safe: use includes)
  if (
    CRISIS_PATTERNS.immediate.some(pattern => {
      const phrase = pattern.source.replace(/\\\w\b|\W/g, '').toLowerCase();
      return lowerSafeMessage.includes(phrase);
    }) &&
    (suicidalIdeation || selfHarmIndicators)
  ) {
    crisisLevel = 'imminent';
    immediateAction = true;
  }

  // Consider user context
  if (userContext?.riskLevel === 'high') {
    crisisLevel = crisisLevel === 'none' ? 'moderate' : crisisLevel
  }

  // Generate recommendations based on risk level
  if (crisisLevel === 'imminent') {
    recommendedActions.push(
      'Contact emergency services immediately',
      'Call National Suicide Prevention Lifeline: 988',
      'Reach out to a trusted friend or family member',
      'Go to nearest emergency room'
    )
  } else if (crisisLevel === 'high') {
    recommendedActions.push(
      'Call National Suicide Prevention Lifeline: 988',
      'Contact a mental health professional',
      'Reach out to support system',
      'Consider safety planning'
    )
  } else if (crisisLevel === 'moderate') {
    recommendedActions.push(
      'Consider speaking with a counselor',
      'Use coping strategies',
      'Connect with support system',
      'Monitor mood changes'
    )
  }

  return {
    suicidalIdeation,
    selfHarmIndicators,
    crisisLevel,
    immediateAction,
    recommendedActions
  }
}

function determineStressLevel(message: string): 'low' | 'moderate' | 'high' | 'crisis' {
  const lowerMessage = message.toLowerCase()
  
  if (STRESS_INDICATORS.high.some(indicator => lowerMessage.includes(indicator))) {
    return 'high'
  }
  if (STRESS_INDICATORS.moderate.some(indicator => lowerMessage.includes(indicator))) {
    return 'moderate'
  }
  if (STRESS_INDICATORS.low.some(indicator => lowerMessage.includes(indicator))) {
    return 'low'
  }
  
  return 'moderate' // Default
}

function generateResponse(_message: string, analysis: ChatResponse['analysis'], riskAssessment?: ChatResponse['riskAssessment']): ChatResponse['response'] {
  let responseMessage: string;
  let responseType: ChatResponse['response']['type'];
  
  // Crisis response
  if (riskAssessment?.crisisLevel === 'imminent') {
    responseMessage = "I'm very concerned about what you've shared. Your safety is the most important thing right now. Please reach out for immediate help by calling 988 (National Suicide Prevention Lifeline) or going to your nearest emergency room. You don't have to go through this alone.";
    responseType = 'crisis_intervention';
  } else if (riskAssessment?.crisisLevel === 'high') {
    responseMessage = "Thank you for sharing something so difficult with me. I'm concerned about how you're feeling. Please consider reaching out to a mental health professional or calling 988 for support. In the meantime, let's work on some coping strategies together.";
    responseType = 'crisis_intervention';
  } else if (analysis.stressLevel === 'high') {
    responseMessage = "It sounds like you're going through a really challenging time right now. That level of stress can feel overwhelming. Let's focus on some immediate coping strategies that might help you feel more grounded.";
    responseType = 'coping_strategy';
  } else if (analysis.stressLevel === 'moderate') {
    responseMessage = "I hear that you're dealing with some stress and difficult feelings. It's completely normal to have ups and downs. Would you like to explore what's contributing to these feelings or work on some coping strategies?";
    responseType = 'supportive';
  } else {
    responseMessage = "Thank you for sharing with me. It sounds like you're managing things relatively well. Is there anything specific you'd like to talk about or work on today?";
    responseType = 'supportive';
  }
  
  return {
    message: responseMessage,
    type: responseType,
    confidence: 0.85,
    sessionId: generateSessionId()
  };
}

function extractKeyTopics(message: string): string[] {
  const topics: string[] = []
  const lowerMessage = message.toLowerCase()
  
  const topicKeywords = {
    anxiety: ['anxiety', 'anxious', 'worried', 'panic', 'nervous'],
    depression: ['depression', 'depressed', 'sad', 'hopeless', 'empty'],
    stress: ['stress', 'stressed', 'overwhelmed', 'pressure'],
    relationships: ['relationship', 'family', 'friends', 'partner', 'social'],
    work: ['work', 'job', 'career', 'boss', 'workplace'],
    sleep: ['sleep', 'insomnia', 'tired', 'exhausted'],
    trauma: ['trauma', 'abuse', 'ptsd', 'flashbacks']
  }
  
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      topics.push(topic)
    }
  })
  
  return topics
}

export const POST = async ({ request }: APIContext) => {
  const startTime = Date.now()
  
  try {
    const body: ChatRequest = await request.json()
    
    if (!body.message || typeof body.message !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Invalid request: message is required and must be a string' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const options = {
      includeRiskAssessment: true,
      includeCopingStrategies: true,
      enableCrisisDetection: true,
      responseStyle: 'therapeutic',
      ...body.options
    }

    // Analyze the message
    const sentimentScore = analyzeSentiment(body.message)
    const stressLevel = determineStressLevel(body.message)
    const keyTopics = extractKeyTopics(body.message)
    const concernSeverity = Math.max(1, Math.min(10, 5 + (sentimentScore * -3) + (stressLevel === 'high' ? 3 : stressLevel === 'moderate' ? 1 : 0)))
    
    const analysis: ChatResponse['analysis'] = {
      sentimentScore,
      emotionalState: sentimentScore > 0.3 ? 'positive' : sentimentScore < -0.3 ? 'negative' : 'neutral',
      stressLevel,
      keyTopics,
      concernSeverity
    }

    // Risk assessment
    const riskAssessment = options.includeRiskAssessment ? assessRisk(body.message, body.userContext) : undefined

    // Generate response
    const response = generateResponse(body.message, analysis, riskAssessment)

    // Coping strategies
    const copingStrategies = options.includeCopingStrategies ? {
      immediate: (COPING_STRATEGIES['immediate'] ?? []).filter(
         () => analysis.stressLevel === 'high' || riskAssessment?.crisisLevel !== 'none'
       ).slice(0, 2),
      shortTerm: (COPING_STRATEGIES['shortTerm'] ?? []).filter(strategy =>
        strategy.suitability.some(suit => keyTopics.includes(suit))
      ).slice(0, 2),
      longTerm: (COPING_STRATEGIES['longTerm'] ?? []).slice(0, 1)
    } : undefined

    // Resources (only if high risk or crisis)
    const resources = (riskAssessment?.crisisLevel === 'high' || riskAssessment?.crisisLevel === 'imminent') ? {
      crisisHotlines: CRISIS_RESOURCES.crisisHotlines,
      professionalHelp: CRISIS_RESOURCES.professionalHelp,
      selfHelpResources: [
        {
          title: 'Mindfulness and Meditation Apps',
          type: 'app' as const,
          description: 'Guided meditation and mindfulness exercises',
          category: 'self-help',
          duration: 'Varies'
        }
      ]
    } : undefined

    const processingTime = Date.now() - startTime
    const flags: string[] = []
    
    if (riskAssessment?.immediateAction) { flags.push('IMMEDIATE_ACTION_REQUIRED'); }
    if (riskAssessment?.crisisLevel === 'high' || riskAssessment?.crisisLevel === 'imminent') { flags.push('HIGH_RISK'); }
    if (analysis.stressLevel === 'high') { flags.push('HIGH_STRESS'); }

    const chatResponse: ChatResponse = {
      response,
      analysis,
      riskAssessment,
      copingStrategies,
      resources,
      followUp: {
        checkInTime: riskAssessment?.crisisLevel === 'imminent' ? 'Immediately' : 
                     riskAssessment?.crisisLevel === 'high' ? 'Within 24 hours' : 
                     analysis.stressLevel === 'high' ? 'Within 48 hours' : '1 week',
        suggestedTopics: keyTopics.length > 0 ? [`Continue discussing ${keyTopics[0]}`, 'Explore coping strategies'] : ['How are you feeling today?'],
        scheduledReminders: riskAssessment?.crisisLevel !== 'none' ? ['Daily check-in reminder', 'Coping strategy practice'] : []
      },
      metadata: {
        responseGenerated: new Date().toISOString(),
        processingTime,
        conversationLength: body.userContext?.previousMessages?.length || 1,
        flags
      }
    }

    return new Response(JSON.stringify(chatResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-ID': response.sessionId,
        'X-Risk-Level': riskAssessment?.crisisLevel || 'none',
        'X-Processing-Time': processingTime.toString()
      }
    })

  } catch (error) {
    console.error('Mental health chat error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error during chat processing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
