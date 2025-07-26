// This file contains only static cognitive model definitions for demonstration and testing purposes.
// No actual PHI (Protected Health Information) is processed or handled at runtime in this file.
// Therefore, HIPAA audit logging is not required here.
// If this file is ever used to process real PHI, audit logging must be implemented as per HIPAA compliance.
import type { CognitiveModel } from '@/lib/ai/types/CognitiveModel'

export const sampleCognitiveModels: CognitiveModel[] = [
  {
    id: 'depression-model',
    name: 'Sarah',
    demographicInfo: {
      age: 34,
      gender: 'Female',
      occupation: 'Marketing Manager',
      familyStatus: 'Single',
      culturalFactors: ['Western', 'Urban'],
    },
    presentingIssues: [
      'Depression',
      'Low self-esteem',
      'Work stress',
      'Insomnia',
    ],
    diagnosisInfo: {
      primaryDiagnosis: 'Major Depressive Disorder',
      secondaryDiagnoses: ['Generalized Anxiety Disorder'],
      durationOfSymptoms: '8 months',
      severity: 'moderate',
    },
    coreBeliefs: [
      {
        belief: "I'm not good enough",
        strength: 8,
        evidence: [
          'Got passed over for promotion last year',
          'Previous relationship ended after 2 years',
          'Parents frequently criticized academic performance',
        ],
        formationContext:
          'Developed during childhood from parental criticism and academic pressure',
        relatedDomains: ['work', 'relationships', 'self-worth'],
      },
      {
        belief: "I'm a burden to others",
        strength: 7,
        evidence: [
          'Friends seemed annoyed when I needed support',
          'Team members have to help with my work when I fall behind',
          'My sister had to drive me to appointments during difficult period',
        ],
        formationContext:
          'Reinforced during major depressive episode last year',
        relatedDomains: ['relationships', 'social', 'family'],
      },
      {
        belief: "I'll never succeed at anything important",
        strength: 9,
        evidence: [
          'Failed to complete MBA program',
          "Haven't received promotion in current role",
          'Failed at maintaining long-term relationship',
        ],
        formationContext: 'College experiences of academic challenges',
        relatedDomains: ['career', 'achievement', 'future'],
      },
    ],
    distortionPatterns: [
      {
        type: 'Catastrophizing',
        examples: [
          "If I make a mistake on this presentation, I'll definitely get fired",
          'If I show any weakness at work, everyone will lose respect for me immediately',
          'This headache probably means I have a serious illness',
        ],
        triggerThemes: [
          'work pressure',
          'evaluation',
          'health concerns',
          'mistakes',
        ],
        frequency: 'frequent',
      },
      {
        type: 'Mind Reading',
        examples: [
          "My boss thinks I'm incompetent",
          "My coworkers don't want me on their team",
          "My date didn't call because they thought I was boring",
        ],
        triggerThemes: [
          'social situations',
          'workplace interactions',
          'relationships',
        ],
        frequency: 'frequent',
      },
      {
        type: 'Disqualifying the Positive',
        examples: [
          'They only complimented my work to be nice',
          'I only got the project because no one else was available',
          "They're just saying that to make me feel better",
        ],
        triggerThemes: ['praise', 'recognition', 'success'],
        frequency: 'pervasive',
      },
    ],
    behavioralPatterns: [
      {
        trigger: 'Work deadlines approaching',
        response: 'Procrastination followed by late nights, reducing sleep',
        reinforcers: [
          'Short-term anxiety reduction',
          'Avoiding facing potential failure',
        ],
        consequences: [
          'Increased stress',
          'Poor quality work',
          'Physical exhaustion',
        ],
        alternateTried: ['Setting earlier personal deadlines'],
      },
      {
        trigger: 'Social invitations',
        response: 'Making excuses to cancel at last minute',
        reinforcers: [
          'Avoiding potential social judgment',
          'Short-term anxiety relief',
        ],
        consequences: [
          'Increasing isolation',
          'Loss of friendships',
          'Reinforces belief of being unlikeable',
        ],
        alternateTried: ['Committed to shorter events'],
      },
      {
        trigger: 'Criticism at work',
        response: 'Overworking to prove worth, neglecting personal needs',
        reinforcers: ['Temporary sense of control', 'Avoid rejection'],
        consequences: [
          'Burnout',
          'Reduced life satisfaction',
          'Reinforces worth tied to productivity',
        ],
        alternateTried: ['Asking for clarification on criticism'],
      },
    ],
    emotionalPatterns: [
      {
        emotion: 'Sadness',
        intensity: 8,
        triggers: [
          'Being alone on weekends',
          'Seeing social media posts of friends',
          'Family gatherings',
        ],
        physicalManifestations: [
          'Tightness in chest',
          'Tearfulness',
          'Low energy',
        ],
        copingMechanisms: [
          'Sleeping',
          'Isolating further',
          'Binge watching TV',
        ],
      },
      {
        emotion: 'Anxiety',
        intensity: 7,
        triggers: [
          'Performance reviews',
          'Deadlines',
          'Team meetings',
          'Dating',
        ],
        physicalManifestations: [
          'Racing heart',
          'Shallow breathing',
          'Tension headaches',
        ],
        copingMechanisms: ['Avoidance', 'Procrastination', 'Perfectionism'],
      },
      {
        emotion: 'Shame',
        intensity: 9,
        triggers: [
          'Making mistakes',
          'Asking for help',
          'Talking about feelings',
        ],
        physicalManifestations: [
          'Flushing',
          'Avoiding eye contact',
          'Hunched posture',
        ],
        copingMechanisms: ['Self-criticism', 'Withdrawing', 'Overcompensation'],
      },
    ],
    relationshipPatterns: [
      {
        type: 'Romantic',
        expectations: [
          'Partner will eventually find my flaws and leave',
          'I need to be perfect to be lovable',
        ],
        fears: ['Abandonment', 'Being vulnerable', 'Being controlled'],
        behaviors: [
          'Emotional distancing',
          'Testing relationship',
          'Difficulty expressing needs',
        ],
        historicalOutcomes: [
          'Series of relationships ending after 1-2 years',
          'Partners complaining about emotional walls',
        ],
      },
      {
        type: 'Friendships',
        expectations: [
          "I'm a burden when I share problems",
          'Friends prefer others over me',
        ],
        fears: ['Rejection', 'Being judged', 'Being a burden'],
        behaviors: [
          'Providing support but rarely asking for it',
          'Cancelling plans often',
          'Difficulty with closeness',
        ],
        historicalOutcomes: [
          'Superficial friendships',
          'Decreasing social circle',
          'Friends eventually giving up',
        ],
      },
      {
        type: 'Professional',
        expectations: [
          "Colleagues will find out I'm incompetent",
          'Authority figures will be critical',
        ],
        fears: ['Failure', 'Criticism', 'Exposure as inadequate'],
        behaviors: [
          'Overworking',
          'Reluctance to speak in meetings',
          'Difficulty delegating',
        ],
        historicalOutcomes: [
          'Burnout in previous positions',
          'Limited career advancement despite capabilities',
        ],
      },
    ],
    formativeExperiences: [
      {
        age: 9,
        event: "Parents' divorce",
        impact: 'Lost stable home environment and frequent contact with father',
        beliefsFormed: [
          "Relationships don't last",
          "I wasn't important enough for dad to stay",
        ],
        emotionalResponse: 'Abandonment and confusion',
      },
      {
        age: 13,
        event: 'Academic struggles after changing to competitive school',
        impact:
          'Lost confidence in academic abilities, began defining worth through achievement',
        beliefsFormed: [
          "I'm not smart enough",
          'I have to work harder than others to be acceptable',
        ],
        emotionalResponse: 'Shame and inadequacy',
      },
      {
        age: 24,
        event: 'First serious relationship ended after partner cheated',
        impact:
          'Developed trust issues and fear of vulnerability in relationships',
        beliefsFormed: [
          "I'm not enough to keep someone faithful",
          'Getting close leads to pain',
        ],
        emotionalResponse: 'Betrayal and worthlessness',
      },
    ],
    therapyHistory: {
      previousApproaches: [
        'CBT briefly in college',
        'Self-help books',
        'Medication (SSRIs)',
      ],
      helpfulInterventions: [
        'Medication reduced worst depressive symptoms',
        'Activity scheduling helped with isolation',
      ],
      unhelpfulInterventions: [
        'Generic positive affirmations',
        "Advice to 'just be more social'",
      ],
      insights: [
        'Recognize connection between perfectionism and family expectations',
        'Awareness of avoidance patterns',
      ],
      progressMade:
        'Some reduction in worst depressive episodes, better at recognizing negative thought patterns',
      remainingChallenges: [
        'Difficulty implementing cognitive strategies when stressed',
        'Self-worth still tied to achievement',
        'Avoidance patterns in relationships',
      ],
    },
    conversationalStyle: {
      verbosity: 6,
      emotionalExpressiveness: 4,
      resistance: 6,
      insightLevel: 7,
      preferredCommunicationModes: [
        'Intellectual discussion',
        'Metaphors',
        'Practical examples',
      ],
    },
    goalsForTherapy: [
      'Reduce depressive episodes',
      'Develop healthier work-life balance',
      'Improve ability to maintain close relationships',
      'Find sources of self-worth beyond achievement',
    ],
    therapeuticProgress: {
      insights: [
        {
          belief: "I'm not good enough",
          insight: 'Recognizing this comes from childhood criticism',
          dateAchieved: '2024-08-15',
        },
      ],
      resistanceLevel: 6,
      changeReadiness: 'contemplation',
      sessionProgressLog: [
        {
          sessionNumber: 1,
          keyInsights: ['Identified pattern of avoidance in social situations'],
          resistanceShift: 0,
        },
        {
          sessionNumber: 2,
          keyInsights: ['Connected perfectionism to parental expectations'],
          resistanceShift: -1,
        },
      ],
      trustLevel: 5,
      rapportScore: 5,
      therapistPerception: 'neutral',
      transferenceState: 'none',
      skillsAcquired: [
        'Basic thought challenging',
        'Activity scheduling',
        'Mindfulness techniques'
      ],
    },
  },

  {
    id: 'anxiety-model',
    name: 'Mark',
    demographicInfo: {
      age: 29,
      gender: 'Male',
      occupation: 'Software Developer',
      familyStatus: 'Married',
      culturalFactors: ['Asian American', 'First-generation immigrant'],
    },
    presentingIssues: [
      'Generalized anxiety',
      'Panic attacks',
      'Social avoidance',
      'Perfectionism',
    ],
    diagnosisInfo: {
      primaryDiagnosis: 'Generalized Anxiety Disorder',
      secondaryDiagnoses: ['Panic Disorder', 'Social Anxiety Features'],
      durationOfSymptoms: '5 years, worsening last 18 months',
      severity: 'severe',
    },
    coreBeliefs: [
      {
        belief: "I'm always in danger",
        strength: 8,
        evidence: [
          'Had a panic attack on the subway and thought I was dying',
          'Coworker was let go suddenly, could happen to me too',
          'News constantly showing terrible things happening to people',
        ],
        formationContext:
          "Father's frequent warnings about dangers in the world",
        relatedDomains: ['safety', 'health', 'uncertainty'],
      },
      {
        belief: "If I'm not perfect, I'm a failure",
        strength: 9,
        evidence: [
          'Parents always emphasized being the best in school',
          'Got feedback about minor bugs in code review',
          "Wife seemed disappointed when I couldn't fix household problem",
        ],
        formationContext:
          'High-achieving family with strong educational emphasis',
        relatedDomains: ['work', 'competence', 'family expectations'],
      },
      {
        belief: "I can't handle uncertainty",
        strength: 9,
        evidence: [
          'Became extremely anxious when project deadlines changed',
          'Panic when traveling without detailed itinerary',
          'Struggle with unexpected changes to routine',
        ],
        formationContext:
          'Highly structured childhood with emphasis on planning',
        relatedDomains: ['control', 'future', 'planning'],
      },
    ],
    distortionPatterns: [
      {
        type: 'Catastrophizing',
        examples: [
          "This chest pain probably means I'm having a heart attack",
          "If I make a mistake on this code, the entire system will crash and I'll be fired",
          "If I'm late to this meeting, my career at this company is over",
        ],
        triggerThemes: [
          'physical sensations',
          'work responsibilities',
          'social obligations',
        ],
        frequency: 'pervasive',
      },
      {
        type: 'Fortune Telling',
        examples: [
          'This project is going to fail',
          "I'll definitely have a panic attack if I go to that party",
          'My manager will be disappointed with my performance review',
        ],
        triggerThemes: [
          'future events',
          'social gatherings',
          'performance evaluations',
        ],
        frequency: 'frequent',
      },
      {
        type: 'Black and White Thinking',
        examples: [
          "Either my code is perfect or it's worthless",
          "If I'm not the top performer, I'm failing",
          'People either completely accept me or completely reject me',
        ],
        triggerThemes: [
          'work performance',
          'social acceptance',
          'personal standards',
        ],
        frequency: 'frequent',
      },
    ],
    behavioralPatterns: [
      {
        trigger: 'Deadline approaching',
        response:
          'Excessive checking and rechecking work, staying extremely late',
        reinforcers: ['Temporary reduction in anxiety', 'Feeling of control'],
        consequences: [
          'Exhaustion',
          'Reduced productivity',
          'Strain on marriage',
        ],
        alternateTried: ['Setting time limits for review'],
      },
      {
        trigger: 'Social events',
        response: 'Making excuses to avoid attending or leaving very early',
        reinforcers: [
          'Immediate anxiety relief',
          'Avoiding perceived judgment',
        ],
        consequences: [
          'Limited networking opportunities',
          'Reduced friendships',
          'Reputation as antisocial',
        ],
        alternateTried: ['Attending with supportive spouse'],
      },
      {
        trigger: 'Physical sensations (rapid heartbeat, dizziness)',
        response:
          'Checking vitals, researching symptoms online, seeking medical reassurance',
        reinforcers: [
          'Temporary relief from health anxiety',
          'Feeling of taking action',
        ],
        consequences: [
          'Increased health focus',
          'Multiple unnecessary doctor visits',
          'Reinforced anxiety cycle',
        ],
        alternateTried: ['Deep breathing', 'Distraction techniques'],
      },
    ],
    emotionalPatterns: [
      {
        emotion: 'Anxiety',
        intensity: 9,
        triggers: [
          'Deadlines',
          'Meetings with leadership',
          'Health-related news',
          'Social invitations',
        ],
        physicalManifestations: [
          'Rapid heartbeat',
          'Sweating',
          'Shortness of breath',
          'Trembling',
        ],
        copingMechanisms: [
          'Avoidance',
          'Overpreparing',
          'Seeking reassurance',
          'Medication',
        ],
      },
      {
        emotion: 'Guilt',
        intensity: 7,
        triggers: [
          'Taking time off work',
          'Saying no to requests',
          'Not meeting personal standards',
        ],
        physicalManifestations: [
          'Stomach tightness',
          'Hunched posture',
          'Difficulty sleeping',
        ],
        copingMechanisms: [
          'Overcompensating',
          'Apologizing excessively',
          'Working longer hours',
        ],
      },
      {
        emotion: 'Frustration',
        intensity: 8,
        triggers: [
          'Technology not working',
          'Unclear instructions',
          'Changes to plans',
        ],
        physicalManifestations: [
          'Muscle tension',
          'Headaches',
          'Jaw clenching',
        ],
        copingMechanisms: [
          'Controlling environment',
          'Creating detailed plans',
          'Isolation',
        ],
      },
    ],
    relationshipPatterns: [
      {
        type: 'Marital',
        expectations: [
          'My spouse should help reduce my anxiety',
          "I need to be the 'provider' and problem-solver",
        ],
        fears: [
          'Being a burden',
          "Not meeting wife's expectations",
          'Being seen as weak',
        ],
        behaviors: [
          'Hiding anxiety symptoms',
          'Withdrawing when stressed',
          'Working late to avoid discussions',
        ],
        historicalOutcomes: [
          'Wife feels shut out',
          'Communication problems',
          'Missing family events due to work',
        ],
      },
      {
        type: 'Professional',
        expectations: [
          'Colleagues will lose respect if I show anxiety',
          'I must handle everything independently',
        ],
        fears: [
          'Being exposed as incompetent',
          'Rejection by team',
          'Being seen as unstable',
        ],
        behaviors: [
          'Not asking for help',
          'Overworking',
          'Minimal participation in team social events',
        ],
        historicalOutcomes: [
          'Limited career advancement despite technical skills',
          'Viewed as competent but distant',
        ],
      },
      {
        type: 'Family',
        expectations: [
          "I should live up to family's academic/career expectations",
          'Showing anxiety disappoints parents',
        ],
        fears: [
          'Disappointing parents',
          'Being compared unfavorably to relatives',
          'Perceived as weak',
        ],
        behaviors: [
          'Discussing only achievements',
          'Avoiding family gatherings during high-stress periods',
        ],
        historicalOutcomes: [
          'Superficial relationships with extended family',
          'Parents unaware of anxiety struggles',
        ],
      },
    ],
    formativeExperiences: [
      {
        age: 10,
        event: 'Moved to United States from overseas',
        impact:
          'Lost familiar environment and friend group, had to adapt to new language and culture',
        beliefsFormed: [
          'The world is unpredictable and unsafe',
          'I have to work harder than others to fit in',
        ],
        emotionalResponse: 'Fear and isolation',
      },
      {
        age: 15,
        event: 'Father lost job and family experienced financial instability',
        impact:
          'Family stress, pressure to succeed academically to ensure future stability',
        beliefsFormed: [
          'Financial and job security can disappear at any time',
          'My academic success is crucial to family wellbeing',
        ],
        emotionalResponse: 'Anxiety and responsibility',
      },
      {
        age: 23,
        event:
          'Experienced first major panic attack during graduate school presentation',
        impact:
          'Developed fear of public speaking and social situations where escape might be difficult',
        beliefsFormed: [
          'My body will betray me in important moments',
          'Others will see my weakness and judge me',
        ],
        emotionalResponse: 'Shame and fear',
      },
    ],
    therapyHistory: {
      previousApproaches: [
        'Medication (SSRIs, benzodiazepines)',
        'Brief counseling through EAP',
      ],
      helpfulInterventions: [
        'Medication reduced intensity of panic attacks',
        'Learning about anxiety physiology',
      ],
      unhelpfulInterventions: [
        "Being told to 'just relax'",
        'Meditation alone without other skills',
      ],
      insights: [
        "Recognition of perfectionism's role in maintaining anxiety",
        'Understanding of physical stress responses',
      ],
      progressMade:
        'Better management of panic attacks, some reduction in avoidance behaviors',
      remainingChallenges: [
        'Persistent worry',
        'Difficulty with work-life balance',
        'Social anxiety in professional settings',
      ],
    },
    conversationalStyle: {
      verbosity: 5,
      emotionalExpressiveness: 3,
      resistance: 7,
      insightLevel: 8,
      preferredCommunicationModes: [
        'Logical analysis',
        'Problem-solving',
        'Concrete examples',
      ],
    },
    goalsForTherapy: [
      'Reduce frequency and intensity of panic attacks',
      'Develop tools to manage worry thoughts',
      'Improve work-life balance',
      'Build comfort in social professional settings',
    ],
    therapeuticProgress: {
      insights: [
        {
          belief: "I'm always in danger",
          insight: 'Recognizing anxiety creates danger-focused thinking',
          dateAchieved: '2024-09-02',
        },
      ],
      resistanceLevel: 7,
      changeReadiness: 'contemplation',
      sessionProgressLog: [
        {
          sessionNumber: 1,
          keyInsights: [
            'Identified connection between perfectionism and anxiety',
          ],
          resistanceShift: 0,
        },
        {
          sessionNumber: 2,
          keyInsights: ['Practiced basic breathing techniques'],
          resistanceShift: -1,
        },
      ],
      trustLevel: 6, // Slightly higher start for someone actively seeking help for severe anxiety
      rapportScore: 5,
      therapistPerception: 'neutral',
      transferenceState: 'none',
      skillsAcquired: [
        'Deep breathing',
        'Progressive muscle relaxation',
        'Basic cognitive restructuring'
      ],
    },
  },

  {
    id: 'trauma-model',
    name: 'Elena',
    demographicInfo: {
      age: 42,
      gender: 'Female',
      occupation: 'Elementary School Teacher',
      familyStatus: 'Divorced, two children (ages 12 and 15)',
      culturalFactors: ['Hispanic', 'Catholic background'],
    },
    presentingIssues: [
      'PTSD symptoms',
      'Nightmares',
      'Hypervigilance',
      'Emotional numbing',
      'Sleep disturbance',
    ],
    diagnosisInfo: {
      primaryDiagnosis: 'Post-Traumatic Stress Disorder',
      secondaryDiagnoses: ['Major Depressive Disorder - Moderate'],
      durationOfSymptoms: '3 years since major trauma, lifelong adversity',
      severity: 'moderate',
    },
    coreBeliefs: [
      {
        belief: 'The world is dangerous',
        strength: 9,
        evidence: [
          'Home invasion 3 years ago',
          'Abusive marriage for 8 years',
          'Childhood neighborhood was high-crime',
          'News of school shootings',
        ],
        formationContext:
          'Traumatic experiences throughout life reinforced by recent trauma',
        relatedDomains: ['safety', 'home', 'trust'],
      },
      {
        belief: 'I have to be on guard at all times',
        strength: 8,
        evidence: [
          "Didn't notice warning signs before ex-husband became abusive",
          "Didn't hear intruder enter home during invasion",
          'Childhood household was unpredictable',
        ],
        formationContext:
          'Learned in childhood that danger can appear suddenly',
        relatedDomains: ['safety', 'control', 'awareness'],
      },
      {
        belief: 'I am damaged by what happened to me',
        strength: 7,
        evidence: [
          "Can't sleep without medication",
          'Relationships have suffered',
          'Children have seen me have panic attacks',
          "Can't enjoy things I used to",
        ],
        formationContext:
          "Developed after home invasion trauma when symptoms didn't improve with time",
        relatedDomains: ['self-concept', 'future', 'healing'],
      },
    ],
    distortionPatterns: [
      {
        type: 'Hypervigilance',
        examples: [
          'Checking the locks multiple times every night',
          'Feeling startled by normal sounds in the house',
          'Constantly scanning for threats in public places',
        ],
        triggerThemes: [
          'safety concerns',
          'unexpected noises',
          'being alone',
          'nighttime',
        ],
        frequency: 'pervasive',
      },
      {
        type: 'Catastrophizing',
        examples: [
          'If I hear a noise at night, it must be an intruder',
          "My children aren't answering their phones because something terrible happened",
          'These physical symptoms probably mean I have a serious illness',
        ],
        triggerThemes: [
          'uncertainty',
          "children's safety",
          'physical sensations',
        ],
        frequency: 'frequent',
      },
      {
        type: 'Overgeneralization',
        examples: [
          "I'll never feel safe again",
          'No one can be trusted completely',
          'Danger is everywhere',
        ],
        triggerThemes: ['security', 'trust', 'future planning'],
        frequency: 'frequent',
      },
    ],
    behavioralPatterns: [
      {
        trigger: 'Being alone at home, especially at night',
        response:
          'Excessive checking of doors/windows, keeping lights on, having phone ready',
        reinforcers: ['Temporary reduction in anxiety', 'Sense of control'],
        consequences: [
          'Sleep disruption',
          'Increased hypervigilance',
          'High utility bills',
        ],
        alternateTried: ['Getting a security system'],
      },
      {
        trigger:
          'Reminders of trauma (news stories, sounds similar to break-in)',
        response:
          'Emotional shutdown, distancing from others, keeping busy with tasks',
        reinforcers: ['Avoids overwhelming emotions', 'Maintains functioning'],
        consequences: [
          'Emotional numbness',
          'Disconnection from children',
          'Exhaustion',
        ],
        alternateTried: ['Brief counseling after trauma'],
      },
      {
        trigger: 'Children going out with friends or to school',
        response:
          'Excessive checking in, difficulty concentrating until they return',
        reinforcers: [
          'Momentary relief when children respond',
          'Feeling like a protective parent',
        ],
        consequences: [
          'Children feel smothered',
          'Inability to focus on work',
          'Reinforces hypervigilance',
        ],
        alternateTried: ['Using family location app'],
      },
    ],
    emotionalPatterns: [
      {
        emotion: 'Fear',
        intensity: 9,
        triggers: [
          'Unexpected noises',
          'Being alone',
          'Children being away from home',
          'Darkness',
        ],
        physicalManifestations: [
          'Racing heart',
          'Sweating',
          'Muscle tension',
          'Shallow breathing',
        ],
        copingMechanisms: [
          'Checking behaviors',
          'Avoidance',
          'Distraction through work',
          'Prayer',
        ],
      },
      {
        emotion: 'Numbness',
        intensity: 7,
        triggers: [
          'Overwhelming situations',
          'Direct questions about trauma',
          'Intimate relationships',
        ],
        physicalManifestations: [
          'Feeling disconnected from body',
          'Fatigue',
          'Blank facial expression',
        ],
        copingMechanisms: [
          'Keeping busy',
          "Focus on children's needs",
          'Isolation',
        ],
      },
      {
        emotion: 'Anger',
        intensity: 8,
        triggers: [
          'Feeling vulnerable',
          'Reminders of ex-husband',
          'Perceived system failures',
        ],
        physicalManifestations: [
          'Tension headaches',
          'Jaw clenching',
          'Stomach problems',
        ],
        copingMechanisms: [
          'Suppression',
          'Redirecting to protective actions',
          'Physical activity',
        ],
      },
    ],
    relationshipPatterns: [
      {
        type: 'Parental',
        expectations: [
          'I must protect my children from all dangers',
          'I should hide my struggles to avoid burdening them',
        ],
        fears: [
          'Failing to keep children safe',
          'Damaging children through my trauma responses',
          'Children experiencing trauma',
        ],
        behaviors: [
          'Overprotective restrictions',
          'Checking behaviors',
          "Difficulty with children's independence",
        ],
        historicalOutcomes: [
          'Growing tension with teenage children',
          'Children becoming secretive',
          'Difficulty balancing protection and autonomy',
        ],
      },
      {
        type: 'Romantic',
        expectations: [
          'Potential partners will eventually become controlling like ex-husband',
          'Vulnerability leads to harm',
        ],
        fears: ['Being trapped again', 'Being hurt', 'Losing independence'],
        behaviors: [
          'Avoiding dating',
          'Ending relationships when they become serious',
          'Keeping emotional distance',
        ],
        historicalOutcomes: [
          'Few relationships since divorce',
          'Brief connections that end when closeness develops',
        ],
      },
      {
        type: 'Professional/Collegial',
        expectations: [
          'I must appear completely composed and functional',
          "Colleagues wouldn't understand my struggles",
        ],
        fears: ['Being seen as unstable', 'Loss of respect', 'Pity'],
        behaviors: [
          'Maintaining professional facade despite struggles',
          'Limited personal sharing',
          'Focusing conversations on work or others',
        ],
        historicalOutcomes: [
          'Respected but not truly known by colleagues',
          'Support system limited to 1-2 trusted coworkers',
        ],
      },
    ],
    formativeExperiences: [
      {
        age: 7,
        event: 'Witnessed domestic violence between parents',
        impact:
          'Learned home could be unsafe, developed hypervigilance to sense danger',
        beliefsFormed: [
          'Conflict can turn violent suddenly',
          'I need to stay alert for signs of danger',
        ],
        emotionalResponse: 'Fear and helplessness',
      },
      {
        age: 'Mid-20s to early 30s',
        event: 'Progressively abusive marriage',
        impact:
          "Eroded self-confidence, reinforced belief in world's danger, developed coping through emotional suppression",
        beliefsFormed: [
          "I can't trust my judgment about people",
          'Showing vulnerability leads to being hurt',
        ],
        emotionalResponse: 'Shame, fear, and eventual emotional numbing',
      },
      {
        age: 39,
        event: 'Home invasion while children were present',
        impact:
          'Triggered acute PTSD symptoms, shattered sense of safety in own home',
        beliefsFormed: [
          'Nowhere is truly safe',
          'I failed to protect my children',
          'I am permanently damaged',
        ],
        emotionalResponse: 'Terror, helplessness, and guilt',
      },
    ],
    therapyHistory: {
      previousApproaches: [
        'Crisis counseling after home invasion',
        'Brief trauma-focused therapy (discontinued)',
        'Medication (sleep aids and SSRIs)',
      ],
      helpfulInterventions: [
        'Medication for sleep',
        'Practical safety planning',
        'School counseling for children',
      ],
      unhelpfulInterventions: [
        'Exposure techniques attempted too early',
        'Group therapy felt overwhelming',
      ],
      insights: [
        'Recognition of hypervigilance pattern',
        'Understanding connection between past trauma and current responses',
      ],
      progressMade:
        'Improved functioning at work, better communication with children about safety concerns',
      remainingChallenges: [
        'Persistent nightmares',
        'Difficulty with trust',
        'Continued hypervigilance',
        'Limited emotional range',
      ],
    },
    conversationalStyle: {
      verbosity: 4,
      emotionalExpressiveness: 3,
      resistance: 6,
      insightLevel: 7,
      preferredCommunicationModes: [
        'Practical discussions',
        'Storytelling',
        'Value-oriented language',
      ],
    },
    goalsForTherapy: [
      'Reduce hypervigilance and checking behaviors',
      'Improve sleep without medication',
      'Develop healthier balance between safety and living fully',
      'Process trauma memories to reduce their power',
      'Rebuild capacity for joy and connection',
    ],
    therapeuticProgress: {
      insights: [
        {
          belief: 'The world is dangerous',
          insight: 'Differentiating between real and perceived dangers',
          dateAchieved: '2024-07-28',
        },
      ],
      resistanceLevel: 6,
      changeReadiness: 'preparation',
      sessionProgressLog: [
        {
          sessionNumber: 1,
          keyInsights: ['Established safety in therapeutic relationship'],
          resistanceShift: 0,
        },
        {
          sessionNumber: 2,
          keyInsights: ['Identified triggers for hypervigilance'],
          resistanceShift: -1,
        },
        {
          sessionNumber: 3,
          keyInsights: ['Connected current responses to past experiences'],
          resistanceShift: -1,
        },
      ],
      trustLevel: 4, // Lower start due to trauma history and trust issues
      rapportScore: 4,
      therapistPerception: 'neutral',
      transferenceState: 'none',
      skillsAcquired: [
        'Grounding techniques',
        'Safety planning',
        'Basic emotional regulation'
      ],
    },
  },
]

export default sampleCognitiveModels
