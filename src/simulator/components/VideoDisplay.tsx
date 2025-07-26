import React, { useEffect, useRef, useState } from 'react'
import type { UserSession } from '../types'
import { toast } from 'sonner'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { signalingService } from '../../lib/services/WebRTCSignalingService'
import type { SignalingMessage } from '../../lib/services/WebRTCSignalingService'

const logger = createBuildSafeLogger('VideoDisplay')

interface VideoDisplayProps {
  isConnected: boolean
  connectionStatus: UserSession['connectionStatus']
  className?: string
  sessionId: string
  userId: string
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
}

interface IceServer {
  urls: string[]
  username?: string
  credential?: string
}

const ICE_SERVERS: IceServer[] = [
  {
    urls: [
      process.env.TURN_SERVER_URL || 'turn:turn.pixelatedempathy.com:3478',
    ],

    username: process.env.TURN_SERVER_USERNAME,
    credential: process.env.TURN_SERVER_PASSWORD,
  },
  { urls: ['stun:stun.l.google.com:19302'] },
]

/**
 * Production-grade video chat component for therapeutic interactions
 * Implements WebRTC with TURN/STUN server support and automatic reconnection
 */
const VideoDisplay: React.FC<VideoDisplayProps> = ({
  isConnected,
  connectionStatus,
  className = '',
  sessionId,
  userId,
  onConnectionStateChange,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  const [isReconnecting, setIsReconnecting] = useState(false)
  const [hasPermissionError, setHasPermissionError] = useState(false)

  // Initialize WebRTC peer connection
  const initializePeerConnection = useCallback(() => {
    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceTransportPolicy: 'relay', // Force usage of TURN server for privacy
      })

      // Handle ICE candidate events
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await signalingService.sendIceCandidate(
              sessionId,
              userId,
              event.candidate.toJSON(),
            )
          } catch (error) {
            logger.error('Failed to send ICE candidate', { error, sessionId })
          }
        }
      }

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        logger.info('Connection state changed', {
          state: peerConnection.connectionState,
          sessionId,
        })

        onConnectionStateChange?.(peerConnection.connectionState)

        if (peerConnection.connectionState === 'failed') {
          handleConnectionFailure()
        }
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0]
          logger.info('Received remote stream', { sessionId })
        }
      }

      peerConnectionRef.current = peerConnection
      return peerConnection
    } catch (error) {
      logger.error('Failed to initialize peer connection', { error, sessionId })
      toast.error('Failed to establish video connection')
      return null
    }
  }, [sessionId, userId, onConnectionStateChange, handleConnectionFailure])

  // Handle media stream setup
  const setupMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      })

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Add tracks to peer connection
      const peerConnection = peerConnectionRef.current
      if (peerConnection) {
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream)
        })
      }

      localStreamRef.current = stream
      setHasPermissionError(false)

      logger.info('Local media stream initialized', { sessionId })
    } catch (error) {
      logger.error('Failed to get user media', { error, sessionId })
      setHasPermissionError(true)
      toast.error('Unable to access camera or microphone')
    }
  }, [sessionId])

  // Handle connection failures and reconnection
  const handleConnectionFailure = useCallback(async () => {
    logger.warn('Connection failed, attempting reconnection', { sessionId })
    setIsReconnecting(true)

    try {
      // Clean up existing connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }

      // Reinitialize connection
      const newPeerConnection = initializePeerConnection()
      if (newPeerConnection) {
        await setupMediaStream()
        await createAndSendOffer()
      }
    } catch (error) {
      logger.error('Reconnection failed', { error, sessionId })
      toast.error('Failed to reconnect video call')
    } finally {
      setIsReconnecting(false)
    }
  }, [
    sessionId,
    initializePeerConnection,
    setupMediaStream,
    createAndSendOffer,
  ])

  // Create and send an offer to the peer
  const createAndSendOffer = useCallback(async () => {
    const peerConnection = peerConnectionRef.current
    if (!peerConnection) {
      return
    }

    try {
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      await signalingService.sendOffer(sessionId, userId, offer)
    } catch (error) {
      logger.error('Failed to create and send offer', { error, sessionId })
      toast.error('Failed to establish connection')
    }
  }, [sessionId, userId])

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      const peerConnection = peerConnectionRef.current
      if (!peerConnection) {
        return
      }

      try {
        switch (message.type) {
          case 'offer':
            if (message.data) {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(
                  message.data as RTCSessionDescriptionInit,
                ),
              )
              const answer = await peerConnection.createAnswer()
              await peerConnection.setLocalDescription(answer)
              await signalingService.sendAnswer(sessionId, userId, answer)
            }
            break

          case 'answer':
            if (message.data) {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(
                  message.data as RTCSessionDescriptionInit,
                ),
              )
            }
            break

          case 'ice-candidate':
            if (message.data) {
              await peerConnection.addIceCandidate(
                new RTCIceCandidate(message.data as RTCIceCandidateInit),
              )
            }
            break
        }
      } catch (error) {
        logger.error('Error handling signaling message', {
          error,
          sessionId,
          messageType: message.type,
        })
      }
    },
    [sessionId, userId],
  )

  // Initialize connection when component mounts or when connection status changes
  useEffect(() => {
    if (isConnected && connectionStatus === 'connected') {
      const initialize = async () => {
        const peerConnection = initializePeerConnection()
        if (peerConnection) {
          await setupMediaStream()
          await createAndSendOffer()
        }
      }
      initialize()

      // Register signaling message handler
      const cleanup = signalingService.onMessage(
        sessionId,
        handleSignalingMessage,
      )

      return () => {
        cleanup()
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop())
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close()
        }
      }
    }
  }, [
    isConnected,
    connectionStatus,
    sessionId,
    handleSignalingMessage,
    setupMediaStream,
    createAndSendOffer,
    initializePeerConnection,
  ])

  // Status message based on connection state
  const getStatusMessage = () => {
    if (hasPermissionError) {
      return 'Camera/Microphone access denied'
    }
    if (isReconnecting) {
      return 'Reconnecting...'
    }
    switch (connectionStatus) {
      case 'connecting':
        return 'Establishing secure connection...'
      case 'connected':
        return 'Secure connection established'
      case 'disconnected':
        return 'Connection ended'
      default:
        return 'Ready to start secure session'
    }
  }

  return (
    <div
      className={`video-display relative rounded-lg overflow-hidden bg-gray-800 ${className}`}
      style={{ aspectRatio: '16/9' }}
      role="region"
      aria-label="Video chat interface"
    >
      {/* Remote video (patient/client feed) */}
      <video
        ref={remoteVideoRef}
        className={`absolute inset-0 w-full h-full object-cover ${
          isConnected && !hasPermissionError ? 'opacity-100' : 'opacity-0'
        }`}
        autoPlay
        playsInline
      >
        <track kind="captions" src="" label="English captions" />
      </video>

      {/* Connection error or permission denied state */}
      {(hasPermissionError || !isConnected) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-16 w-16 mb-3 ${
              hasPermissionError ? 'text-red-500' : 'text-gray-500'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {hasPermissionError ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            )}
          </svg>
          <p className="text-lg font-medium text-gray-300">
            {hasPermissionError
              ? 'Camera Access Required'
              : 'Practice Simulation'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {hasPermissionError
              ? 'Please allow access to your camera and microphone'
              : 'Click Start to begin a therapeutic interaction'}
          </p>
        </div>
      )}

      {/* Connection status indicator */}
      <div
        className={`absolute bottom-4 left-4 px-3 py-1 rounded-full text-xs font-medium flex items-center ${
          connectionStatus === 'connected'
            ? 'bg-green-100 text-green-800'
            : connectionStatus === 'connecting' || isReconnecting
              ? 'bg-yellow-100 text-yellow-800 animate-pulse'
              : 'bg-gray-100 text-gray-800'
        }`}
        role="status"
      >
        <span
          className={`w-2 h-2 rounded-full mr-1.5 ${
            connectionStatus === 'connected'
              ? 'bg-green-500'
              : connectionStatus === 'connecting' || isReconnecting
                ? 'bg-yellow-500'
                : 'bg-gray-500'
          }`}
        />

        {getStatusMessage()}
      </div>

      {/* Local video preview */}
      <div
        className="absolute bottom-4 right-4 w-32 h-24 md:w-40 md:h-30 bg-gray-900 rounded overflow-hidden border-2 border-gray-700"
        role="region"
        aria-label="Your video preview"
      >
        <video
          ref={localVideoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        >
          <track kind="captions" src="" label="English captions" />
        </video>
      </div>

      {/* Privacy indicator */}
      <div
        className="absolute top-4 right-4 bg-green-900 bg-opacity-70 text-green-100 text-xs px-2 py-1 rounded-md flex items-center"
        role="status"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5 mr-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        End-to-End Encrypted
      </div>
    </div>
  )
}

export default VideoDisplay

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
