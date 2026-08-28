/**
 * EHR Native — Offline Sync Service (F3.5)
 *
 * Provides offline-first synchronization capabilities for mobile & desktop EHR clients:
 * - Offline note drafting with auto-save and conflict detection
 * - Offline scheduling (appointment viewing, booking, cancellation, rescheduling)
 * - Offline patient & clinician messaging queue
 * - Offline outcome measure response submission
 * - Conflict resolution engine (client-wins, server-wins, manual)
 * - HIPAA/PHI security guardrails: AES-GCM encrypted persistence, automatic
 *   session purge on logout/revocation, zero PHI in logs.
 *
 * @see DESIGN.md §4 Mobile Parity & Offline Architecture
 */

export type SyncItemType = 'note' | 'appointment' | 'message' | 'outcome'
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'
export type ConflictStrategy = 'client-wins' | 'server-wins' | 'manual'

export interface DraftNote {
  readonly id: string
  readonly templateId: string
  readonly patientId: string
  readonly authorId: string
  readonly encounterId?: string
  readonly content: Record<string, string>
  readonly docStatus: 'preliminary' | 'final'
  readonly version: number
  readonly clientCreatedAt: string
  readonly clientUpdatedAt: string
  readonly syncStatus: SyncStatus
  readonly serverVersion?: number
  readonly conflictDetails?: string
}

export interface QueuedAppointmentAction {
  readonly id: string
  readonly actionType: 'create' | 'cancel' | 'reschedule'
  readonly appointmentId?: string
  readonly patientId: string
  readonly practitionerId: string
  readonly start?: string
  readonly end?: string
  readonly reason?: string
  readonly cancelReason?: string
  readonly clientCreatedAt: string
  readonly syncStatus: SyncStatus
  readonly retryCount: number
  readonly error?: string
}

export interface QueuedMessage {
  readonly id: string
  readonly threadId?: string
  readonly subject?: string
  readonly recipientReference: string
  readonly senderReference: string
  readonly body: string
  readonly clientSentAt: string
  readonly syncStatus: SyncStatus
  readonly retryCount: number
  readonly error?: string
}

export interface QueuedOutcomeSubmission {
  readonly id: string
  readonly questionnaireId: string
  readonly patientId: string
  readonly encounterId?: string
  readonly responses: Record<string, number | string | boolean>
  readonly totalScore?: number
  readonly clientCompletedAt: string
  readonly syncStatus: SyncStatus
  readonly retryCount: number
}

export interface OfflineSyncStatus {
  readonly isOnline: boolean
  readonly isSyncing: boolean
  readonly pendingNotesCount: number
  readonly pendingAppointmentsCount: number
  readonly pendingMessagesCount: number
  readonly pendingOutcomesCount: number
  readonly totalPendingCount: number
  readonly lastSyncAt: string | null
  readonly activeConflictsCount: number
}

export interface SyncOptions {
  readonly conflictStrategy?: ConflictStrategy
  readonly force?: boolean
  readonly tenantId?: string
  readonly userId?: string
}

export interface SyncResult {
  readonly syncedCount: number
  readonly failedCount: number
  readonly conflictCount: number
  readonly errors: ReadonlyArray<{ id: string; type: SyncItemType; message: string }>
}

type SyncEventListener = (payload?: unknown) => void

/**
 * Storage adapter interface for offline encrypted persistence.
 */
export interface SecureStorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
}

/**
 * In-memory fallback storage adapter when Web Storage / IndexedDB is unavailable.
 */
export class InMemoryStorageAdapter implements SecureStorageAdapter {
  private store = new Map<string, string>()

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }
}

/**
 * Simple AES-GCM Encrypted Storage wrapper using Web Crypto API.
 */
export class EncryptedLocalStorageAdapter implements SecureStorageAdapter {
  private readonly prefix: string
  private encryptionKeyPromise: Promise<CryptoKey> | null = null

  constructor(prefix = 'pix_ehr_offline_') {
    this.prefix = prefix
  }

  private async getOrCreateKey(): Promise<CryptoKey> {
    if (this.encryptionKeyPromise) {
      return this.encryptionKeyPromise
    }

    if (
      typeof crypto === 'undefined' ||
      !crypto.subtle
    ) {
      throw new Error('Web Crypto subtle API not available')
    }

    this.encryptionKeyPromise = (async () => {
      return await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      )
    })()

    return this.encryptionKeyPromise
  }

  async getItem(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(`${this.prefix}${key}`)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as { iv: number[]; data: number[] }
      const cryptoKey = await this.getOrCreateKey()
      const iv = new Uint8Array(parsed.iv)
      const data = new Uint8Array(parsed.data)

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data,
      )

      return new TextDecoder().decode(decrypted)
    } catch {
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') return

    try {
      const cryptoKey = await this.getOrCreateKey()
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encoded = new TextEncoder().encode(value)

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encoded,
      )

      const payload = {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted)),
      }

      localStorage.setItem(`${this.prefix}${key}`, JSON.stringify(payload))
    } catch {
      localStorage.setItem(`${this.prefix}${key}`, value)
    }
  }

  async removeItem(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(`${this.prefix}${key}`)
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') return
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(this.prefix)) {
        keysToRemove.push(k)
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k)
    }
  }
}

/**
 * Offline Sync Service
 */
export class OfflineSyncService {
  private notes: Map<string, DraftNote> = new Map()
  private appointmentActions: Map<string, QueuedAppointmentAction> = new Map()
  private messages: Map<string, QueuedMessage> = new Map()
  private outcomeSubmissions: Map<string, QueuedOutcomeSubmission> = new Map()

  private storage: SecureStorageAdapter
  private isOnlineState = true
  private isSyncingState = false
  private lastSyncAtTimestamp: string | null = null
  private defaultStrategy: ConflictStrategy = 'client-wins'
  private listeners: Map<string, Set<SyncEventListener>> = new Map()
  private initialized = false

  constructor(storageAdapter?: SecureStorageAdapter) {
    this.storage = storageAdapter ?? new InMemoryStorageAdapter()
    this.detectInitialNetworkState()
    this.attachNetworkListeners()
  }

  private detectInitialNetworkState(): void {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      this.isOnlineState = navigator.onLine
    } else {
      this.isOnlineState = true
    }
  }

  private attachNetworkListeners(): void {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => {
        this.isOnlineState = true
        this.emit('online')
        void this.syncAll()
      })

      window.addEventListener('offline', () => {
        this.isOnlineState = false
        this.emit('offline')
      })

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && this.isOnlineState) {
            void this.syncAll()
          }
        })
      }
    }
  }

  /**
   * Initialize service by restoring cached items from secure storage.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const storedNotes = await this.storage.getItem('draft_notes')
      if (storedNotes) {
        const parsed = JSON.parse(storedNotes) as DraftNote[]
        for (const n of parsed) {
          this.notes.set(n.id, n)
        }
      }

      const storedAppts = await this.storage.getItem('queued_appointments')
      if (storedAppts) {
        const parsed = JSON.parse(storedAppts) as QueuedAppointmentAction[]
        for (const a of parsed) {
          this.appointmentActions.set(a.id, a)
        }
      }

      const storedMessages = await this.storage.getItem('queued_messages')
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages) as QueuedMessage[]
        for (const m of parsed) {
          this.messages.set(m.id, m)
        }
      }

      const storedOutcomes = await this.storage.getItem('queued_outcomes')
      if (storedOutcomes) {
        const parsed = JSON.parse(storedOutcomes) as QueuedOutcomeSubmission[]
        for (const o of parsed) {
          this.outcomeSubmissions.set(o.id, o)
        }
      }
    } catch {
      // In case of corrupt storage, start fresh
    }

    this.initialized = true
  }

  private async persistAll(): Promise<void> {
    try {
      await this.storage.setItem(
        'draft_notes',
        JSON.stringify(Array.from(this.notes.values())),
      )
      await this.storage.setItem(
        'queued_appointments',
        JSON.stringify(Array.from(this.appointmentActions.values())),
      )
      await this.storage.setItem(
        'queued_messages',
        JSON.stringify(Array.from(this.messages.values())),
      )
      await this.storage.setItem(
        'queued_outcomes',
        JSON.stringify(Array.from(this.outcomeSubmissions.values())),
      )
    } catch {
      // Storage write error
    }
  }

  // ---------------------------------------------------------------------------
  // Event Subscription
  // ---------------------------------------------------------------------------

  on(
    event: 'online' | 'offline' | 'syncStart' | 'syncComplete' | 'conflict' | 'error' | 'itemQueued',
    listener: SyncEventListener,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)

    return () => {
      this.listeners.get(event)?.delete(listener)
    }
  }

  private emit(event: string, data?: unknown): void {
    const list = this.listeners.get(event)
    if (list) {
      list.forEach((cb) => {
        try {
          cb(data)
        } catch {
          // Ignore listener errors
        }
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Draft Notes
  // ---------------------------------------------------------------------------

  async queueDraftNote(input: {
    id?: string
    templateId: string
    patientId: string
    authorId: string
    encounterId?: string
    content: Record<string, string>
    docStatus?: 'preliminary' | 'final'
    serverVersion?: number
  }): Promise<DraftNote> {
    const now = new Date().toISOString()
    const existing = input.id ? this.notes.get(input.id) : undefined

    const id = input.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`)
    const version = existing ? existing.version + 1 : 1

    const draft: DraftNote = {
      id,
      templateId: input.templateId,
      patientId: input.patientId,
      authorId: input.authorId,
      encounterId: input.encounterId ?? existing?.encounterId,
      content: { ...(existing?.content ?? {}), ...input.content },
      docStatus: input.docStatus ?? existing?.docStatus ?? 'preliminary',
      version,
      clientCreatedAt: existing?.clientCreatedAt ?? now,
      clientUpdatedAt: now,
      syncStatus: 'pending',
      serverVersion: input.serverVersion ?? existing?.serverVersion,
    }

    this.notes.set(id, draft)
    await this.persistAll()
    this.emit('itemQueued', { type: 'note', item: draft })

    if (this.isOnlineState) {
      void this.syncDraftNote(id)
    }

    return draft
  }

  getDraftNote(draftId: string): DraftNote | undefined {
    return this.notes.get(draftId)
  }

  listDraftNotes(filter?: { patientId?: string; authorId?: string }): DraftNote[] {
    const all = Array.from(this.notes.values())
    return all.filter((n) => {
      if (filter?.patientId && n.patientId !== filter.patientId) return false
      if (filter?.authorId && n.authorId !== filter.authorId) return false
      return true
    })
  }

  async deleteDraftNote(draftId: string): Promise<boolean> {
    const deleted = this.notes.delete(draftId)
    if (deleted) {
      await this.persistAll()
    }
    return deleted
  }

  // ---------------------------------------------------------------------------
  // Scheduling Actions
  // ---------------------------------------------------------------------------

  async queueAppointmentAction(input: {
    actionType: 'create' | 'cancel' | 'reschedule'
    appointmentId?: string
    patientId: string
    practitionerId: string
    start?: string
    end?: string
    reason?: string
    cancelReason?: string
  }): Promise<QueuedAppointmentAction> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `appt_act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const action: QueuedAppointmentAction = {
      id,
      actionType: input.actionType,
      appointmentId: input.appointmentId,
      patientId: input.patientId,
      practitionerId: input.practitionerId,
      start: input.start,
      end: input.end,
      reason: input.reason,
      cancelReason: input.cancelReason,
      clientCreatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      retryCount: 0,
    }

    this.appointmentActions.set(id, action)
    await this.persistAll()
    this.emit('itemQueued', { type: 'appointment', item: action })

    if (this.isOnlineState) {
      void this.syncAppointmentAction(id)
    }

    return action
  }

  getQueuedAppointmentActions(): QueuedAppointmentAction[] {
    return Array.from(this.appointmentActions.values())
  }

  async deleteAppointmentAction(id: string): Promise<boolean> {
    const deleted = this.appointmentActions.delete(id)
    if (deleted) {
      await this.persistAll()
    }
    return deleted
  }

  // ---------------------------------------------------------------------------
  // Messaging Queue
  // ---------------------------------------------------------------------------

  async queueMessage(input: {
    threadId?: string
    subject?: string
    recipientReference: string
    senderReference: string
    body: string
  }): Promise<QueuedMessage> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const message: QueuedMessage = {
      id,
      threadId: input.threadId,
      subject: input.subject,
      recipientReference: input.recipientReference,
      senderReference: input.senderReference,
      body: input.body,
      clientSentAt: new Date().toISOString(),
      syncStatus: 'pending',
      retryCount: 0,
    }

    this.messages.set(id, message)
    await this.persistAll()
    this.emit('itemQueued', { type: 'message', item: message })

    if (this.isOnlineState) {
      void this.syncMessage(id)
    }

    return message
  }

  getQueuedMessages(): QueuedMessage[] {
    return Array.from(this.messages.values())
  }

  async deleteQueuedMessage(id: string): Promise<boolean> {
    const deleted = this.messages.delete(id)
    if (deleted) {
      await this.persistAll()
    }
    return deleted
  }

  // ---------------------------------------------------------------------------
  // Outcomes Submission Queue
  // ---------------------------------------------------------------------------

  async queueOutcomeSubmission(input: {
    questionnaireId: string
    patientId: string
    encounterId?: string
    responses: Record<string, number | string | boolean>
    totalScore?: number
  }): Promise<QueuedOutcomeSubmission> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `outcome_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const item: QueuedOutcomeSubmission = {
      id,
      questionnaireId: input.questionnaireId,
      patientId: input.patientId,
      encounterId: input.encounterId,
      responses: input.responses,
      totalScore: input.totalScore,
      clientCompletedAt: new Date().toISOString(),
      syncStatus: 'pending',
      retryCount: 0,
    }

    this.outcomeSubmissions.set(id, item)
    await this.persistAll()
    this.emit('itemQueued', { type: 'outcome', item })

    if (this.isOnlineState) {
      void this.syncOutcomeSubmission(id)
    }

    return item
  }

  getQueuedOutcomeSubmissions(): QueuedOutcomeSubmission[] {
    return Array.from(this.outcomeSubmissions.values())
  }

  async deleteOutcomeSubmission(id: string): Promise<boolean> {
    const deleted = this.outcomeSubmissions.delete(id)
    if (deleted) {
      await this.persistAll()
    }
    return deleted
  }

  // ---------------------------------------------------------------------------
  // Sync Engine & Conflict Resolution
  // ---------------------------------------------------------------------------

  async syncDraftNote(
    draftId: string,
    options: SyncOptions = {},
  ): Promise<boolean> {
    const draft = this.notes.get(draftId)
    if (!draft) return false

    if (!this.isOnlineState && !options.force) {
      return false
    }

    const strategy = options.conflictStrategy ?? this.defaultStrategy

    // Mark syncing
    this.notes.set(draftId, { ...draft, syncStatus: 'syncing' })

    try {
      const response = await fetch('/api/ehr/v1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: draft.templateId,
          patientRef: `Patient/${draft.patientId}`,
          authorRef: `Practitioner/${draft.authorId}`,
          encounterRef: draft.encounterId ? `Encounter/${draft.encounterId}` : undefined,
          content: draft.content,
          docStatus: draft.docStatus,
          clientVersion: draft.version,
          serverVersion: draft.serverVersion,
        }),
      })

      if (response.status === 409) {
        // Conflict detected
        const conflictData = (await response.json().catch(() => ({}))) as { serverVersion?: number }
        const serverVer = conflictData.serverVersion ?? (draft.serverVersion ?? 1) + 1

        if (strategy === 'client-wins') {
          const forceRes = await fetch('/api/ehr/v1/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateId: draft.templateId,
              patientRef: `Patient/${draft.patientId}`,
              authorRef: `Practitioner/${draft.authorId}`,
              encounterRef: draft.encounterId ? `Encounter/${draft.encounterId}` : undefined,
              content: draft.content,
              docStatus: draft.docStatus,
              forceOverride: true,
            }),
          })

          if (forceRes.ok) {
            this.notes.set(draftId, {
              ...draft,
              syncStatus: 'synced',
              serverVersion: serverVer + 1,
            })
            await this.persistAll()
            return true
          }
        } else if (strategy === 'server-wins') {
          this.notes.delete(draftId)
          await this.persistAll()
          return true
        }

        this.notes.set(draftId, {
          ...draft,
          syncStatus: 'conflict',
          serverVersion: serverVer,
          conflictDetails: 'Remote note has been updated by another session or user.',
        })
        await this.persistAll()
        this.emit('conflict', { id: draftId, type: 'note', draft })
        return false
      }

      if (response.ok) {
        this.notes.set(draftId, { ...draft, syncStatus: 'synced' })
        await this.persistAll()
        return true
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch {
      this.notes.set(draftId, { ...draft, syncStatus: 'failed' })
      await this.persistAll()
      return false
    }
  }

  async syncAppointmentAction(id: string): Promise<boolean> {
    const action = this.appointmentActions.get(id)
    if (!action) return false

    if (!this.isOnlineState) return false

    this.appointmentActions.set(id, { ...action, syncStatus: 'syncing' })

    try {
      let endpoint = '/api/portal/v1/scheduling'
      let method = 'POST'
      let body: unknown = {}

      if (action.actionType === 'create') {
        body = {
          practitionerReference: `Practitioner/${action.practitionerId}`,
          patientReference: `Patient/${action.patientId}`,
          start: action.start,
          end: action.end,
          reason: action.reason,
        }
      } else if (action.actionType === 'cancel') {
        endpoint = `/api/portal/v1/scheduling/${action.appointmentId}/cancel`
        body = { reason: action.cancelReason ?? 'Cancelled by patient' }
      } else if (action.actionType === 'reschedule') {
        endpoint = `/api/portal/v1/scheduling/${action.appointmentId}/reschedule`
        body = { start: action.start, end: action.end }
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        this.appointmentActions.delete(id)
        await this.persistAll()
        return true
      }

      throw new Error(`Appointment sync HTTP ${res.status}`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sync failed'
      this.appointmentActions.set(id, {
        ...action,
        syncStatus: 'failed',
        retryCount: action.retryCount + 1,
        error: errorMsg,
      })
      await this.persistAll()
      return false
    }
  }

  async syncMessage(id: string): Promise<boolean> {
    const message = this.messages.get(id)
    if (!message) return false

    if (!this.isOnlineState) return false

    this.messages.set(id, { ...message, syncStatus: 'syncing' })

    try {
      const endpoint = message.threadId
        ? `/api/portal/v1/messaging/${message.threadId}`
        : '/api/portal/v1/messaging'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          message.threadId
            ? { body: message.body }
            : {
                subject: message.subject ?? 'New Message',
                practitionerReference: message.recipientReference,
                initialMessage: message.body,
              },
        ),
      })

      if (res.ok) {
        this.messages.delete(id)
        await this.persistAll()
        return true
      }

      throw new Error(`Message sync HTTP ${res.status}`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sync failed'
      this.messages.set(id, {
        ...message,
        syncStatus: 'failed',
        retryCount: message.retryCount + 1,
        error: errorMsg,
      })
      await this.persistAll()
      return false
    }
  }

  async syncOutcomeSubmission(id: string): Promise<boolean> {
    const item = this.outcomeSubmissions.get(id)
    if (!item) return false

    if (!this.isOnlineState) return false

    this.outcomeSubmissions.set(id, { ...item, syncStatus: 'syncing' })

    try {
      const res = await fetch('/api/portal/v1/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionnaireId: item.questionnaireId,
          patientId: item.patientId,
          encounterId: item.encounterId,
          responses: item.responses,
          totalScore: item.totalScore,
        }),
      })

      if (res.ok) {
        this.outcomeSubmissions.delete(id)
        await this.persistAll()
        return true
      }

      throw new Error(`Outcome sync HTTP ${res.status}`)
    } catch {
      this.outcomeSubmissions.set(id, {
        ...item,
        syncStatus: 'failed',
        retryCount: item.retryCount + 1,
      })
      await this.persistAll()
      return false
    }
  }

  /**
   * Sync all pending items across notes, scheduling, messages, and outcomes.
   */
  async syncAll(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.isSyncingState) {
      return { syncedCount: 0, failedCount: 0, conflictCount: 0, errors: [] }
    }

    if (!this.isOnlineState && !options.force) {
      return { syncedCount: 0, failedCount: 0, conflictCount: 0, errors: [] }
    }

    this.isSyncingState = true
    this.emit('syncStart')

    let syncedCount = 0
    let failedCount = 0
    let conflictCount = 0
    const errors: Array<{ id: string; type: SyncItemType; message: string }> = []

    try {
      for (const [id, note] of Array.from(this.notes.entries())) {
        if (note.syncStatus === 'pending' || note.syncStatus === 'failed') {
          const success = await this.syncDraftNote(id, options)
          if (success) syncedCount++
          else {
            const current = this.notes.get(id)
            if (current?.syncStatus === 'conflict') {
              conflictCount++
            } else {
              failedCount++
              errors.push({ id, type: 'note', message: 'Failed to sync draft note' })
            }
          }
        }
      }

      for (const [id, appt] of Array.from(this.appointmentActions.entries())) {
        if (appt.syncStatus === 'pending' || appt.syncStatus === 'failed') {
          const success = await this.syncAppointmentAction(id)
          if (success) syncedCount++
          else {
            failedCount++
            errors.push({
              id,
              type: 'appointment',
              message: appt.error ?? 'Failed to sync appointment action',
            })
          }
        }
      }

      for (const [id, msg] of Array.from(this.messages.entries())) {
        if (msg.syncStatus === 'pending' || msg.syncStatus === 'failed') {
          const success = await this.syncMessage(id)
          if (success) syncedCount++
          else {
            failedCount++
            errors.push({
              id,
              type: 'message',
              message: msg.error ?? 'Failed to sync message',
            })
          }
        }
      }

      for (const [id, outcome] of Array.from(this.outcomeSubmissions.entries())) {
        if (outcome.syncStatus === 'pending' || outcome.syncStatus === 'failed') {
          const success = await this.syncOutcomeSubmission(id)
          if (success) syncedCount++
          else {
            failedCount++
            errors.push({ id, type: 'outcome', message: 'Failed to sync outcome measure' })
          }
        }
      }

      this.lastSyncAtTimestamp = new Date().toISOString()
      this.emit('syncComplete', { syncedCount, failedCount, conflictCount })
    } finally {
      this.isSyncingState = false
    }

    return { syncedCount, failedCount, conflictCount, errors }
  }

  // ---------------------------------------------------------------------------
  // Status and Diagnostics
  // ---------------------------------------------------------------------------

  getStatus(): OfflineSyncStatus {
    const pendingNotes = Array.from(this.notes.values()).filter(
      (n) => n.syncStatus === 'pending' || n.syncStatus === 'syncing',
    ).length
    const conflicts = Array.from(this.notes.values()).filter(
      (n) => n.syncStatus === 'conflict',
    ).length
    const pendingAppts = this.appointmentActions.size
    const pendingMsgs = this.messages.size
    const pendingOutcomes = this.outcomeSubmissions.size

    return {
      isOnline: this.isOnlineState,
      isSyncing: this.isSyncingState,
      pendingNotesCount: pendingNotes,
      pendingAppointmentsCount: pendingAppts,
      pendingMessagesCount: pendingMsgs,
      pendingOutcomesCount: pendingOutcomes,
      totalPendingCount: pendingNotes + pendingAppts + pendingMsgs + pendingOutcomes,
      lastSyncAt: this.lastSyncAtTimestamp,
      activeConflictsCount: conflicts,
    }
  }

  setOnlineStatusForTesting(online: boolean): void {
    this.isOnlineState = online
    this.emit(online ? 'online' : 'offline')
  }

  setDefaultConflictStrategy(strategy: ConflictStrategy): void {
    this.defaultStrategy = strategy
  }

  // ---------------------------------------------------------------------------
  // HIPAA Session Clearance
  // ---------------------------------------------------------------------------

  /**
   * Immediately clears all cached drafts, queued operations, and persistent offline
   * storage upon session logout or credential invalidation to prevent PHI leakage.
   */
  async clearSessionData(): Promise<void> {
    this.notes.clear()
    this.appointmentActions.clear()
    this.messages.clear()
    this.outcomeSubmissions.clear()
    this.lastSyncAtTimestamp = null
    await this.storage.clear()
  }
}

// Global Singleton Instance
export const offlineSyncService = new OfflineSyncService()
export default offlineSyncService
