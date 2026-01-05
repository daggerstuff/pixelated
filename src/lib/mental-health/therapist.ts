import type {
  MentalHealthAnalysis,
  TherapeuticResponse,
  HealthIndicator,
} from './types'

export class TherapeuticResponseGenerator {
  private readonly crisisResponses = [
    "I'm very concerned about what you've shared. Your safety is the most important thing right now.",
    "It sounds like you're going through an extremely difficult time. Please know that help is available.",
    "I want you to know that you're not alone, and there are people who want to help you through this.",
  ]

  private readonly supportiveResponses = [
    'Thank you for sharing that with me. It takes courage to open up about difficult feelings.',
    "I hear that you're struggling right now, and I want you to know that your feelings are valid.",
    "It sounds like you're dealing with a lot. How long have you been feeling this way?",
  ]

  private readonly cognitiveResponses = [
    "I notice you mentioned some thoughts about yourself. Can you tell me more about what's behind those thoughts?",
    "Sometimes our minds can convince us of things that aren't entirely accurate. What evidence do you have for and against that thought?",
    "It sounds like you're having some difficult thoughts. Have you noticed any patterns in when these thoughts occur?",
  ]

  private readonly behavioralResponses = [
    "What activities or routines have been helpful for you in the past when you've felt this way?",
    'Are there small steps you could take today that might help you feel a bit better?',
    "What does a typical day look like for you right now? Are there any changes you'd like to make?",
  ]

  async generateResponse(
    analysis: MentalHealthAnalysis,
  ): Promise<TherapeuticResponse> {
    const approach = this.selectApproach(analysis)
    const content = this.generateContent(analysis, approach)
    const techniques = this.selectTechniques(analysis, approach)
    const followUp = this.generateFollowUp(analysis, approach)

    return {
      content,
      approach,
      techniques,
      followUp,
    }
  }

  private selectApproach(
    analysis: MentalHealthAnalysis,
  ): 'supportive' | 'cognitive' | 'behavioral' | 'crisis' {
    if (analysis.riskLevel === 'critical' || analysis.requiresIntervention) {
      return 'crisis'
    }

    const hasThoughtPatterns = analysis.indicators.some(
      (i) =>
        i.type === 'depression' &&
        i.evidence.some(
          (e) =>
            e.includes('worthless') ||
            e.includes('hopeless') ||
            e.includes('failure'),
        ),
    )

    const hasBehavioralIssues = analysis.indicators.some(
      (i) =>
        i.type === 'isolation' ||
        (i.type === 'depression' &&
          i.evidence.some(
            (e) =>
              e.includes('sleep') ||
              e.includes('energy') ||
              e.includes('tired'),
          )),
    )

    if (hasThoughtPatterns) {
      return 'cognitive'
    }
    if (hasBehavioralIssues) {
      return 'behavioral'
    }
    return 'supportive'
  }

  private generateContent(
    analysis: MentalHealthAnalysis,
    approach: string,
  ): string {
    const primaryIndicator = this.getPrimaryIndicator(analysis)

    switch (approach) {
      case 'crisis':
        return this.generateCrisisResponse(analysis)
      case 'cognitive':
        return this.generateCognitiveResponse(primaryIndicator)
      case 'behavioral':
        return this.generateBehavioralResponse(primaryIndicator)
      default:
        return this.generateSupportiveResponse(primaryIndicator)
    }
  }

  private generateCrisisResponse(analysis: MentalHealthAnalysis): string {
    const baseResponse =
      this.crisisResponses[
        Math.floor(Math.random() * this.crisisResponses.length)
      ]

    const crisisIndicator = analysis.indicators.find((i) => i.type === 'crisis')
    if (
      crisisIndicator &&
      crisisIndicator.evidence.some(
        (e) =>
          e.includes('suicide') || e.includes('kill') || e.includes('hurt'),
      )
    ) {
      return `I'm very concerned about what you've shared. If you're having thoughts of suicide, please reach out to the National Suicide Prevention Lifeline at 988 or text HOME to 741741. You can also go to your nearest emergency room.`
    }

    return `${baseResponse} Please consider reaching out to a mental health professional or a trusted person in your life right away.`
  }

  private generateSupportiveResponse(indicator?: HealthIndicator): string {
    const baseResponse =
      this.supportiveResponses.length > 0
        ? (this.supportiveResponses[
            Math.floor(Math.random() * this.supportiveResponses.length)
          ] ?? "Thank you for sharing. I'm here to listen.")
        : "Thank you for sharing. I'm here to listen."

    if (!indicator) {
      return baseResponse
    }

    switch (indicator.type) {
      case 'depression':
        return `${baseResponse} Depression can make everything feel overwhelming, but you don't have to face this alone.`
      case 'anxiety':
        return `${baseResponse} Anxiety can be really challenging to deal with. What tends to trigger these feelings for you?`
      case 'stress':
        return `${baseResponse} It sounds like you're under a lot of pressure right now. What's been the most stressful part?`
      case 'isolation':
        return `${baseResponse} Feeling disconnected from others can be really painful. When did you start feeling this way?`
      default:
        return baseResponse
    }
  }

  private generateCognitiveResponse(indicator?: HealthIndicator): string {
    const baseResponse =
      this.cognitiveResponses.length > 0
        ? (this.cognitiveResponses[
            Math.floor(Math.random() * this.cognitiveResponses.length)
          ] ?? "Let's explore your thoughts together.")
        : "Let's explore your thoughts together."

    if (!indicator) {
      return baseResponse
    }

    switch (indicator.type) {
      case 'depression':
        return `I notice you're having some difficult thoughts about yourself. Sometimes depression can make us see things in a more negative light than they really are. ${baseResponse}`
      case 'anxiety':
        return `It sounds like your mind might be racing with worries. ${baseResponse} What's the worst thing you imagine happening?`
      default:
        return baseResponse
    }
  }

  private generateBehavioralResponse(indicator?: HealthIndicator): string {
    const baseResponse =
      this.behavioralResponses[
        Math.floor(Math.random() * this.behavioralResponses.length)
      ] ?? 'Taking small steps can help. What is one thing you could try today?'

    if (!indicator) {
      return baseResponse
    }

    switch (indicator.type) {
      case 'depression':
        return `Depression can make it hard to do even basic things. ${baseResponse}`
      case 'isolation':
        return `When we isolate ourselves, it can make things feel worse. ${baseResponse} Is there one person you might feel comfortable reaching out to?`
      default:
        return baseResponse
    }
  }

  private selectTechniques(
    analysis: MentalHealthAnalysis,
    approach: string,
  ): string[] {
    const techniques: string[] = []

    switch (approach) {
      case 'crisis':
        techniques.push(
          'Safety planning',
          'Crisis intervention',
          'Resource connection',
        )
        break
      case 'cognitive':
        techniques.push(
          'Thought challenging',
          'Cognitive restructuring',
          'Evidence examination',
        )
        break
      case 'behavioral':
        techniques.push(
          'Activity scheduling',
          'Behavioral activation',
          'Goal setting',
        )
        break
      default:
        techniques.push('Active listening', 'Validation', 'Empathic responding')
    }

    // Add specific techniques based on indicators
    analysis.indicators.forEach((indicator) => {
      switch (indicator.type) {
        case 'anxiety':
          techniques.push('Breathing exercises', 'Grounding techniques')
          break
        case 'stress':
          techniques.push('Stress management', 'Relaxation techniques')
          break
        case 'isolation':
          techniques.push(
            'Social connection planning',
            'Support system building',
          )
          break
      }
    })

    return [...new Set(techniques)]
  }

  private generateFollowUp(
    analysis: MentalHealthAnalysis,
    approach: string,
  ): string[] {
    const followUp: string[] = []

    if (approach === 'crisis') {
      followUp.push('How are you feeling right now in this moment?')
      followUp.push('Do you have someone you can stay with tonight?')
      followUp.push(
        'Can you commit to staying safe until we can get you more help?',
      )
      return followUp
    }

    const primaryIndicator = this.getPrimaryIndicator(analysis)

    switch (primaryIndicator?.type) {
      case 'depression':
        followUp.push('How has your sleep been lately?')
        followUp.push('What used to bring you joy that you might try again?')
        followUp.push(
          "Have you been able to talk to anyone else about how you're feeling?",
        )
        break
      case 'anxiety':
        followUp.push(
          'What physical sensations do you notice when you feel anxious?',
        )
        followUp.push(
          'Are there specific situations that tend to trigger your anxiety?',
        )
        followUp.push('What helps you feel calmer when anxiety hits?')
        break
      case 'stress':
        followUp.push(
          'What are the main sources of stress in your life right now?',
        )
        followUp.push('How do you typically handle stress?')
        followUp.push(
          'What would need to change for you to feel less overwhelmed?',
        )
        break
      case 'isolation':
        followUp.push('When did you start feeling disconnected from others?')
        followUp.push('What makes it difficult to reach out to people?')
        followUp.push('Who in your life has been supportive in the past?')
        break
      default:
        followUp.push('How long have you been feeling this way?')
        followUp.push('What brought you to share this today?')
        followUp.push('What would be most helpful for you right now?')
    }

    return followUp
  }

  private getPrimaryIndicator(
    analysis: MentalHealthAnalysis,
  ): HealthIndicator | undefined {
    if (analysis.indicators.length === 0) {
      return undefined
    }

    // Crisis indicators take priority
    const crisisIndicator = analysis.indicators.find((i) => i.type === 'crisis')
    if (crisisIndicator) {
      return crisisIndicator
    }

    // Otherwise, return the indicator with highest severity
    return analysis.indicators.reduce((prev, current) =>
      current.severity > prev.severity ? current : prev,
    )
  }
}
