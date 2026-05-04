import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Portal } from '@mui/material'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { getAccessToken, getRefreshToken } from '@/utils/tokenStore'
import { connectSharedSocket } from '@/services/socketClient'
import { closeThread, focusThread, minimizeThread } from '@/features/chat/slices/chatSlice'
import { startOutgoingCall } from '@/features/calls/slices/callSlice'
import ChatWindow from '@/components/ChatWindow'
import { decodeJwtSub } from '@/utils/callUtils'

export default function ChatDockManager() {
  const location = useLocation()
  const dispatch = useAppDispatch()
  const me = useAppSelector((state) => state.auth.user)
  const openThreads = useAppSelector((state) => state.chat.openThreads)
  const minimizedThreads = useAppSelector((state) => state.chat.minimizedThreads)
  const contacts = useAppSelector((state) => state.chat.contacts)
  const messagesByPeer = useAppSelector((state) => state.chat.messagesByPeer)
  const typingByPeer = useAppSelector((state) => state.chat.typingByPeer)
  const unreadByPeer = useAppSelector((state) => state.chat.unreadByPeer)
  const activePeerId = useAppSelector((state) => state.chat.activePeerId)
  const activeCall = useAppSelector((state) => state.call.activeCall)
  const currentUserId =
    me?.id || decodeJwtSub(getRefreshToken()) || decodeJwtSub(getAccessToken()) || null
  const isChatRoute = location.pathname.includes('/communications')
  const [isTabVisible, setIsTabVisible] = useState<boolean>(document.visibilityState === 'visible')

  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    if (!currentUserId) return
    if (openThreads.length === 0) return
    const token = getRefreshToken() || getAccessToken()
    if (!token) return
    const socket = connectSharedSocket(token)
    if (!socket) return

    openThreads.forEach((peerId: string) => {
      if (minimizedThreads[peerId]) return
      if (!isTabVisible) return
      const peerMessages = messagesByPeer[peerId] || []
      const lastIncoming = [...peerMessages].reverse().find((msg) => msg.senderId !== currentUserId)
      if (!lastIncoming) return
      socket.emit(
        'request:message:seen',
        {
          messageId: lastIncoming.id,
          seen: { by: currentUserId, timestamp: new Date().toISOString() },
        },
        () => undefined
      )
    })
  }, [openThreads, minimizedThreads, messagesByPeer, currentUserId, isTabVisible])

  if (!currentUserId || isChatRoute || activeCall) return null

  return (
    <Portal>
      <Box
        sx={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          display: 'flex',
          flexDirection: 'row-reverse',
          gap: 1.5,
          zIndex: 2100,
          alignItems: 'flex-end',
        }}
      >
        {openThreads.map((peerId: string) => {
          const peer = contacts[peerId]
          if (!peer) return null
          const messages = messagesByPeer[peerId] || []
          const isMinimized = Boolean(minimizedThreads[peerId])
          const unreadCount = unreadByPeer[peerId] || 0
          return (
            <ChatWindow
              key={peerId}
              peer={peer}
              messages={messages}
              currentUserId={currentUserId}
              isMinimized={isMinimized}
              isActive={activePeerId === peerId}
              unreadCount={unreadCount}
              typing={Boolean(typingByPeer[peerId])}
              onMinimize={() => {
                dispatch(minimizeThread({ peerId, minimized: !isMinimized }))
              }}
              onClose={() => {
                dispatch(closeThread({ peerId }))
              }}
              onFocus={() => {
                dispatch(focusThread({ peerId }))
              }}
              onCall={(type) => {
                const roomId = crypto.randomUUID()
                dispatch(startOutgoingCall({
                  peer: {
                    id: peer.id,
                    name: peer.name,
                    officerId: peer.officerId,
                    role: peer.role,
                  },
                  callType: type,
                  roomId,
                }))
              }}
            />
          )
        })}
      </Box>
    </Portal>
  )
}
