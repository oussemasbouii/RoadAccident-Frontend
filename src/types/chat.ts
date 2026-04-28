export type ChatContact = {
  id: string
  name: string
  officerId: string
  role: string
  status: 'online' | 'offline' | 'busy'
  lastSeen: string
}

export type ChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'seen' | 'failed'

export type ChatAttachment = {
  id: string
  type: 'IMAGE'
  filename: string
  mimeType: string
  size: number
}

export type ChatMessage = {
  id: string
  senderId: string
  text: string
  timestamp: string
  type?: 'info' | 'alert'
  receivers?: string[]
  status?: ChatMessageStatus
  attachment?: ChatAttachment
  reactions?: Record<string, string[]>
}
