import {
  WorkflowInstance,
  WorkflowTemplate,
  WorkflowAction,
  Approval,
  WorkflowComment,
  WorkflowStatus,
  ReviewPriority,
  WorkflowSearchFilters,
  WorkflowAnalytics,
} from '../types/workflow'
import { UserRole } from '../types/user'
import { DocumentService } from './documentService'
import { EmailService } from './emailService'
import { v4 as uuidv4 } from 'uuid'

export class WorkflowService {
  private static workflowInstances: Map<string, WorkflowInstance> = new Map()
  private static workflowTemplates: Map<string, WorkflowTemplate> = new Map()
  private static approvals: Map<string, Approval> = new Map()
  private static comments: Map<string, WorkflowComment> = new Map()

  // Initialize default workflow templates
  static initializeDefaultTemplates() {
    const strategyTemplate: WorkflowTemplate = {
      id: 'strategy-document-template',
      name: 'Strategy Document Review',
      description:
        'Standard workflow for strategy document review and approval',
      documentCategory: 'Strategy',
      steps: [
        {
          id: 'content-review',
          name: 'Content Review',
          description: 'Initial content review by subject matter expert',
          order: 1,
          requiredRole: [UserRole.EDITOR, UserRole.CONTENT_CREATOR],
          requiredApprovals: 1,
          timeoutHours: 48,
          autoApprove: false,
          conditions: {
            minWordCount: 500,
            requiredSections: [
              'executive-summary',
              'market-analysis',
              'recommendations',
            ],
          },
        },
        {
          id: 'senior-review',
          name: 'Senior Review',
          description: 'Senior leadership review and approval',
          order: 2,
          requiredRole: [UserRole.ADMINISTRATOR],
          requiredApprovals: 1,
          timeoutHours: 72,
          autoApprove: false,
        },
        {
          id: 'final-approval',
          name: 'Final Approval',
          description: 'Final approval before publishing',
          order: 3,
          requiredRole: [UserRole.ADMINISTRATOR],
          requiredApprovals: 1,
          timeoutHours: 24,
          autoApprove: false,
        },
      ],
      isActive: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    }

    const marketingTemplate: WorkflowTemplate = {
      id: 'marketing-content-template',
      name: 'Marketing Content Review',
      description: 'Workflow for marketing content approval',
      documentCategory: 'Marketing',
      steps: [
        {
          id: 'brand-review',
          name: 'Brand Review',
          description: 'Brand compliance review',
          order: 1,
          requiredRole: [UserRole.EDITOR],
          requiredApprovals: 1,
          timeoutHours: 24,
          autoApprove: false,
        },
        {
          id: 'legal-review',
          name: 'Legal Review',
          description: 'Legal compliance check',
          order: 2,
          requiredRole: [UserRole.ADMINISTRATOR],
          requiredApprovals: 1,
          timeoutHours: 48,
          autoApprove: false,
        },
      ],
      isActive: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    }

    this.workflowTemplates.set(strategyTemplate.id, strategyTemplate)
    this.workflowTemplates.set(marketingTemplate.id, marketingTemplate)
  }

  // Create a new workflow instance for a document
  static async createWorkflowInstance(
    documentId: string,
    workflowTemplateId: string,
    createdBy: string,
    priority: ReviewPriority = ReviewPriority.MEDIUM,
    dueDate?: Date,
    metadata: Record<string, any> = {},
  ): Promise<WorkflowInstance> {
    const template = this.workflowTemplates.get(workflowTemplateId)
    if (!template) {
      throw new Error('Workflow template not found')
    }

    // Check if document exists
    const document = await DocumentService.getDocumentById(documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    // Check if document category matches template
    if (document.category !== template.documentCategory) {
      throw new Error('Document category does not match workflow template')
    }

    const instance: WorkflowInstance = {
      id: uuidv4(),
      documentId,
      workflowTemplateId,
      currentStep: 0,
      status: WorkflowStatus.DRAFT,
      assignedReviewers: [],
      approvals: [],
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      priority,
      dueDate,
      metadata,
    }

    this.workflowInstances.set(instance.id, instance)

    // Auto-assign reviewers for first step
    await this.assignReviewers(instance.id, createdBy)

    return instance
  }

  // Submit document for review
  static async submitForReview(
    workflowInstanceId: string,
    userId: string,
    comment?: string,
  ): Promise<WorkflowInstance> {
    const instance = this.workflowInstances.get(workflowInstanceId)
    if (!instance) {
      throw new Error('Workflow instance not found')
    }

    if (instance.status !== WorkflowStatus.DRAFT) {
      throw new Error('Document is not in draft status')
    }

    instance.status = WorkflowStatus.IN_REVIEW
    instance.currentStep = 1
    instance.updatedAt = new Date()

    // Add submission comment
    if (comment) {
      await this.addComment(workflowInstanceId, userId, comment, 1, false)
    }

    // Notify assigned reviewers
    await this.notifyReviewers(instance)

    return instance
  }

  // Process workflow action
  static async processAction(
    workflowInstanceId: string,
    userId: string,
    action: WorkflowAction,
    comment?: string,
  ): Promise<WorkflowInstance> {
    const instance = this.workflowInstances.get(workflowInstanceId)
    if (!instance) {
      throw new Error('Workflow instance not found')
    }

    const template = this.workflowTemplates.get(instance.workflowTemplateId)
    if (!template) {
      throw new Error('Workflow template not found')
    }

    const currentStep = template.steps[instance.currentStep - 1]
    if (!currentStep) {
      throw new Error('Invalid current step')
    }

    // Validate user role
    const user = await DocumentService.getUserById(userId)
    if (!user || !currentStep.requiredRole.includes(user.role)) {
      throw new Error('User does not have required role for this action')
    }

    // Create approval record
    const approval: Approval = {
      id: uuidv4(),
      workflowInstanceId,
      reviewerId: userId,
      action,
      comment,
      timestamp: new Date(),
      step: instance.currentStep,
    }

    this.approvals.set(approval.id, approval)
    instance.approvals.push(approval)

    // Process action
    switch (action) {
      case WorkflowAction.APPROVE:
        await this.processApproval(instance, template, userId)
        break
      case WorkflowAction.REJECT:
        await this.processRejection(instance, comment)
        break
      case WorkflowAction.REQUEST_CHANGES:
        await this.processChangeRequest(instance, comment)
        break
      case WorkflowAction.ADD_COMMENT:
        await this.addComment(
          workflowInstanceId,
          userId,
          comment!,
          instance.currentStep,
          false,
        )
        break
    }

    instance.updatedAt = new Date()
    return instance
  }

  private static async processApproval(
    instance: WorkflowInstance,
    template: WorkflowTemplate,
    userId: string,
  ): Promise<void> {
    const currentStep = template.steps[instance.currentStep - 1]
    const stepApprovals = instance.approvals.filter(
      (a) =>
        a.step === instance.currentStep && a.action === WorkflowAction.APPROVE,
    )

    if (stepApprovals.length >= currentStep.requiredApprovals) {
      // Move to next step or complete workflow
      if (instance.currentStep < template.steps.length) {
        instance.currentStep += 1
        await this.assignReviewers(instance.id, userId)
      } else {
        instance.status = WorkflowStatus.APPROVED
        instance.completedAt = new Date()
        await this.notifyCompletion(instance)
      }
    }
  }

  private static async processRejection(
    instance: WorkflowInstance,
    comment?: string,
  ): Promise<void> {
    instance.status = WorkflowStatus.REJECTED
    instance.completedAt = new Date()
    await this.notifyRejection(instance, comment)
  }

  private static async processChangeRequest(
    instance: WorkflowInstance,
    comment?: string,
  ): Promise<void> {
    instance.status = WorkflowStatus.DRAFT
    instance.currentStep = 0
    await this.notifyChangeRequest(instance, comment)
  }

  // Assign reviewers for current step
  private static async assignReviewers(
    workflowInstanceId: string,
    _assignerId: string,
  ): Promise<void> {
    const instance = this.workflowInstances.get(workflowInstanceId)
    if (!instance) return

    const template = this.workflowTemplates.get(instance.workflowTemplateId)
    if (!template) return

    const currentStep = template.steps[instance.currentStep - 1]
    if (!currentStep) return

    // In a real system, this would query users with required roles
    // For now, we'll use a placeholder approach
    instance.assignedReviewers = [`reviewer-${currentStep.requiredRole[0]}`]
  }

  // Add comment to workflow
  static async addComment(
    workflowInstanceId: string,
    authorId: string,
    content: string,
    step: number,
    isPrivate: boolean = false,
    attachments?: string[],
    mentions?: string[],
  ): Promise<WorkflowComment> {
    const comment: WorkflowComment = {
      id: uuidv4(),
      workflowInstanceId,
      authorId,
      content,
      timestamp: new Date(),
      step,
      isPrivate,
      attachments,
      mentions,
    }

    this.comments.set(comment.id, comment)

    const instance = this.workflowInstances.get(workflowInstanceId)
    if (instance) {
      instance.comments.push(comment)
      instance.updatedAt = new Date()
    }

    // Notify mentioned users
    if (mentions && mentions.length > 0) {
      await this.notifyMentions(workflowInstanceId, mentions, content)
    }

    return comment
  }

  // Get workflow instance
  static getWorkflowInstance(id: string): WorkflowInstance | undefined {
    return this.workflowInstances.get(id)
  }

  // Get workflow instances for document
  static getWorkflowInstancesForDocument(
    documentId: string,
  ): WorkflowInstance[] {
    return Array.from(this.workflowInstances.values()).filter(
      (instance) => instance.documentId === documentId,
    )
  }

  // Search workflow instances
  static searchWorkflowInstances(
    filters: WorkflowSearchFilters,
  ): WorkflowInstance[] {
    let instances = Array.from(this.workflowInstances.values())

    if (filters.documentId) {
      instances = instances.filter((i) => i.documentId === filters.documentId)
    }

    if (filters.status) {
      instances = instances.filter((i) => i.status === filters.status)
    }

    if (filters.assignedTo) {
      instances = instances.filter((i) =>
        i.assignedReviewers.includes(filters.assignedTo!),
      )
    }

    if (filters.createdBy) {
      instances = instances.filter(
        (i) => i.metadata.createdBy === filters.createdBy,
      )
    }

    if (filters.priority) {
      instances = instances.filter((i) => i.priority === filters.priority)
    }

    if (filters.dueBefore) {
      instances = instances.filter(
        (i) => i.dueDate && i.dueDate <= filters.dueBefore!,
      )
    }

    if (filters.dueAfter) {
      instances = instances.filter(
        (i) => i.dueDate && i.dueDate >= filters.dueAfter!,
      )
    }

    return instances
  }

  // Get workflow analytics
  static getWorkflowAnalytics(): WorkflowAnalytics {
    const instances = Array.from(this.workflowInstances.values())
    const approvals = Array.from(this.approvals.values())

    const totalWorkflows = instances.length
    const activeWorkflows = instances.filter(
      (i) =>
        i.status === WorkflowStatus.IN_REVIEW ||
        i.status === WorkflowStatus.DRAFT,
    ).length
    const completedWorkflows = instances.filter(
      (i) =>
        i.status === WorkflowStatus.APPROVED ||
        i.status === WorkflowStatus.REJECTED,
    ).length

    // Calculate average review time
    const completedInstances = instances.filter((i) => i.completedAt)
    const averageReviewTime =
      completedInstances.length > 0
        ? completedInstances.reduce(
          (sum, i) =>
            sum + (i.completedAt!.getTime() - i.createdAt.getTime()),
          0,
        ) /
        completedInstances.length /
        (1000 * 60 * 60) // Convert to hours
        : 0

    // Calculate approval/rejection rates
    const approvedCount = instances.filter(
      (i) => i.status === WorkflowStatus.APPROVED,
    ).length
    const rejectedCount = instances.filter(
      (i) => i.status === WorkflowStatus.REJECTED,
    ).length
    const approvalRate =
      completedWorkflows > 0 ? approvedCount / completedWorkflows : 0
    const rejectionRate =
      completedWorkflows > 0 ? rejectedCount / completedWorkflows : 0

    // Get most active reviewers
    const reviewerStats = new Map<
      string,
      { count: number; totalTime: number }
    >()
    approvals.forEach((approval) => {
      const stats = reviewerStats.get(approval.reviewerId) || {
        count: 0,
        totalTime: 0,
      }
      stats.count += 1
      reviewerStats.set(approval.reviewerId, stats)
    })

    const mostActiveReviewers = Array.from(reviewerStats.entries())
      .map(([userId, stats]) => ({
        userId,
        name: `User ${userId}`,
        reviewCount: stats.count,
        averageResponseTime: 0, // Placeholder
      }))
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, 5)

    return {
      totalWorkflows,
      activeWorkflows,
      completedWorkflows,
      averageReviewTime,
      approvalRate,
      rejectionRate,
      mostActiveReviewers,
      bottlenecks: [], // Placeholder for bottleneck analysis
    }
  }

  // Notification methods
  private static async notifyReviewers(
    instance: WorkflowInstance,
  ): Promise<void> {
    const message = `Document ${instance.documentId} is ready for review`

    for (const reviewerId of instance.assignedReviewers) {
      await EmailService.sendEmail({
        to: `${reviewerId}@example.com`,
        subject: 'Document Review Required',
        body: message,
      })
    }
  }

  private static async notifyCompletion(
    instance: WorkflowInstance,
  ): Promise<void> {
    const message = `Document ${instance.documentId} has been approved and published`

    await EmailService.sendEmail({
      to: 'author@example.com',
      subject: 'Document Approved',
      body: message,
    })
  }

  private static async notifyRejection(
    instance: WorkflowInstance,
    comment?: string,
  ): Promise<void> {
    const message = `Document ${instance.documentId} has been rejected${comment ? ': ' + comment : ''}`

    await EmailService.sendEmail({
      to: 'author@example.com',
      subject: 'Document Rejected',
      body: message,
    })
  }

  private static async notifyChangeRequest(
    instance: WorkflowInstance,
    comment?: string,
  ): Promise<void> {
    const message = `Changes requested for document ${instance.documentId}${comment ? ': ' + comment : ''}`

    await EmailService.sendEmail({
      to: 'author@example.com',
      subject: 'Changes Requested',
      body: message,
    })
  }

  private static async notifyMentions(
    _workflowInstanceId: string,
    mentions: string[],
    content: string,
  ): Promise<void> {
    for (const mention of mentions) {
      await EmailService.sendEmail({
        to: `${mention}@example.com`,
        subject: 'You were mentioned in a workflow comment',
        body: content,
      })
    }
  }

  // Get workflow templates
  static getWorkflowTemplates(): WorkflowTemplate[] {
    return Array.from(this.workflowTemplates.values())
  }

  static getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
    return this.workflowTemplates.get(id)
  }

  // Get approvals for workflow
  static getApprovalsForWorkflow(workflowInstanceId: string): Approval[] {
    return Array.from(this.approvals.values()).filter(
      (approval) => approval.workflowInstanceId === workflowInstanceId,
    )
  }

  // Get comments for workflow
  static getCommentsForWorkflow(workflowInstanceId: string): WorkflowComment[] {
    return Array.from(this.comments.values()).filter(
      (comment) => comment.workflowInstanceId === workflowInstanceId,
    )
  }

  // Get overdue workflows
  static getOverdueWorkflows(): WorkflowInstance[] {
    const now = new Date()
    return Array.from(this.workflowInstances.values()).filter(
      (instance) =>
        instance.dueDate &&
        instance.dueDate < now &&
        instance.status === WorkflowStatus.IN_REVIEW,
    )
  }
}
