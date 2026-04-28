import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useAppDispatch } from '@/store/store'
import { getAccessToken, getRefreshToken } from '@/utils/tokenStore'
import { connectSharedSocket } from '@/services/socketClient'
import { apiService } from '@/services/api'
import { addMessage, updateMessageStatus } from '@/features/chat/slices/chatSlice'
import type { ChatAttachment, ChatContact, ChatMessage } from '@/types/chat'

type UseChatComposerArgs = {
  peer: ChatContact | null
  currentUserId: string | null
  messages: ChatMessage[]
}

export function useChatComposer({ peer, currentUserId, messages }: UseChatComposerArgs) {
  const dispatch = useAppDispatch()
  const [draft, setDraft] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ url: string; filename: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const lastTypingSentRef = useRef<number>(0)

  const emitTyping = () => {
    if (!peer?.id) return
    const token = getRefreshToken() || getAccessToken()
    if (!token) return
    const socket = connectSharedSocket(token)
    if (!socket) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < 900) return
    lastTypingSentRef.current = now
    socket.emit('request:typing', { recipientId: peer.id })
  }

  const handleSend = () => {
    if ((!draft.trim() && !pendingAttachment) || !peer?.id || !currentUserId) return
    const token = getRefreshToken() || getAccessToken()
    if (!token) {
      if (import.meta.env.DEV) console.warn('[Chat] Missing auth token')
      return
    }
    const socket = connectSharedSocket(token)
    if (!socket) {
      if (import.meta.env.DEV) console.warn('[Chat] Socket not available')
      return
    }

    const senderId = String(currentUserId || '')
    if (!senderId) return
    const messageId = crypto.randomUUID()
    const receiverId = String(peer.id)
    const payload = {
      message: {
        id: messageId,
        content: draft.trim() || pendingAttachment?.filename || 'Attachment',
        messageType: pendingAttachment ? 'media' : 'text',
        senderId,
        receivers: [receiverId],
        timestamp: new Date().toISOString(),
        attachment: pendingAttachment || undefined,
        encryption: { keys: [] },
      },
    }

    const optimistic: ChatMessage = {
      id: messageId,
      senderId,
      receivers: [receiverId],
      text: draft.trim() || pendingAttachment?.filename || 'Attachment',
      timestamp: new Date().toISOString(),
      status: 'sending',
      attachment: pendingAttachment || undefined,
    }
    dispatch(addMessage({ peerId: receiverId, message: optimistic, incoming: false }))

    const emitSend = () => {
      if (import.meta.env.DEV) {
        console.log('[Chat] emitting message:send', {
          messageId,
          to: receiverId,
          content: payload.message.content.substring(0, 50),
        })
      }
      socket.emit('request:message:send', payload, (ack: { acknowledged?: boolean; error?: string }) => {
        if (ack?.acknowledged) {
          if (import.meta.env.DEV) {
            console.log('[Chat] message:send acknowledged', messageId)
          }
          setDraft('')
          setPendingAttachment(null)
          dispatch(updateMessageStatus({ messageId, status: 'sent' }))
        } else {
          if (import.meta.env.DEV) {
            console.warn('[Chat] message:send failed', ack?.error || 'unknown error', messageId)
          }
          dispatch(updateMessageStatus({ messageId, status: 'failed' }))
        }
      })
    }

    if (!socket.connected) {
      socket.once('connect', emitSend)
    } else {
      emitSend()
    }
  }

  const handleFilePick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !peer?.id) return
    if (!file.type.startsWith('image/')) {
      if (import.meta.env.DEV) console.warn('[Chat] Only image attachments are supported for now')
      return
    }

    try {
      const requestResp = await apiService.attachments.requestUpload({
        filename: file.name,
        mimeType: file.type,
        fileType: 'IMAGE',
        size: file.size,
      })
      const requestData = requestResp.data?.data || requestResp.data || {}
      const uploadUrl = requestData.uploadUrl
      const key = requestData.key
      if (!uploadUrl || !key) throw new Error('Upload URL missing')

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      const confirmResp = await apiService.attachments.confirmUpload({
        clientId: crypto.randomUUID(),
        key,
        filename: file.name,
        mimeType: file.type,
        fileType: 'IMAGE',
        size: file.size,
      })
      const confirmData = confirmResp.data?.data || confirmResp.data || {}
      if (!confirmData.id) throw new Error('Attachment id missing')

      setPendingAttachment({
        id: confirmData.id,
        type: 'IMAGE',
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      })
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[Chat] Attachment upload failed', error)
      }
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDownloadImage = async () => {
    if (!lightbox?.url) return
    try {
      const response = await fetch(lightbox.url)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = lightbox.filename || 'attachment'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[Chat] Failed to download attachment', error)
      }
    }
  }

  useEffect(() => {
    if (!peer) return
    const attachments = messages
      .map((msg) => msg.attachment)
      .filter((item): item is ChatAttachment => Boolean(item))
    const missing = attachments.filter((att) => !attachmentUrls[att.id])
    if (missing.length === 0) return

    let cancelled = false
    ;(async () => {
      const updates: Record<string, string> = {}
      for (const att of missing) {
        try {
          const resp = await apiService.attachments.getDownload(att.id)
          const data = resp.data?.data || resp.data || {}
          if (data?.downloadUrl) {
            updates[att.id] = data.downloadUrl
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('[Chat] Failed to fetch attachment preview', error)
          }
        }
      }
      if (!cancelled && Object.keys(updates).length) {
        setAttachmentUrls((prev) => ({ ...prev, ...updates }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [peer?.id, messages, attachmentUrls])

  return {
    draft,
    setDraft,
    pendingAttachment,
    setPendingAttachment,
    attachmentUrls,
    lightbox,
    setLightbox,
    fileInputRef,
    handleFilePick,
    handleFileChange,
    handleSend,
    emitTyping,
    handleDownloadImage,
  }
}
