import {
  Archive as IconArchive,
  ChevronDown as IconChevronDown,
  Download as IconDownload,
  File as IconFile,
  FileType as IconFilePdf,
  Lock as IconLock,
} from 'lucide-react'
import { useState } from 'react'

interface ExportButtonProps {
  sessionId: string
  onExportStart?: () => void
  onExportComplete?: (result: unknown) => void
  onExportError?: (error: Error) => void
  disabled?: boolean
  securityLevel?: 'standard' | 'hipaa' | 'maximum'
}

export default function ExportButton({
  sessionId,
  onExportStart,
  onExportComplete,
  onExportError,
  disabled = false,
  securityLevel = 'hipaa',
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [exportFormat, setExportFormat] = useState('json')
  const [exportError, setExportError] = useState<string | null>(null)

  // Map security level to encryption mode
  const getEncryptionMode = () => {
    switch (securityLevel) {
      case 'standard':
        return 'standard'
      case 'maximum':
        return 'fhe'
      case 'hipaa':
      default:
        return 'hipaa'
    }
  }

  const handleExport = async (format: string) => {
    if (disabled || isExporting || !sessionId) {
      return
    }

    try {
      setIsExporting(true)
      setExportError(null)
      setExportFormat(format)
      setShowOptions(false)

      if (onExportStart) {
        onExportStart()
      }

      // Call export API
      const response = await fetch('/api/export/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          format,
          encryptionMode: getEncryptionMode(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error ?? 'Export failed')
      }

      const result = await response.json()

      // Start download
      window.location.href = result.downloadUrl

      if (onExportComplete) {
        onExportComplete(result)
      }
    } catch (error: unknown) {
      console.error('Export error:', error)
      setExportError(
        error instanceof Error
          ? String(error)
          : 'Failed to export conversation',
      )

      if (onExportError) {
        onExportError(error instanceof Error ? error : new Error(String(error)))
      }
    } finally {
      setIsExporting(false)
    }
  }

  const renderFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <IconFilePdf className="mr-2 h-4 w-4" />
      case 'encrypted_archive':
        return <IconArchive className="mr-2 h-4 w-4" />
      case 'json':
      default:
        return <IconFile className="mr-2 h-4 w-4" />
    }
  }

  return (
    <div className="relative">
      <div className="flex">
        <button
          onClick={async () => handleExport(exportFormat)}
          disabled={disabled || isExporting}
          className={`inline-flex items-center rounded-l-none px-3 py-2 text-sm font-medium ${
            disabled || isExporting
              ? 'cursor-not-allowed bg-secondary text-muted-foreground'
              : 'bg-primary text-primary-foreground hover:bg-accent'
          }`}
          aria-label="Export conversation"
        >
          <IconDownload className="mr-2 h-4 w-4" />
          <span>Export</span>
          {isExporting && <span className="ml-2">...</span>}
        </button>
        <button
          type="button"
          className={`inline-flex items-center rounded-r-none border-l border-primary px-2 py-2 ${
            disabled || isExporting
              ? 'cursor-not-allowed bg-secondary text-muted-foreground'
              : 'bg-primary text-primary-foreground hover:bg-accent'
          }`}
          onClick={() => setShowOptions(!showOptions)}
          disabled={disabled || isExporting}
          aria-label="Show export options"
        >
          <IconChevronDown className="h-4 w-4" />
        </button>
      </div>

      {showOptions && (
        <div className="absolute right-0 z-10 mt-2 w-56 rounded-none border border-border bg-card">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <button
              className="flex w-full items-center px-4 py-2 text-left text-sm text-foreground hover:bg-accent"
              onClick={async () => handleExport('json')}
              role="menuitem"
            >
              {renderFormatIcon('json')}
              <span>JSON (.json)</span>
              <IconLock
                className="ml-auto h-3 w-3 text-foreground"
                aria-label="Encrypted"
              />
            </button>

            <button
              className="flex w-full items-center px-4 py-2 text-left text-sm text-foreground hover:bg-accent"
              onClick={async () => handleExport('pdf')}
              role="menuitem"
            >
              {renderFormatIcon('pdf')}
              <span>PDF Document (.pdf)</span>
              <IconLock
                className="ml-auto h-3 w-3 text-foreground"
                aria-label="Encrypted"
              />
            </button>

            <button
              className="flex w-full items-center px-4 py-2 text-left text-sm text-foreground hover:bg-accent"
              onClick={async () => handleExport('encrypted_archive')}
              role="menuitem"
            >
              {renderFormatIcon('encrypted_archive')}
              <span>Secure Archive (.secz)</span>
              <IconLock
                className="ml-auto h-3 w-3 text-foreground"
                aria-label="Maximum Encryption"
              />
            </button>
          </div>
        </div>
      )}

      {exportError && (
        <div className="mt-2 text-sm text-foreground">{exportError}</div>
      )}
    </div>
  )
}
