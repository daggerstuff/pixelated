import type { ChatMessageWithFHE } from '../../lib/chat/fheChat'

interface FHEChatStatusProps {
  message: ChatMessageWithFHE
  className?: string
}

/**
 * Displays the FHE encryption status of a chat message
 */
export default function FHEChatStatus({
  message,
  className = '',
}: FHEChatStatusProps) {
  // Default to secure if no status is available
  const isEncrypted = message.fheStatus?.encrypted ?? true
  const isVerified = message.fheStatus?.verified ?? true

  return (
    <div className={`fhe-status flex items-center gap-1 ${className}`}>
      {isEncrypted ? (
        <span className="text-green-600 dark:text-green-400 flex items-center">
          <LockIcon className="h-3 w-3 mr-1" />
          Encrypted
        </span>
      ) : (
        <span className="text-amber-600 dark:text-amber-400 flex items-center">
          <UnlockIcon className="h-3 w-3 mr-1" />
          Unencrypted
        </span>
      )}

      {isVerified ? (
        <span className="text-green-600 dark:text-green-400 ml-2 flex items-center">
          <CheckIcon className="h-3 w-3 mr-1" />
          Verified
        </span>
      ) : (
        <span className="text-red-600 dark:text-red-400 ml-2 flex items-center">
          <AlertIcon className="h-3 w-3 mr-1" />
          Unverified
        </span>
      )}
    </div>
  )
}

function LockIcon({ className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function UnlockIcon({ className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
    </svg>
  )
}

function CheckIcon({ className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function AlertIcon({ className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  )
}
