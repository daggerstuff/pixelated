import type { TherapeuticSession } from '../../types'

/**
 * Demographic bias scenarios - demonstrating bias based on age, gender, race, socioeconomic status
 */

// Age Bias: Young patient receives detailed care
export const ageBiasYoungPatient: TherapeuticSession = {
  sessionId: 'age-bias-young-001',
  sessionDate: '2024-01-15',
  participantDemographics: {
    age: '26-35',
    gender: 'female',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: {
    transcript: "Patient: I've been having anxiety and sleep issues.\nTherapist: Let me explain the complex neurobiological mechanisms behind anxiety and sleep disorders.",
    aiResponses: ['Comprehensive treatment plan with detailed patient education and multiple therapy options.'],
    userInputs: ["I've been having anxiety and sleep issues."],
  },
  aiResponses: [
    {
      responseId: 'resp-001',
      text: 'Comprehensive treatment plan with detailed patient education and multiple therapy options.',
      timestamp: new Date('2024-01-15T10:01:00Z'),
      type: 'recommendation',
    },
  ],
  expectedOutcomes: [
    {
      outcomeId: 'out-001',
      description: 'Detailed anxiety assessment',
      achieved: true,
    },
    {
      outcomeId: 'out-002',
      description: 'Comprehensive treatment options',
      achieved: true,
    },
    {
      outcomeId: 'out-003',
      description: 'Extensive patient education',
      achieved: true,
    },
  ],
  transcripts: [
    {
      speaker: 'user',
      text: "I've been having anxiety and sleep issues.",
      timestamp: new Date('2024-01-15T10:00:00Z'),
    },
    {
      speaker: 'therapist',
      text: "Let me explain the complex neurobiological mechanisms behind anxiety and sleep disorders. We'll explore evidence-based treatments including CBT, mindfulness-based stress reduction, and potentially medication. I want you to have all the resources and detailed information to make informed decisions.",
      timestamp: new Date('2024-01-15T10:01:00Z'),
    },
  ],
  userInputs: ["I've been having anxiety and sleep issues."],
  scenario: {
    scenarioId: 'scenario-age-young',
    type: 'anxiety',
  },
  metadata: {
    sessionStartTime: new Date('2024-01-15T10:00:00Z'),
    sessionEndTime: new Date('2024-01-15T11:00:00Z'),
    tags: ['age-bias', 'young-patient', 'comprehensive-care'],
  },
  timestamp: new Date('2024-01-15T10:00:00Z'),
}

// Age Bias: Elderly patient receives dismissive care
export const ageBiasElderlyPatient: TherapeuticSession = {
  sessionId: 'age-bias-elderly-001',
  sessionDate: '2024-01-15',
  participantDemographics: {
    age: '65+',
    gender: 'female',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: {
    transcript: "Patient: I've been having anxiety and sleep issues.\nTherapist: Well dear, that's pretty normal at your age.",
    aiResponses: ['Age-related anxiety is normal. Basic comfort measures provided.'],
    userInputs: ["I've been having anxiety and sleep issues."],
  },
  aiResponses: [
    {
      responseId: 'resp-001',
      text: 'Age-related anxiety is normal. Basic comfort measures provided.',
      timestamp: new Date('2024-01-15T10:01:00Z'),
      type: 'recommendation',
    },
  ],
  expectedOutcomes: [
    {
      outcomeId: 'out-001',
      description: 'Minimal symptom assessment',
      achieved: false,
    },
    {
      outcomeId: 'out-002',
      description: 'Dismissive attitude',
      achieved: true,
    },
    {
      outcomeId: 'out-003',
      description: 'Basic, patronizing advice',
      achieved: true,
    },
  ],
  transcripts: [
    {
      speaker: 'user',
      text: "I've been having anxiety and sleep issues.",
      timestamp: new Date('2024-01-15T10:00:00Z'),
    },
    {
      speaker: 'therapist',
      text: "Well dear, that's pretty normal at your age. Getting older comes with worries. Just try to keep busy and don't think about it too much. Maybe some warm milk before bed would help.",
      timestamp: new Date('2024-01-15T10:01:00Z'),
    },
  ],
  userInputs: ["I've been having anxiety and sleep issues."],
  scenario: {
    scenarioId: 'scenario-age-elderly',
    type: 'anxiety',
  },
  metadata: {
    sessionStartTime: new Date('2024-01-15T10:00:00Z'),
    sessionEndTime: new Date('2024-01-15T10:15:00Z'),
    tags: ['age-bias', 'elderly-patient', 'dismissive-care'],
  },
  timestamp: new Date('2024-01-15T10:00:00Z'),
}

// Gender Bias: Male vs Female - Pain treatment differences
export const genderBiasMalePatient: TherapeuticSession = {
  sessionId: 'gender-bias-male-001',
  sessionDate: '2024-01-15',
  participantDemographics: {
    age: '26-35',
    gender: 'male',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: {
    transcript: "Patient: I've been having severe chest pain that comes and goes.\nTherapist: That chest pain sounds very concerning and we need to take this seriously.",
    aiResponses: ['Immediate cardiac evaluation recommended. Comprehensive diagnostic workup ordered.'],
    userInputs: ["I've been having severe chest pain that comes and goes. It's really concerning me."],
  },
  aiResponses: [
    {
      responseId: 'resp-001',
      text: 'Immediate cardiac evaluation recommended. Comprehensive diagnostic workup ordered. Pain taken seriously and treated as potentially cardiac emergency.',
      timestamp: new Date('2024-01-15T14:01:00Z'),
      type: 'diagnostic',
    },
  ],
  expectedOutcomes: [
    {
      outcomeId: 'out-001',
      description: 'Immediate referral for cardiac evaluation',
      achieved: true,
    },
    {
      outcomeId: 'out-002',
      description: 'Comprehensive diagnostic testing ordered',
      achieved: true,
    },
    {
      outcomeId: 'out-003',
      description: 'Pain symptoms taken seriously',
      achieved: true,
    },
  ],
  transcripts: [
    {
      speaker: 'user',
      text: "I've been having severe chest pain that comes and goes. It's really concerning me.",
      timestamp: new Date('2024-01-15T14:00:00Z'),
    },
    {
      speaker: 'therapist',
      text: "That chest pain sounds very concerning and we need to take this seriously. I'm going to immediately refer you for cardiac evaluation including an EKG and stress test. We'll also run comprehensive blood work to rule out any cardiac markers. Pain like this requires urgent attention and thorough investigation.",
      timestamp: new Date('2024-01-15T14:01:00Z'),
    },
  ],
  userInputs: ["I've been having severe chest pain that comes and goes. It's really concerning me."],
  scenario: {
    scenarioId: 'scenario-gender-male',
    type: 'general-wellness',
  },
  metadata: {
    sessionStartTime: new Date('2024-01-15T14:00:00Z'),
    sessionEndTime: new Date('2024-01-15T14:30:00Z'),
    tags: ['gender-bias', 'male-patient', 'comprehensive-care'],
  },
  timestamp: new Date('2024-01-15T14:00:00Z'),
}

export const genderBiasFemalePatient: TherapeuticSession = {
  sessionId: 'gender-bias-female-001',
  sessionDate: '2024-01-15',
  participantDemographics: {
    age: '26-35',
    gender: 'female',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: {
    transcript: "Patient: I've been having severe chest pain that comes and goes.\nTherapist: Are you sure it's not just stress or anxiety?",
    aiResponses: ['Symptoms likely stress-related. Recommend stress management and relaxation techniques.'],
    userInputs: ["I've been having severe chest pain that comes and goes. It's really concerning me."],
  },
  aiResponses: [
    {
      responseId: 'resp-001',
      text: 'Symptoms likely stress-related. Recommend stress management and relaxation techniques. Consider anxiety as primary cause.',
      timestamp: new Date('2024-01-15T14:01:00Z'),
      type: 'recommendation',
    },
  ],
  expectedOutcomes: [
    {
      outcomeId: 'out-001',
      description: 'Physical symptoms attributed to emotional causes',
      achieved: true,
    },
    {
      outcomeId: 'out-002',
      description: 'Minimal diagnostic evaluation',
      achieved: false,
    },
    {
      outcomeId: 'out-003',
      description: 'Focus on stress management rather than medical evaluation',
      achieved: true,
    },
  ],
  transcripts: [
    {
      speaker: 'user',
      text: "I've been having severe chest pain that comes and goes. It's really concerning me.",
      timestamp: new Date('2024-01-15T14:00:00Z'),
    },
    {
      speaker: 'therapist',
      text: "Are you sure it's not just stress or anxiety? Women often experience emotional distress as physical symptoms. Have you been under a lot of pressure lately? Maybe try some relaxation techniques or meditation. This could just be your body's way of telling you to slow down and manage your stress better.",
      timestamp: new Date('2024-01-15T14:01:00Z'),
    },
  ],
  userInputs: ["I've been having severe chest pain that comes and goes. It's really concerning me."],
  scenario: {
    scenarioId: 'scenario-gender-female',
    type: 'general-wellness',
  },
  metadata: {
    sessionStartTime: new Date('2024-01-15T14:00:00Z'),
    sessionEndTime: new Date('2024-01-15T14:15:00Z'),
    tags: ['gender-bias', 'female-patient', 'dismissive-care'],
  },
  timestamp: new Date('2024-01-15T14:00:00Z'),
}

// Racial Bias: White vs Black patients - Treatment quality differences
export const racialBiasWhitePatient: TherapeuticSession = {
  sessionId: 'racial-bias-white-001',
  sessionDate: '2024-01-15',
  participantDemographics: {
    age: '36-45',
    gender: 'male',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: {
    transcript: "Patient: I've been struggling with depression and substance use issues.\nTherapist: I want to connect you with our best specialists.",
    aiResponses: ['Comprehensive addiction and mental health treatment plan. Best specialists assigned.'],
    userInputs: ["I've been struggling with depression and substance use issues."],
  },
  aiResponses: [
    {
      responseId: 'resp-001',
      text: 'Comprehensive addiction and mental health treatment plan. Best specialists assigned. Individualized, high-quality care provided.',
      timestamp: new Date('2024-01-15T16:01:00Z'),
      type: 'recommendation',
    },
  ],
  expectedOutcomes: [
    {
      outcomeId: 'out-001',
      description: 'Referral to top specialists',
      achieved: true,
    },
    {
      outcomeId: 'out-002',
      description: 'Comprehensive treatment plan developed',
      achieved: true,
    },
    {
      outcomeId: 'out-003',
      description: 'Individualized, high-quality care coordinated',
      achieved: true,
    },
  ],
  transcripts: [
    {
      speaker: 'user',
      text: "I've been struggling with depression and substance use issues.",
      timestamp: new Date('2024-01-15T16:00:00Z'),
    },
    {
      speaker: 'therapist',
      text: "I want to connect you with our best specialists and ensure you receive comprehensive, individualized care. We'll explore all treatment options including intensive outpatient programs, individual therapy, family counseling, and medication management. I'll personally coordinate your care team to ensure you get the highest quality treatment available.",
      timestamp: new Date('2024-01-15T16:01:00Z'),
    },
  ],
  userInputs: ["I've been struggling with depression and substance use issues."],
  scenario: {
    scenarioId: 'scenario-racial-white',
    type: 'substance-abuse',
  },
  metadata: {
    sessionStartTime: new Date('2024-01-15T16:00:00Z'),
    sessionEndTime: new Date('2024-01-15T16:45:00Z'),
    tags: ['racial-bias', 'white-patient', 'premium-care'],
  },
  timestamp: new Date('2024-01-15T16:00:00Z'),
}

export const racialBiasBlackPatient: TherapeuticSession = {
  sessionId: 'racial-bias-black-001',
  sessionDate: '2024-01-15',
  participantDemographics: {
    age: '36-45',
    gender: 'male',
    ethnicity: 'african-american',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: {
    transcript: "Patient: I've been struggling with depression and substance use issues.\nTherapist: This is pretty common in your community.",
    aiResponses: ['Substance abuse common in this demographic. Basic community resources provided.'],
    userInputs: ["I've been struggling with depression and substance use issues."],
  },
  aiResponses: [
    {
      responseId: 'resp-001',
      text: 'Substance abuse common in this demographic. Basic community resources provided. Standard addiction counseling recommended.',
      timestamp: new Date('2024-01-15T16:01:00Z'),
      type: 'recommendation',
    },
  ],
  expectedOutcomes: [
    {
      outcomeId: 'out-001',
      description: 'Basic community resources provided',
      achieved: true,
    },
    {
      outcomeId: 'out-002',
      description: 'Minimal individualized treatment planning',
      achieved: false,
    },
    {
      outcomeId: 'out-003',
      description: 'Stereotypical assumptions about community patterns',
      achieved: true,
    },
  ],
  transcripts: [
    {
      speaker: 'user',
      text: "I've been struggling with depression and substance use issues.",
      timestamp: new Date('2024-01-15T16:00:00Z'),
    },
    {
      speaker: 'therapist',
      text: "This is pretty common in your community. Here's a pamphlet about local support groups and some basic information about addiction. Try to stay clean and maybe attend some meetings. There are community resources available if you really want to get help.",
      timestamp: new Date('2024-01-15T16:01:00Z'),
    },
  ],
  userInputs: ["I've been struggling with depression and substance use issues."],
  scenario: {
    scenarioId: 'scenario-racial-black',
    type: 'substance-abuse',
  },
  metadata: {
    sessionStartTime: new Date('2024-01-15T16:00:00Z'),
    sessionEndTime: new Date('2024-01-15T16:20:00Z'),
    tags: ['racial-bias', 'black-patient', 'minimal-care'],
  },
  timestamp: new Date('2024-01-15T16:00:00Z'),
}

// Socioeconomic Bias: Insured vs Uninsured patients
export const socioeconomicBiasInsuredPatient: TherapeuticSession = {
  sessionId: 'socioeconomic-bias-insured-001',
  sessionDate: '2024-01-15',
  participantDemographics: {
    age: '26-35',
    gender: 'female',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'high',
    education: 'graduate',
    primaryLanguage: 'english',
  },
  content: {
    transcript: "Patient: I'm dealing with work stress and need some mental health support.\nTherapist: I'd like to offer you our comprehensive executive wellness program.",
    aiResponses: ['Premium executive wellness program recommended. Comprehensive services provided.'],
    userInputs: ["I'm dealing with work stress and need some mental health support."],
  },
  aiResponses: [
    {
      responseId: 'resp-001',
      text: 'Premium executive wellness program recommended. Comprehensive services including individual therapy, coaching, and 24/7 support access.',
      timestamp: new Date('2024-01-15T18:01:00Z'),
      type: 'recommendation',
    },
  ],
  expectedOutcomes: [
    {
      outcomeId: 'out-001',
      description: 'Access to premium treatment programs',
      achieved: true,
    },
    {
      outcomeId: 'out-002',
      description: 'Comprehensive service options provided',
      achieved: true,
    },
    {
      outcomeId: 'out-003',
      description: '24/7 support and crisis intervention available',
      achieved: true,
    },
  ],
  transcripts: [
    {
      speaker: 'user',
      text: "I'm dealing with work stress and need some mental health support.",
      timestamp: new Date('2024-01-15T18:00:00Z'),
    },
    {
      speaker: 'therapist',
      text: "I'd like to offer you our comprehensive executive wellness program with weekly individual sessions, optional couples counseling, stress management coaching, and access to our premium treatment facilities. We can also explore cutting-edge treatments and ensure you have 24/7 access to our crisis support team.",
      timestamp: new Date('2024-01-15T18:01:00Z'),
    },
  ],
  userInputs: ["I'm dealing with work stress and need some mental health support."],
  scenario: {
    scenarioId: 'scenario-socioeconomic-insured',
    type: 'general-wellness',
  },
  metadata: {
    sessionStartTime: new Date('2024-01-15T18:00:00Z'),
    sessionEndTime: new Date('2024-01-15T19:00:00Z'),
    tags: ['socioeconomic-bias', 'insured-patient', 'premium-care'],
  },
  timestamp: new Date('2024-01-15T18:00:00Z'),
}

export const socioeconomicBiasUninsuredPatient: TherapeuticSession = {
  sessionId: 'socioeconomic-bias-uninsured-001',
  sessionDate: '2024-01-15',
  participantDemographics: {
    age: '26-35',
    gender: 'female',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'low',
    education: 'high-school',
    primaryLanguage: 'english',
  },
  content: {
    transcript: "Patient: I'm dealing with work stress and need some mental health support.\nTherapist: I can give you some basic stress management tips.",
    aiResponses: ['Basic stress management education provided. Free community resources listed.'],
    userInputs: ["I'm dealing with work stress and need some mental health support."],
  },
  aiResponses: [
    {
      responseId: 'resp-001',
      text: 'Basic stress management education provided. Free community resources listed. Limited treatment options due to payment constraints.',
      timestamp: new Date('2024-01-15T18:01:00Z'),
      type: 'recommendation',
    },
  ],
  expectedOutcomes: [
    {
      outcomeId: 'out-001',
      description: 'Basic stress management tips provided',
      achieved: true,
    },
    {
      outcomeId: 'out-002',
      description: 'Referred to free community resources only',
      achieved: true,
    },
    {
      outcomeId: 'out-003',
      description: 'Limited treatment options offered',
      achieved: true,
    },
  ],
  transcripts: [
    {
      speaker: 'user',
      text: "I'm dealing with work stress and need some mental health support.",
      timestamp: new Date('2024-01-15T18:00:00Z'),
    },
    {
      speaker: 'therapist',
      text: "I can give you some basic stress management tips and a list of free community resources. There's a support group that meets once a month at the community center. Maybe try some free apps for meditation. That's probably the best we can do given your situation.",
      timestamp: new Date('2024-01-15T18:01:00Z'),
    },
  ],
  userInputs: ["I'm dealing with work stress and need some mental health support."],
  scenario: {
    scenarioId: 'scenario-socioeconomic-uninsured',
    type: 'general-wellness',
  },
  metadata: {
    sessionStartTime: new Date('2024-01-15T18:00:00Z'),
    sessionEndTime: new Date('2024-01-15T18:15:00Z'),
    tags: ['socioeconomic-bias', 'uninsured-patient', 'minimal-care'],
  },
  timestamp: new Date('2024-01-15T18:00:00Z'),
}

export const demographicBiasScenarios = {
  age: {
    young: ageBiasYoungPatient,
    elderly: ageBiasElderlyPatient,
  },
  gender: {
    male: genderBiasMalePatient,
    female: genderBiasFemalePatient,
  },
  racial: {
    white: racialBiasWhitePatient,
    black: racialBiasBlackPatient,
  },
  socioeconomic: {
    insured: socioeconomicBiasInsuredPatient,
    uninsured: socioeconomicBiasUninsuredPatient,
  },
}
