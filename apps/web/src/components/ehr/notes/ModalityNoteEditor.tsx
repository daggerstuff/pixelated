import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudOff,
  FileText,
  RefreshCw,
  Save,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  offlineSyncService,
  type DraftNote,
  type SyncStatus,
} from '@/lib/ehr-native/services/offline-sync.service'
import { noteTemplateService } from '@/lib/ehr-native/services/note-template-service'

export interface ModalityNoteEditorProps {
  patientId: string
  authorId: string
  encounterId?: string
  initialTemplateId?: string
  initialDraftId?: string
  onSaved?: (draft: DraftNote) => void
}

export function ModalityNoteEditor({
  patientId,
  authorId,
  encounterId,
  initialTemplateId = 'individual-therapy-progress',
  initialDraftId,
  onSaved,
}: ModalityNoteEditorProps) {
  const [templateId, setTemplateId] = useState(initialTemplateId)
  const [content, setContent] = useState<Record<string, string>>({})
  const [docStatus, setDocStatus] = useState<'preliminary' | 'final'>('preliminary')
  const [draftId, setDraftId] = useState<string>(initialDraftId ?? `draft_${Date.now()}`)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [isOnline, setIsOnline] = useState(true)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [manualSyncing, setManualSyncing] = useState(false)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  const template = noteTemplateService.getTemplate(templateId) ?? noteTemplateService.getAllTemplates()[0]
  const allTemplates = noteTemplateService.getAllTemplates()
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize draft and network listeners
  useEffect(() => {
    const status = offlineSyncService.getStatus()
    setIsOnline(status.isOnline)

    // Load existing draft if available
    const existing = offlineSyncService.getDraftNote(draftId)
    if (existing) {
      setContent(existing.content)
      setDocStatus(existing.docStatus)
      setTemplateId(existing.templateId)
      setSyncStatus(existing.syncStatus)
      setLastSavedAt(existing.clientUpdatedAt)
    }

    const unsubOnline = offlineSyncService.on('online', () => setIsOnline(true))
    const unsubOffline = offlineSyncService.on('offline', () => setIsOnline(false))
    const unsubConflict = offlineSyncService.on('conflict', (data: unknown) => {
      const payload = data as { id?: string }
      if (payload?.id === draftId) {
        setSyncStatus('conflict')
        setConflictMessage('Server version differs. Click resolve or force sync.')
      }
    })

    return () => {
      unsubOnline()
      unsubOffline()
      unsubConflict()
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [draftId])

  // Autosave callback
  const saveDraft = useCallback(
    async (updatedContent: Record<string, string>, status: 'preliminary' | 'final') => {
      setSyncStatus('syncing')
      try {
        const draft = await offlineSyncService.queueDraftNote({
          id: draftId,
          templateId,
          patientId,
          authorId,
          encounterId,
          content: updatedContent,
          docStatus: status,
        })
        setDraftId(draft.id)
        setSyncStatus(draft.syncStatus)
        setLastSavedAt(draft.clientUpdatedAt)
        onSaved?.(draft)
      } catch {
        setSyncStatus('failed')
      }
    },
    [draftId, templateId, patientId, authorId, encounterId, onSaved],
  )

  const handleContentChange = (sectionKey: string, value: string) => {
    const updated = { ...content, [sectionKey]: value }
    setContent(updated)
    setSyncStatus('pending')

    // Debounce autosave 1.5s
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    autosaveTimerRef.current = setTimeout(() => {
      void saveDraft(updated, docStatus)
    }, 1500)
  }

  const handleManualSave = async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    setManualSyncing(true)
    await saveDraft(content, docStatus)
    await offlineSyncService.syncDraftNote(draftId, { force: true })
    const updated = offlineSyncService.getDraftNote(draftId)
    if (updated) {
      setSyncStatus(updated.syncStatus)
    }
    setManualSyncing(false)
  }

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="w-full max-w-full space-y-4 font-sans" style={{ color: 'var(--np-text)' }}>
      {/* Header & Status Indicator */}
      <div
        className="flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: 'var(--np-surface)', border: '1px solid var(--np-line)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: 'var(--np-elevated)', color: 'var(--np-text)' }}
          >
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold sm:text-lg">Clinical Note Editor</h2>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--np-muted)' }}>
              {isOnline ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Cloud className="h-3.5 w-3.5" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400">
                  <CloudOff className="h-3.5 w-3.5" /> Offline Mode (Drafting Enabled)
                </span>
              )}
              <span>•</span>
              {syncStatus === 'synced' && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                </span>
              )}
              {syncStatus === 'syncing' && (
                <span className="flex items-center gap-1 text-sky-400">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...
                </span>
              )}
              {syncStatus === 'pending' && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Save className="h-3.5 w-3.5" /> Unsaved Changes
                </span>
              )}
              {syncStatus === 'conflict' && (
                <span className="flex items-center gap-1 text-rose-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Sync Conflict
                </span>
              )}
              {lastSavedAt && <span>· Last: {new Date(lastSavedAt).toLocaleTimeString()}</span>}
            </div>
          </div>
        </div>

        {/* Action buttons (min 44px touch target) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleManualSave()}
            disabled={manualSyncing}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: 'var(--np-elevated)', color: 'var(--np-text)' }}
            aria-label="Save draft note"
          >
            <Save className="h-4 w-4" />
            <span>{manualSyncing ? 'Syncing...' : 'Save Draft'}</span>
          </button>
        </div>
      </div>

      {conflictMessage && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg p-3 text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--np-line)',
            color: 'var(--np-text)',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <span>{conflictMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setConflictMessage(null)
              void offlineSyncService.syncDraftNote(draftId, {
                conflictStrategy: 'client-wins',
                force: true,
              })
            }}
            className="min-h-[44px] rounded px-3 py-1 text-xs font-semibold text-rose-400 underline"
          >
            Overwrite Server
          </button>
        </div>
      )}

      {/* Template & Status Selectors */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="template-select"
            className="mb-1 block text-xs font-medium"
            style={{ color: 'var(--np-muted)' }}
          >
            Modality Template
          </label>
          <select
            id="template-select"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="min-h-[44px] w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: 'var(--np-surface)',
              color: 'var(--np-text)',
              border: '1px solid var(--np-line)',
            }}
          >
            {allTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="doc-status-select"
            className="mb-1 block text-xs font-medium"
            style={{ color: 'var(--np-muted)' }}
          >
            Document Status
          </label>
          <select
            id="doc-status-select"
            value={docStatus}
            onChange={(e) => {
              const val = e.target.value as 'preliminary' | 'final'
              setDocStatus(val)
              void saveDraft(content, val)
            }}
            className="min-h-[44px] w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: 'var(--np-surface)',
              color: 'var(--np-text)',
              border: '1px solid var(--np-line)',
            }}
          >
            <option value="preliminary">Preliminary (Draft)</option>
            <option value="final">Final (Ready for Sign)</option>
          </select>
        </div>
      </div>

      {/* Modality Template Sections */}
      <div className="space-y-3">
        {template?.sections.map((sec) => {
          const isCollapsed = Boolean(collapsedSections[sec.key])
          const value = content[sec.key] ?? ''

          return (
            <div
              key={sec.key}
              className="rounded-lg overflow-hidden"
              style={{
                background: 'var(--np-surface)',
                border: '1px solid var(--np-line)',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection(sec.key)}
                className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left font-medium transition-colors"
                style={{ background: 'var(--np-elevated)', color: 'var(--np-text)' }}
                aria-expanded={!isCollapsed}
                aria-controls={`section-input-${sec.key}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{sec.label}</span>
                  {sec.required && (
                    <span className="text-xs text-amber-400 font-normal">*Required</span>
                  )}
                  {sec.loincCode && (
                    <span className="text-[11px]" style={{ color: 'var(--np-muted)' }}>
                      LOINC: {sec.loincCode}
                    </span>
                  )}
                </div>
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>

              {!isCollapsed && (
                <div className="p-4" id={`section-input-${sec.key}`}>
                  <textarea
                    value={value}
                    onChange={(e) => handleContentChange(sec.key, e.target.value)}
                    placeholder={`Document ${sec.label.toLowerCase()}...`}
                    rows={4}
                    className="w-full resize-y rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
                    style={{
                      background: 'var(--np-bg)',
                      color: 'var(--np-text)',
                      border: '1px solid var(--np-line)',
                    }}
                    aria-label={sec.label}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ModalityNoteEditor
