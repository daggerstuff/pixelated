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
        throw new Error(errorData.error || 'Export failed')
      }

      const result = await response.json()

      // Start download
      window.location.href = result.downloadUrl

      if (onExportComplete) {
        onExportComplete(result)
      }
    } catch (error) {
      console.error('Export error:', error)
      setExportError(
        error instanceof Error
          ? error.message
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
        return <IconFilePdf className="w-4 h-4 mr-2" />
      case 'encrypted_archive':
        return <IconArchive className="w-4 h-4 mr-2" />
      case 'json':
      default:
        return <IconFile className="w-4 h-4 mr-2" />
    }
  }

  return (
    <div className="relative">
      <div className="flex">
        <button
          onClick={() => handleExport(exportFormat)}
          disabled={disabled || isExporting}
          className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-l-md
            ${
              disabled || isExporting
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          aria-label="Export conversation"
        >
          <IconDownload className="w-4 h-4 mr-2" />
          <span>Export</span>
          {isExporting && <span className="ml-2">...</span>}
        </button>
        <button
          type="button"
          className={`inline-flex items-center px-2 py-2 rounded-r-md border-l border-purple-700
            ${
              disabled || isExporting
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          onClick={() => setShowOptions(!showOptions)}
          disabled={disabled || isExporting}
          aria-label="Show export options"
        >
          <IconChevronDown className="w-4 h-4" />
        </button>
      </div>

      {showOptions && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <button
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 flex items-center"
              onClick={() => handleExport('json')}
              role="menuitem"
            >
              {renderFormatIcon('json')}
              <span>JSON (.json)</span>
              <IconLock
                className="w-3 h-3 ml-auto text-green-400"
                aria-label="Encrypted"
              />
            </button>

            <button
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 flex items-center"
              onClick={() => handleExport('pdf')}
              role="menuitem"
            >
              {renderFormatIcon('pdf')}
              <span>PDF Document (.pdf)</span>
              <IconLock
                className="w-3 h-3 ml-auto text-green-400"
                aria-label="Encrypted"
              />
            </button>

            <button
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 flex items-center"
              onClick={() => handleExport('encrypted_archive')}
              role="menuitem"
            >
              {renderFormatIcon('encrypted_archive')}
              <span>Secure Archive (.secz)</span>
              <IconLock
                className="w-3 h-3 ml-auto text-green-400"
                aria-label="Maximum Encryption"
              />
            </button>
          </div>
        </div>
      )}

      {exportError && (
        <div className="mt-2 text-sm text-red-500">{exportError}</div>
      )}
    </div>
  )
}
