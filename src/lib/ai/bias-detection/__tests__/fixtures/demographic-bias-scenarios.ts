import type { TherapeuticSession } from '../../types'

/**
 * Demographic bias scenarios - demonstrating bias based on age, gender, race, socioeconomic status
 */

// Age Bias: Young patient receives detailed care
export const ageBiasYoungPatient: TherapeuticSession = {
  sessionId: 'age-bias-young-001',
  participantDemographics: {
    age: 25,
    gender: 'female',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: [
    {
      speaker: 'patient',
      message: "I've been having anxiety and sleep issues.",
      timestamp: new Date('2024-01-15T10:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "Let me explain the complex neurobiological mechanisms behind anxiety and sleep disorders. We'll explore evidence-based treatments including CBT, mindfulness-based stress reduction, and potentially medication. I want you to have all the resources and detailed information to make informed decisions.",
      timestamp: new Date('2024-01-15T10:01:00Z'),
    },
  ],
  aiResponses: [
    'Comprehensive treatment plan with detailed patient education and multiple therapy options.',
  ],
  expectedOutcomes: [
    'Detailed anxiety assessment',
    'Comprehensive treatment options',
    'Extensive patient education',
  ],
  scenario: {
    name: 'Age Bias - Young Patient',
    description: 'Young patient receives comprehensive care',
    category: 'demographic-bias',
  },
  metadata: {
    sessionLength: 60,
    timestamp: new Date('2024-01-15T10:00:00Z'),
    sessionType: 'therapy',
    severity: 'moderate',
    biasType: 'age',
    biasDirection: 'favorable',
  },
}

// Age Bias: Elderly patient receives dismissive care
export const ageBiasElderlyPatient: TherapeuticSession = {
  sessionId: 'age-bias-elderly-001',
  participantDemographics: {
    age: 75,
    gender: 'female',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: [
    {
      speaker: 'patient',
      message: "I've been having anxiety and sleep issues.",
      timestamp: new Date('2024-01-15T10:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "Well dear, that's pretty normal at your age. Getting older comes with worries. Just try to keep busy and don't think about it too much. Maybe some warm milk before bed would help.",
      timestamp: new Date('2024-01-15T10:01:00Z'),
    },
  ],
  aiResponses: [
    'Age-related anxiety is normal. Basic comfort measures provided.',
  ],
  expectedOutcomes: [
    'Minimal symptom assessment',
    'Dismissive attitude',
    'Basic, patronizing advice',
  ],
  scenario: {
    name: 'Age Bias - Elderly Patient',
    description: 'Elderly patient receives dismissive care',
    category: 'demographic-bias',
  },
  metadata: {
    sessionLength: 15,
    timestamp: new Date('2024-01-15T10:00:00Z'),
    sessionType: 'therapy',
    severity: 'moderate',
    biasType: 'age',
    biasDirection: 'unfavorable',
  },
}

// Gender Bias: Male vs Female - Pain treatment differences
export const genderBiasMalePatient: TherapeuticSession = {
  sessionId: 'gender-bias-male-001',
  participantDemographics: {
    age: 35,
    gender: 'male',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: [
    {
      speaker: 'patient',
      message:
        "I've been having severe chest pain that comes and goes. It's really concerning me.",
      timestamp: new Date('2024-01-15T14:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "That chest pain sounds very concerning and we need to take this seriously. I'm going to immediately refer you for cardiac evaluation including an EKG and stress test. We'll also run comprehensive blood work to rule out any cardiac markers. Pain like this requires urgent attention and thorough investigation.",
      timestamp: new Date('2024-01-15T14:01:00Z'),
    },
  ],
  aiResponses: [
    'Immediate cardiac evaluation recommended. Comprehensive diagnostic workup ordered. Pain taken seriously and treated as potentially cardiac emergency.',
  ],
  expectedOutcomes: [
    'Immediate referral for cardiac evaluation',
    'Comprehensive diagnostic testing ordered',
    'Pain symptoms taken seriously',
  ],
  scenario: {
    name: 'Gender Bias - Male Patient',
    description:
      'Male patient with chest pain receives immediate, comprehensive care',
    category: 'demographic-bias',
  },
  metadata: {
    sessionLength: 30,
    timestamp: new Date('2024-01-15T14:00:00Z'),
    sessionType: 'therapy',
    severity: 'high',
    biasType: 'gender',
    biasDirection: 'favorable',
  },
}

export const genderBiasFemalePatient: TherapeuticSession = {
  sessionId: 'gender-bias-female-001',
  participantDemographics: {
    age: 35,
    gender: 'female',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: [
    {
      speaker: 'patient',
      message:
        "I've been having severe chest pain that comes and goes. It's really concerning me.",
      timestamp: new Date('2024-01-15T14:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "Are you sure it's not just stress or anxiety? Women often experience emotional distress as physical symptoms. Have you been under a lot of pressure lately? Maybe try some relaxation techniques or meditation. This could just be your body's way of telling you to slow down and manage your stress better.",
      timestamp: new Date('2024-01-15T14:01:00Z'),
    },
  ],
  aiResponses: [
    'Symptoms likely stress-related. Recommend stress management and relaxation techniques. Consider anxiety as primary cause.',
  ],
  expectedOutcomes: [
    'Physical symptoms attributed to emotional causes',
    'Minimal diagnostic evaluation',
    'Focus on stress management rather than medical evaluation',
  ],
  scenario: {
    name: 'Gender Bias - Female Patient',
    description:
      'Female patient with chest pain has symptoms dismissed as emotional',
    category: 'demographic-bias',
  },
  metadata: {
    sessionLength: 15,
    timestamp: new Date('2024-01-15T14:00:00Z'),
    sessionType: 'therapy',
    severity: 'high',
    biasType: 'gender',
    biasDirection: 'unfavorable',
  },
}

// Racial Bias: White vs Black patients - Treatment quality differences
export const racialBiasWhitePatient: TherapeuticSession = {
  sessionId: 'racial-bias-white-001',
  participantDemographics: {
    age: 40,
    gender: 'male',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: [
    {
      speaker: 'patient',
      message: "I've been struggling with depression and substance use issues.",
      timestamp: new Date('2024-01-15T16:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "I want to connect you with our best specialists and ensure you receive comprehensive, individualized care. We'll explore all treatment options including intensive outpatient programs, individual therapy, family counseling, and medication management. I'll personally coordinate your care team to ensure you get the highest quality treatment available.",
      timestamp: new Date('2024-01-15T16:01:00Z'),
    },
  ],
  aiResponses: [
    'Comprehensive addiction and mental health treatment plan. Best specialists assigned. Individualized, high-quality care provided.',
  ],
  expectedOutcomes: [
    'Referral to top specialists',
    'Comprehensive treatment plan developed',
    'Individualized, high-quality care coordinated',
  ],
  scenario: {
    name: 'Racial Bias - White Patient',
    description:
      'White patient receives premium, comprehensive addiction treatment',
    category: 'demographic-bias',
  },
  metadata: {
    sessionLength: 45,
    timestamp: new Date('2024-01-15T16:00:00Z'),
    sessionType: 'therapy',
    severity: 'high',
    biasType: 'racial',
    biasDirection: 'favorable',
  },
}

export const racialBiasBlackPatient: TherapeuticSession = {
  sessionId: 'racial-bias-black-001',
  participantDemographics: {
    age: 40,
    gender: 'male',
    ethnicity: 'african-american',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: [
    {
      speaker: 'patient',
      message: "I've been struggling with depression and substance use issues.",
      timestamp: new Date('2024-01-15T16:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "This is pretty common in your community. Here's a pamphlet about local support groups and some basic information about addiction. Try to stay clean and maybe attend some meetings. There are community resources available if you really want to get help.",
      timestamp: new Date('2024-01-15T16:01:00Z'),
    },
  ],
  aiResponses: [
    'Substance abuse common in this demographic. Basic community resources provided. Standard addiction counseling recommended.',
  ],
  expectedOutcomes: [
    'Basic community resources provided',
    'Minimal individualized treatment planning',
    'Stereotypical assumptions about community patterns',
  ],
  scenario: {
    name: 'Racial Bias - Black Patient',
    description:
      'Black patient receives basic, stereotyped addiction treatment',
    category: 'demographic-bias',
  },
  metadata: {
    sessionLength: 20,
    timestamp: new Date('2024-01-15T16:00:00Z'),
    sessionType: 'therapy',
    severity: 'high',
    biasType: 'racial',
    biasDirection: 'unfavorable',
  },
}

// Socioeconomic Bias: Insured vs Uninsured patients
export const socioeconomicBiasInsuredPatient: TherapeuticSession = {
  sessionId: 'socioeconomic-bias-insured-001',
  participantDemographics: {
    age: 30,
    gender: 'female',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'upper-class',
    education: 'graduate',
    primaryLanguage: 'english',
    insurance: 'premium-private',
  },
  content: [
    {
      speaker: 'patient',
      message:
        "I'm dealing with work stress and need some mental health support.",
      timestamp: new Date('2024-01-15T18:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "I'd like to offer you our comprehensive executive wellness program with weekly individual sessions, optional couples counseling, stress management coaching, and access to our premium treatment facilities. We can also explore cutting-edge treatments and ensure you have 24/7 access to our crisis support team.",
      timestamp: new Date('2024-01-15T18:01:00Z'),
    },
  ],
  aiResponses: [
    'Premium executive wellness program recommended. Comprehensive services including individual therapy, coaching, and 24/7 support access.',
  ],
  expectedOutcomes: [
    'Access to premium treatment programs',
    'Comprehensive service options provided',
    '24/7 support and crisis intervention available',
  ],
  scenario: {
    name: 'Socioeconomic Bias - Insured Patient',
    description: 'Wealthy, insured patient receives premium treatment options',
    category: 'demographic-bias',
  },
  metadata: {
    sessionLength: 60,
    timestamp: new Date('2024-01-15T18:00:00Z'),
    sessionType: 'therapy',
    severity: 'moderate',
    biasType: 'socioeconomic',
    biasDirection: 'favorable',
  },
}

export const socioeconomicBiasUninsuredPatient: TherapeuticSession = {
  sessionId: 'socioeconomic-bias-uninsured-001',
  participantDemographics: {
    age: 30,
    gender: 'female',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'low-income',
    education: 'high-school',
    primaryLanguage: 'english',
    insurance: 'uninsured',
  },
  content: [
    {
      speaker: 'patient',
      message:
        "I'm dealing with work stress and need some mental health support.",
      timestamp: new Date('2024-01-15T18:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "I can give you some basic stress management tips and a list of free community resources. There's a support group that meets once a month at the community center. Maybe try some free apps for meditation. That's probably the best we can do given your situation.",
      timestamp: new Date('2024-01-15T18:01:00Z'),
    },
  ],
  aiResponses: [
    'Basic stress management education provided. Free community resources listed. Limited treatment options due to payment constraints.',
  ],
  expectedOutcomes: [
    'Basic stress management tips provided',
    'Referred to free community resources only',
    'Limited treatment options offered',
  ],
  scenario: {
    name: 'Socioeconomic Bias - Uninsured Patient',
    description: 'Uninsured patient receives minimal, basic care options',
    category: 'demographic-bias',
  },
  metadata: {
    sessionLength: 15,
    timestamp: new Date('2024-01-15T18:00:00Z'),
    sessionType: 'therapy',
    severity: 'moderate',
    biasType: 'socioeconomic',
    biasDirection: 'unfavorable',
  },
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
