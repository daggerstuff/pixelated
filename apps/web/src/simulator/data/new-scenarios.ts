import type { Scenario } from '../types'
import {
  ScenarioDifficulty,
  TherapeuticDomain,
  TherapeuticTechnique,
} from '../types'

/**
 * Additional therapeutic practice scenarios for new domains
 */
export const newScenarios: Scenario[] = [
  {
    id: 'eating-disorder-initial',
    title: 'Eating Disorder: Initial Assessment',
    description:
      'Practice conducting an initial assessment with a client showing signs of an eating disorder.',
    domain: TherapeuticDomain.EATING_DISORDERS,
    difficulty: ScenarioDifficulty.INTERMEDIATE,
    techniques: [
      TherapeuticTechnique.ACTIVE_LISTENING,
      TherapeuticTechnique.VALIDATION,
      TherapeuticTechnique.OPEN_ENDED_QUESTIONS,
    ],
    contextDescription:
      'First session with a client who was referred by their physician due to significant weight loss and concerning eating patterns.',
    clientBackground:
      'Sam is a 19-year-old college student who has lost 15% of their body weight in the past 3 months. Their physician is concerned about nutritional deficiencies and has referred them for psychological evaluation. Sam is hesitant about therapy and insists they are "just eating healthy."',
    presentingIssue:
      'Rapid weight loss, restrictive eating patterns, preoccupation with food and calories, excessive exercise, and withdrawal from social eating situations.',
    objectives: [
      'Build rapport and establish a non-judgmental therapeutic relationship',
      'Assess the severity and characteristics of disordered eating behaviors',
      'Evaluate medical stability and need for higher level of care',
      'Begin to explore underlying factors contributing to eating concerns',
    ],
    suggestedApproaches: [
      'Use a collaborative, curious stance rather than confrontation',
      'Express authentic concern while avoiding power struggles about eating',
      'Balance medical seriousness with hope for recovery',
      "Explore client's perspective on their relationship with food and body",
    ],
    initialPrompt:
      "Hello, my name is Sam. My doctor made me come here, but I don't think I have a problem. I've just been trying to eat healthier and exercise more to get in shape.",
  },
  {
    id: 'self-harm-assessment',
    title: 'Self-Harm: Safety Assessment',
    description:
      'Practice assessing and addressing self-harm behaviors in an adolescent client.',
    domain: TherapeuticDomain.SELF_HARM,
    difficulty: ScenarioDifficulty.ADVANCED,
    techniques: [
      TherapeuticTechnique.VALIDATION,
      TherapeuticTechnique.ACTIVE_LISTENING,
      TherapeuticTechnique.GOAL_SETTING,
    ],
    contextDescription:
      'Second session with an adolescent client whose parent discovered they had been self-harming.',
    clientBackground:
      'Taylor is a 15-year-old high school student whose parent found evidence of cutting on their arms. Taylor has been experiencing increasing academic pressure and social difficulties at school. They report using self-harm as a way to "feel something" when overwhelmed by emotional numbness.',
    presentingIssue:
      'Non-suicidal self-injury (cutting) used as an emotion regulation strategy, difficulty expressing emotions verbally, academic pressure, and social isolation.',
    objectives: [
      'Assess severity, frequency, and function of self-harm behaviors',
      'Identify triggers and emotional states that precede self-harm',
      'Introduce alternative coping strategies for emotional regulation',
      'Develop a safety plan with specific alternatives to self-harm',
    ],
    suggestedApproaches: [
      'Maintain a non-judgmental, matter-of-fact approach to self-harm discussions',
      'Validate emotional pain while not reinforcing self-harm behavior',
      'Explore functions of self-harm without assumption',
      'Involve supportive family members in safety planning when appropriate',
    ],
    initialPrompt:
      "Hi. My mom made me come to therapy because she found some cuts on my arm. It's not a big deal, I wasn't trying to kill myself or anything. I just do it sometimes when things get too intense.",
  },
  {
    id: 'bipolar-stability',
    title: 'Bipolar Disorder: Maintaining Stability',
    description:
      'Practice supporting a client with bipolar disorder in maintaining mood stability and medication adherence.',
    domain: TherapeuticDomain.BIPOLAR_DISORDER,
    difficulty: ScenarioDifficulty.ADVANCED,
    techniques: [
      TherapeuticTechnique.VALIDATION,
      TherapeuticTechnique.GOAL_SETTING,
      TherapeuticTechnique.COGNITIVE_RESTRUCTURING,
    ],
    contextDescription:
      'Ongoing therapy with a client diagnosed with Bipolar I Disorder who has recently been considering stopping their medication.',
    clientBackground:
      'Jordan is a 32-year-old artist with a 10-year history of Bipolar I Disorder. They have been stable on medication for the past 2 years after a serious manic episode that resulted in hospitalization. Recently, they have been feeling that the medication dulls their creativity and are considering stopping it.',
    presentingIssue:
      'Ambivalence about medication adherence, concerns about creativity being dampened, mild sleep disturbances, and subtle grandiosity in recent creative projects.',
    objectives: [
      'Explore ambivalence about medication while validating concerns',
      'Identify early warning signs of mood episode fluctuations',
      'Review previous experiences with medication discontinuation',
      'Develop strategies to support creative expression while maintaining stability',
    ],
    suggestedApproaches: [
      'Use motivational interviewing techniques to explore medication ambivalence',
      'Help identify prodromal symptoms of mood episodes',
      'Discuss cognitive distortions related to medication and creativity',
      'Create a wellness plan that incorporates both stability and creative expression',
    ],
    initialPrompt:
      "I've been thinking about stopping my meds. It's been two years, and I feel fine now. Plus, my art just isn't as inspired when I'm on these medications. I feel like they're blocking my creative process.",
  },
  {
    id: 'personality-disorder-boundaries',
    title: 'Personality Disorders: Maintaining Therapeutic Boundaries',
    description:
      'Practice maintaining therapeutic boundaries with a client showing features of borderline personality disorder.',
    domain: TherapeuticDomain.PERSONALITY_DISORDERS,
    difficulty: ScenarioDifficulty.EXPERT,
    techniques: [
      TherapeuticTechnique.VALIDATION,
      TherapeuticTechnique.GOAL_SETTING,
      TherapeuticTechnique.REFLECTIVE_STATEMENTS,
    ],
    contextDescription:
      'Ongoing therapy with a client who has borderline personality traits and has been testing therapeutic boundaries.',
    clientBackground:
      'Alex is a 27-year-old with a history of unstable relationships and emotional dysregulation. They have been in therapy with you for 3 months and have started calling between sessions, extending sessions, and making statements about you being "the only one who understands."',
    presentingIssue:
      'Intense emotional reactions to perceived abandonment, pattern of idealizing then devaluing relationships, difficulty maintaining consistent boundaries, and increased distress when therapy boundaries are reinforced.',
    objectives: [
      'Maintain compassionate but firm therapeutic boundaries',
      'Validate emotional experience without reinforcing boundary violations',
      'Help client understand pattern of idealization and devaluation',
      'Build skills for tolerating emotional distress within appropriate boundaries',
    ],
    suggestedApproaches: [
      'Be transparent and consistent about therapeutic boundaries',
      'Explore the function of boundary testing behaviors',
      'Validate the underlying emotional needs while not meeting inappropriate demands',
      'Use reflective statements to highlight patterns in therapeutic relationship',
    ],
    initialPrompt:
      "I tried calling you three times this week when I was upset. Why didn't you call me back? I thought you were different from my other therapists, but maybe you don't really care either.",
  },
  {
    id: 'sleep-disorders-insomnia',
    title: 'Sleep Disorders: Chronic Insomnia',
    description:
      'Practice implementing cognitive-behavioral therapy for insomnia (CBT-I) with a client experiencing chronic sleep difficulties.',
    domain: TherapeuticDomain.SLEEP_DISORDERS,
    difficulty: ScenarioDifficulty.INTERMEDIATE,
    techniques: [
      TherapeuticTechnique.COGNITIVE_RESTRUCTURING,
      TherapeuticTechnique.GOAL_SETTING,
      TherapeuticTechnique.BEHAVIORAL_ACTIVATION,
    ],
    contextDescription:
      'Third session with a client who has been experiencing chronic insomnia for over a year despite trying multiple interventions.',
    clientBackground:
      'Morgan is a 45-year-old marketing executive who reports difficulty falling asleep and staying asleep for the past 14 months. They have tried sleep medications, melatonin, and various sleep hygiene techniques with limited success. They report experiencing significant anxiety about sleep, often spending hours worrying about whether they will be able to sleep.',
    presentingIssue:
      'Difficulty falling asleep (often taking 1-2 hours), frequent nighttime awakenings, early morning awakening, daytime fatigue affecting work performance, and increasing anxiety about sleep itself.',
    objectives: [
      'Identify and address dysfunctional beliefs about sleep',
      'Implement structured sleep restriction and stimulus control techniques',
      'Reduce sleep-related anxiety through cognitive restructuring',
      'Develop consistent sleep schedule and routines',
    ],
    suggestedApproaches: [
      'Explore and challenge catastrophic thinking about effects of poor sleep',
      'Provide education about normal sleep patterns and mechanisms',
      'Implement systematic sleep restriction based on sleep diary data',
      'Address behaviors that have unintentionally maintained insomnia',
    ],
    initialPrompt:
      "I've tried everything to fix my sleep. Melatonin, medication, a new mattress, white noise, meditation... I'm exhausted but as soon as my head hits the pillow, my mind starts racing. I'm worried lack of sleep is going to seriously damage my health.",
  },
]

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
