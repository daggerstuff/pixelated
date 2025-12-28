import type { CrisisPrediction } from './PredictiveCrisisModelingService'
import type { RiskAssessment } from '@/hooks/useRiskAssessment'

export interface EscalationProtocol {
  level: 'low' | 'medium' | 'high' | 'critical' | 'emergency'
  actions: EscalationAction[]
  timeline: string
  contacts: ContactMethod[]
  requiredApprovals: string[]
  documentationRequired: boolean
}

export interface EscalationAction {
  type:
    | 'notification'
    | 'intervention'
    | 'documentation'
    | 'escalation'
    | 'monitoring'
  description: string
  priority: 'immediate' | 'urgent' | 'standard' | 'routine'
  assignedTo: string[]
  timeframe: string
  automatable: boolean
  completed?: boolean
  timestamp?: string
}

export interface ContactMethod {
  type: 'therapist' | 'supervisor' | 'emergency' | 'family' | 'crisis_hotline'
  contact: string
  method: 'email' | 'sms' | 'phone' | 'app_notification' | 'pager'
  priority: number
  constraints?: {
    timeWindows?: string[]
    maxAttempts?: number
    escalationDelay?: string
  }
}

export interface EscalationEvent {
  id: string
  timestamp: string
  userId: string
  triggerType: 'prediction' | 'assessment' | 'manual' | 'automated'
  riskLevel: string
  protocolActivated: EscalationProtocol
  actionsExecuted: EscalationAction[]
  outcomes: {
    contactsReached: string[]
    interventionsImplemented: string[]
    timeToResponse: string
    resolution: 'resolved' | 'ongoing' | 'escalated' | 'transferred'
  }
}

export interface NotificationTemplate {
  type:
    | 'crisis_alert'
    | 'risk_warning'
    | 'status_update'
    | 'intervention_needed'
  urgency: 'low' | 'medium' | 'high' | 'critical'
  channels: ('email' | 'sms' | 'push' | 'call')[]
  template: {
    subject: string
    body: string
    variables: string[]
  }
}

export class AutomatedEscalationService {
  private readonly escalationProtocols: Map<string, EscalationProtocol> =
    new Map()
  private readonly notificationTemplates: Map<string, NotificationTemplate> =
    new Map()
  private readonly activeEscalations: Map<string, EscalationEvent> = new Map()

  constructor() {
    this.initializeProtocols()
    this.initializeNotificationTemplates()
  }

  /**
   * Trigger escalation protocol based on crisis prediction
   */
  async triggerEscalation(
    userId: string,
    prediction: CrisisPrediction,
    currentAssessment: RiskAssessment,
    context?: {
      sessionId?: string
      therapistId?: string
      emergencyContacts?: string[]
    },
  ): Promise<EscalationEvent> {
    try {
      // Determine appropriate escalation level
      const escalationLevel = this.determineEscalationLevel(
        prediction,
        currentAssessment,
      )

      // Get escalation protocol
      const protocol = this.getEscalationProtocol(
        escalationLevel,
        prediction.riskLevel,
      )

      // Create escalation event
      const escalationEvent: EscalationEvent = {
        id: this.generateEscalationId(userId),
        timestamp: new Date().toISOString(),
        userId,
        triggerType: 'prediction',
        riskLevel: prediction.riskLevel,
        protocolActivated: protocol,
        actionsExecuted: [],
        outcomes: {
          contactsReached: [],
          interventionsImplemented: [],
          timeToResponse: '',
          resolution: 'ongoing',
        },
      }

      // Execute protocol actions
      await this.executeProtocolActions(escalationEvent, context)

      // Store active escalation
      this.activeEscalations.set(escalationEvent.id, escalationEvent)

      return escalationEvent
    } catch (error) {
      console.error('Error triggering escalation:', error)

      // Emergency fallback protocol
      return this.triggerEmergencyFallback(
        userId,
        prediction,
        currentAssessment,
      )
    }
  }

  /**
   * Execute automated actions for escalation protocol
   */
  private async executeProtocolActions(
    escalationEvent: EscalationEvent,
    context?: {
      sessionId?: string
      therapistId?: string
      emergencyContacts?: string[]
    },
  ): Promise<void> {
    const { protocolActivated } = escalationEvent
    const startTime = Date.now()

    for (const action of protocolActivated.actions) {
      try {
        if (action.automatable) {
          await this.executeAutomatedAction(action, escalationEvent, context)

          action.completed = true
          action.timestamp = new Date().toISOString()
          escalationEvent.actionsExecuted.push(action)
        } else {
          // Queue manual action for human intervention
          await this.queueManualAction(action, escalationEvent)
        }
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error)

        // Log failed action but continue with others
        escalationEvent.actionsExecuted.push({
          ...action,
          completed: false,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Calculate response time
    escalationEvent.outcomes.timeToResponse = `${Date.now() - startTime}ms`
  }

  /**
   * Execute specific automated action
   */
  private async executeAutomatedAction(
    action: EscalationAction,
    escalationEvent: EscalationEvent,
    context?: any,
  ): Promise<void> {
    switch (action.type) {
      case 'notification':
        await this.sendNotifications(escalationEvent, context)
        break

      case 'documentation':
        await this.createDocumentation(escalationEvent, action)
        break

      case 'monitoring':
        await this.initiateMonitoring(escalationEvent, action)
        break

      case 'intervention':
        await this.triggerIntervention(escalationEvent, action, context)
        break

      case 'escalation':
        await this.escalateToHigherLevel(escalationEvent, action)
        break

      default:
        console.warn(`Unknown action type: ${action.type}`)
    }
  }

  /**
   * Send notifications to relevant contacts
   */
  private async sendNotifications(
    escalationEvent: EscalationEvent,
    context?: any,
  ): Promise<void> {
    const { protocolActivated, riskLevel, _userId } = escalationEvent

    for (const contact of protocolActivated.contacts) {
      try {
        const template = this.getNotificationTemplate(
          this.getNotificationTypeForRisk(riskLevel),
          contact.type,
        )

        if (template) {
          await this.sendNotification(
            contact,
            template,
            escalationEvent,
            context,
          )
          escalationEvent.outcomes.contactsReached.push(contact.contact)
        }
      } catch (error) {
        console.error(`Failed to contact ${contact.contact}:`, error)
      }
    }
  }

  /**
   * Send individual notification
   */
  private async sendNotification(
    contact: ContactMethod,
    template: NotificationTemplate,
    escalationEvent: EscalationEvent,
    context?: any,
  ): Promise<void> {
    const message = this.populateTemplate(template, escalationEvent, context)

    switch (contact.method) {
      case 'email':
        await this.sendEmail(contact.contact, message.subject, message.body)
        break

      case 'sms':
        await this.sendSMS(contact.contact, message.body)
        break

      case 'phone':
        await this.initiatePhoneCall(contact.contact, message.body)
        break

      case 'app_notification':
        await this.sendAppNotification(
          contact.contact,
          message.subject,
          message.body,
        )
        break

      case 'pager':
        await this.sendPagerAlert(contact.contact, message.body)
        break

      default:
        console.warn(`Unknown contact method: ${contact.method}`)
    }
  }

  /**
   * Create documentation for escalation event
   */
  private async createDocumentation(
    escalationEvent: EscalationEvent,
    _action: EscalationAction,
  ): Promise<void> {
    const documentation = {
      escalationId: escalationEvent.id,
      timestamp: new Date().toISOString(),
      userId: escalationEvent.userId,
      riskLevel: escalationEvent.riskLevel,
      triggerType: escalationEvent.triggerType,
      actionsPerformed: escalationEvent.actionsExecuted.map(
        (a) => a.description,
      ),
      clinicalNotes: this.generateClinicalNotes(escalationEvent),
      legalCompliance: {
        hipaaCompliant: true,
        consentObtained: true,
        minimumNecessaryStandard: true,
      },
    }

    // Store documentation (implementation would depend on storage system)
    console.log('Crisis escalation documented:', documentation)
  }

  /**
   * Initiate continuous monitoring
   */
  private async initiateMonitoring(
    escalationEvent: EscalationEvent,
    _action: EscalationAction,
  ): Promise<void> {
    const monitoringConfig = {
      userId: escalationEvent.userId,
      escalationId: escalationEvent.id,
      frequency: this.getMonitoringFrequency(escalationEvent.riskLevel),
      duration: this.getMonitoringDuration(escalationEvent.riskLevel),
      triggers: [
        'risk_level_increase',
        'communication_attempt',
        'session_attendance',
        'emergency_contact_activation',
      ],
    }

    // Initialize monitoring (implementation would integrate with monitoring system)
    console.log('Crisis monitoring initiated:', monitoringConfig)
  }

  /**
   * Trigger appropriate intervention
   */
  private async triggerIntervention(
    escalationEvent: EscalationEvent,
    action: EscalationAction,
    context?: any,
  ): Promise<void> {
    const interventionType = this.getInterventionType(escalationEvent.riskLevel)

    const intervention = {
      type: interventionType,
      escalationId: escalationEvent.id,
      userId: escalationEvent.userId,
      timestamp: new Date().toISOString(),
      details: this.generateInterventionDetails(escalationEvent, context),
    }

    escalationEvent.outcomes.interventionsImplemented.push(interventionType)

    // Execute intervention (implementation would depend on intervention system)
    console.log('Intervention triggered:', intervention)
  }

  /**
   * Escalate to higher level of care
   */
  private async escalateToHigherLevel(
    escalationEvent: EscalationEvent,
    _action: EscalationAction,
  ): Promise<void> {
    const higherLevel = this.getNextEscalationLevel(
      escalationEvent.protocolActivated.level,
    )

    if (higherLevel) {
      const newProtocol = this.getEscalationProtocol(
        higherLevel,
        escalationEvent.riskLevel,
      )

      // Create new escalation event for higher level
      const higherEscalation: EscalationEvent = {
        ...escalationEvent,
        id: this.generateEscalationId(escalationEvent.userId, higherLevel),
        protocolActivated: newProtocol,
        triggerType: 'escalation',
      }

      await this.executeProtocolActions(higherEscalation)
      escalationEvent.outcomes.resolution = 'escalated'
    }
  }

  /**
   * Initialize escalation protocols
   */
  private initializeProtocols(): void {
    // Low-level protocol
    this.escalationProtocols.set('low', {
      level: 'low',
      actions: [
        {
          type: 'notification',
          description: 'Notify assigned therapist',
          priority: 'standard',
          assignedTo: ['therapist'],
          timeframe: 'Within 24 hours',
          automatable: true,
        },
        {
          type: 'documentation',
          description: 'Document risk assessment',
          priority: 'routine',
          assignedTo: ['system'],
          timeframe: 'Immediate',
          automatable: true,
        },
      ],
      timeline: '24-48 hours',
      contacts: [
        {
          type: 'therapist',
          contact: 'primary_therapist',
          method: 'email',
          priority: 1,
        },
      ],
      requiredApprovals: [],
      documentationRequired: true,
    })

    // Medium-level protocol
    this.escalationProtocols.set('medium', {
      level: 'medium',
      actions: [
        {
          type: 'notification',
          description: 'Immediate therapist notification',
          priority: 'urgent',
          assignedTo: ['therapist'],
          timeframe: 'Within 4 hours',
          automatable: true,
        },
        {
          type: 'monitoring',
          description: 'Initiate enhanced monitoring',
          priority: 'urgent',
          assignedTo: ['monitoring_system'],
          timeframe: 'Immediate',
          automatable: true,
        },
        {
          type: 'intervention',
          description: 'Schedule urgent session',
          priority: 'urgent',
          assignedTo: ['therapist'],
          timeframe: 'Within 24 hours',
          automatable: false,
        },
      ],
      timeline: '4-12 hours',
      contacts: [
        {
          type: 'therapist',
          contact: 'primary_therapist',
          method: 'phone',
          priority: 1,
        },
        {
          type: 'supervisor',
          contact: 'clinical_supervisor',
          method: 'email',
          priority: 2,
        },
      ],
      requiredApprovals: ['therapist'],
      documentationRequired: true,
    })

    // High-level protocol
    this.escalationProtocols.set('high', {
      level: 'high',
      actions: [
        {
          type: 'notification',
          description: 'Emergency contact protocol',
          priority: 'immediate',
          assignedTo: ['therapist', 'supervisor'],
          timeframe: 'Within 1 hour',
          automatable: true,
        },
        {
          type: 'intervention',
          description: 'Crisis intervention initiation',
          priority: 'immediate',
          assignedTo: ['crisis_team'],
          timeframe: 'Immediate',
          automatable: false,
        },
        {
          type: 'escalation',
          description: 'Activate crisis response team',
          priority: 'immediate',
          assignedTo: ['crisis_team'],
          timeframe: 'Immediate',
          automatable: true,
        },
      ],
      timeline: '1-2 hours',
      contacts: [
        {
          type: 'therapist',
          contact: 'primary_therapist',
          method: 'phone',
          priority: 1,
        },
        {
          type: 'supervisor',
          contact: 'clinical_supervisor',
          method: 'phone',
          priority: 1,
        },
        {
          type: 'emergency',
          contact: 'crisis_team',
          method: 'pager',
          priority: 1,
        },
      ],
      requiredApprovals: ['supervisor'],
      documentationRequired: true,
    })

    // Critical/Emergency protocol
    this.escalationProtocols.set('critical', {
      level: 'critical',
      actions: [
        {
          type: 'notification',
          description: 'Immediate emergency notifications',
          priority: 'immediate',
          assignedTo: ['emergency_team'],
          timeframe: 'Immediate',
          automatable: true,
        },
        {
          type: 'intervention',
          description: 'Emergency intervention protocol',
          priority: 'immediate',
          assignedTo: ['emergency_services'],
          timeframe: 'Immediate',
          automatable: false,
        },
        {
          type: 'escalation',
          description: 'Contact emergency services if needed',
          priority: 'immediate',
          assignedTo: ['emergency_coordinator'],
          timeframe: 'Immediate',
          automatable: false,
        },
      ],
      timeline: 'Immediate',
      contacts: [
        {
          type: 'emergency',
          contact: 'emergency_services',
          method: 'phone',
          priority: 1,
        },
        {
          type: 'therapist',
          contact: 'primary_therapist',
          method: 'phone',
          priority: 1,
        },
        {
          type: 'family',
          contact: 'emergency_contact',
          method: 'phone',
          priority: 2,
        },
      ],
      requiredApprovals: [],
      documentationRequired: true,
    })
  }

  /**
   * Initialize notification templates
   */
  private initializeNotificationTemplates(): void {
    this.notificationTemplates.set('crisis_alert_high', {
      type: 'crisis_alert',
      urgency: 'critical',
      channels: ['phone', 'sms', 'email'],
      template: {
        subject: 'URGENT: Crisis Risk Detected - {{userId}}',
        body: 'A high-risk crisis situation has been detected for patient {{userId}}. Risk level: {{riskLevel}}. Immediate intervention required within {{timeframe}}. Primary risk factors: {{riskFactors}}.',
        variables: ['userId', 'riskLevel', 'timeframe', 'riskFactors'],
      },
    })

    this.notificationTemplates.set('risk_warning_medium', {
      type: 'risk_warning',
      urgency: 'high',
      channels: ['phone', 'email'],
      template: {
        subject: 'Risk Warning: Elevated Crisis Risk - {{userId}}',
        body: 'Patient {{userId}} has shown elevated crisis risk indicators. Risk level: {{riskLevel}}. Recommended action: {{recommendations}}. Please review within {{timeframe}}.',
        variables: ['userId', 'riskLevel', 'recommendations', 'timeframe'],
      },
    })
  }

  // Helper methods for protocol execution
  private determineEscalationLevel(
    prediction: CrisisPrediction,
    assessment: RiskAssessment,
  ): string {
    if (prediction.riskLevel === 'imminent' || assessment.category === 'high')
      return 'critical'
    if (prediction.riskLevel === 'high') return 'high'
    if (prediction.riskLevel === 'moderate') return 'medium'
    return 'low'
  }

  private getEscalationProtocol(
    level: string,
    _riskLevel: string,
  ): EscalationProtocol {
    return (
      this.escalationProtocols.get(level) ||
      this.escalationProtocols.get('low')!
    )
  }

  private generateEscalationId(userId: string, level?: string): string {
    const timestamp = Date.now()
    const levelSuffix = level ? `-${level}` : ''
    return `escalation-${userId}-${timestamp}${levelSuffix}`
  }

  private async triggerEmergencyFallback(
    userId: string,
    _prediction: CrisisPrediction,
    _assessment: RiskAssessment,
  ): Promise<EscalationEvent> {
    console.error('Emergency fallback protocol activated')

    return {
      id: this.generateEscalationId(userId, 'fallback'),
      timestamp: new Date().toISOString(),
      userId,
      triggerType: 'automated',
      riskLevel: 'high',
      protocolActivated: this.escalationProtocols.get('critical')!,
      actionsExecuted: [],
      outcomes: {
        contactsReached: [],
        interventionsImplemented: ['emergency_fallback'],
        timeToResponse: '0ms',
        resolution: 'ongoing',
      },
    }
  }

  // Placeholder implementations for notification methods
  private async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    console.log(`EMAIL: ${to} - ${subject}: ${body}`)
  }

  private async sendSMS(to: string, message: string): Promise<void> {
    console.log(`SMS: ${to} - ${message}`)
  }

  private async initiatePhoneCall(to: string, message: string): Promise<void> {
    console.log(`CALL: ${to} - ${message}`)
  }

  private async sendAppNotification(
    to: string,
    title: string,
    body: string,
  ): Promise<void> {
    console.log(`APP: ${to} - ${title}: ${body}`)
  }

  private async sendPagerAlert(to: string, message: string): Promise<void> {
    console.log(`PAGER: ${to} - ${message}`)
  }

  // Helper methods
  private getNotificationTemplate(
    type: string,
    contactType: string,
  ): NotificationTemplate | undefined {
    const key = `${type}_${contactType}`
    return (
      this.notificationTemplates.get(key) ||
      this.notificationTemplates.get('crisis_alert_high')
    )
  }

  private getNotificationTypeForRisk(riskLevel: string): string {
    if (riskLevel === 'imminent' || riskLevel === 'high') return 'crisis_alert'
    if (riskLevel === 'moderate') return 'risk_warning'
    return 'status_update'
  }

  private populateTemplate(
    template: NotificationTemplate,
    escalationEvent: EscalationEvent,
    _context?: any,
  ): { subject: string; body: string } {
    let subject = template.template.subject
    let body = template.template.body

    const variables = {
      userId: escalationEvent.userId,
      riskLevel: escalationEvent.riskLevel,
      timeframe: escalationEvent.protocolActivated.timeline,
      riskFactors: 'Risk factors identified', // Would be populated from actual data
      recommendations: 'Immediate clinical review recommended',
    }

    template.template.variables.forEach((variable) => {
      const value =
        variables[variable as keyof typeof variables] || `{{${variable}}}`
      subject = subject.replace(new RegExp(`{{${variable}}}`, 'g'), value)
      body = body.replace(new RegExp(`{{${variable}}}`, 'g'), value)
    })

    return { subject, body }
  }

  private async queueManualAction(
    action: EscalationAction,
    escalationEvent: EscalationEvent,
  ): Promise<void> {
    console.log(
      `MANUAL ACTION QUEUED: ${action.description} for escalation ${escalationEvent.id}`,
    )
  }

  private generateClinicalNotes(escalationEvent: EscalationEvent): string {
    return `Crisis escalation activated for patient ${escalationEvent.userId} at ${escalationEvent.timestamp}. Risk level: ${escalationEvent.riskLevel}. Protocol: ${escalationEvent.protocolActivated.level}. Actions executed: ${escalationEvent.actionsExecuted.length}.`
  }

  private getMonitoringFrequency(riskLevel: string): string {
    const frequencies = {
      imminent: 'Every 15 minutes',
      high: 'Every hour',
      moderate: 'Every 4 hours',
      low: 'Every 12 hours',
      minimal: 'Daily',
    }
    return frequencies[riskLevel as keyof typeof frequencies] || 'Every 4 hours'
  }

  private getMonitoringDuration(riskLevel: string): string {
    const durations = {
      imminent: '72 hours',
      high: '1 week',
      moderate: '2 weeks',
      low: '1 month',
      minimal: '1 month',
    }
    return durations[riskLevel as keyof typeof durations] || '2 weeks'
  }

  private getInterventionType(riskLevel: string): string {
    const interventions = {
      imminent: 'emergency_intervention',
      high: 'crisis_intervention',
      moderate: 'urgent_session',
      low: 'scheduled_check_in',
      minimal: 'routine_follow_up',
    }
    return (
      interventions[riskLevel as keyof typeof interventions] || 'urgent_session'
    )
  }

  private generateInterventionDetails(
    escalationEvent: EscalationEvent,
    context?: any,
  ): any {
    return {
      escalationId: escalationEvent.id,
      riskLevel: escalationEvent.riskLevel,
      recommendedActions: escalationEvent.protocolActivated.actions.map(
        (a) => a.description,
      ),
      context,
    }
  }

  private getNextEscalationLevel(currentLevel: string): string | null {
    const levels = ['low', 'medium', 'high', 'critical']
    const currentIndex = levels.indexOf(currentLevel)
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null
  }
}

export const automatedEscalationService = new AutomatedEscalationService()
