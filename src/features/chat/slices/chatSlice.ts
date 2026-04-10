import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { ChatContact, ChatMessage, ChatMessageStatus } from '@/types/chat'

type ChatState = {
  contacts: Record<string, ChatContact>
  contactIds: string[]
  messagesByPeer: Record<string, ChatMessage[]>
  unreadByPeer: Record<string, number>
  activePopups: string[]
  activePeerId: string | null
  openThreads: string[]
  minimizedThreads: Record<string, boolean>
  typingByPeer: Record<string, number>
}

const initialState: ChatState = {
  contacts: {},
  contactIds: [],
  messagesByPeer: {},
  unreadByPeer: {},
  activePopups: [],
  activePeerId: null,
  openThreads: [],
  minimizedThreads: {},
  typingByPeer: {},
}

type AddMessagePayload = {
  peerId: string
  message: ChatMessage
  incoming: boolean
  forcePopup?: boolean
}

type SetContactsPayload = {
  contacts: ChatContact[]
}

type UpdateContactPayload = {
  id: string
  changes: Partial<ChatContact>
}

type UpdateMessageStatusPayload = {
  messageId: string
  status: ChatMessageStatus
}

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setContacts(state, action: PayloadAction<SetContactsPayload>) {
      const contacts = action.payload.contacts
      state.contacts = {}
      state.contactIds = []
      contacts.forEach((contact) => {
        state.contacts[contact.id] = contact
        state.contactIds.push(contact.id)
      })
    },
    updateContact(state, action: PayloadAction<UpdateContactPayload>) {
      const { id, changes } = action.payload
      if (!state.contacts[id]) return
      state.contacts[id] = { ...state.contacts[id], ...changes }
    },
    addMessage(state, action: PayloadAction<AddMessagePayload>) {
      const { peerId, message, incoming, forcePopup } = action.payload
      if (!state.messagesByPeer[peerId]) {
        state.messagesByPeer[peerId] = []
      }
      const existingIndex = state.messagesByPeer[peerId].findIndex((item) => item.id === message.id)
      if (existingIndex >= 0) {
        state.messagesByPeer[peerId][existingIndex] = {
          ...state.messagesByPeer[peerId][existingIndex],
          ...message,
        }
      } else {
        state.messagesByPeer[peerId].push(message)
      }

      if (incoming && (forcePopup || state.activePeerId !== peerId)) {
        state.unreadByPeer[peerId] = (state.unreadByPeer[peerId] || 0) + 1
        if (!state.activePopups.includes(peerId)) {
          state.activePopups = [peerId, ...state.activePopups].slice(0, 3)
        }
      }
    },
    openThread(state, action: PayloadAction<{ peerId: string }>) {
      const { peerId } = action.payload
      const next = [peerId, ...state.openThreads.filter((id) => id !== peerId)]
      const trimmed = next.slice(0, 3)
      const evicted = next.slice(3)
      state.openThreads = trimmed
      evicted.forEach((id) => {
        delete state.minimizedThreads[id]
      })
      delete state.minimizedThreads[peerId]
      state.activePeerId = peerId
      state.unreadByPeer[peerId] = 0
      state.activePopups = state.activePopups.filter((id) => id !== peerId)
    },
    closeThread(state, action: PayloadAction<{ peerId: string }>) {
      const { peerId } = action.payload
      state.openThreads = state.openThreads.filter((id) => id !== peerId)
      delete state.minimizedThreads[peerId]
      if (state.activePeerId === peerId) {
        state.activePeerId = null
      }
    },
    minimizeThread(state, action: PayloadAction<{ peerId: string; minimized: boolean }>) {
      const { peerId, minimized } = action.payload
      if (minimized) {
        state.minimizedThreads[peerId] = true
      } else {
        delete state.minimizedThreads[peerId]
      }
    },
    focusThread(state, action: PayloadAction<{ peerId: string }>) {
      const { peerId } = action.payload
      state.activePeerId = peerId
      state.unreadByPeer[peerId] = 0
      state.activePopups = state.activePopups.filter((id) => id !== peerId)
    },
    updateMessageStatus(state, action: PayloadAction<UpdateMessageStatusPayload>) {
      const { messageId, status } = action.payload
      const statusRank: ChatMessageStatus[] = ['sending', 'sent', 'delivered', 'seen', 'failed']
      const nextRank = statusRank.indexOf(status)

      for (const peerId of Object.keys(state.messagesByPeer)) {
        const messages = state.messagesByPeer[peerId]
        const index = messages.findIndex((item) => item.id === messageId)
        if (index >= 0) {
          const current = messages[index].status
          if (current && statusRank.indexOf(current) > nextRank && status !== 'failed') {
            return
          }
          messages[index].status = status
          return
        }
      }
    },
    markRead(state, action: PayloadAction<{ peerId: string }>) {
      const { peerId } = action.payload
      state.unreadByPeer[peerId] = 0
      state.activePopups = state.activePopups.filter((id) => id !== peerId)
    },
    setActivePeer(state, action: PayloadAction<{ peerId: string | null }>) {
      state.activePeerId = action.payload.peerId
      if (action.payload.peerId) {
        state.unreadByPeer[action.payload.peerId] = 0
        state.activePopups = state.activePopups.filter((id) => id !== action.payload.peerId)
      }
    },
    setTyping(state, action: PayloadAction<{ peerId: string; timestamp: number }>) {
      state.typingByPeer[action.payload.peerId] = action.payload.timestamp
    },
    clearTyping(state, action: PayloadAction<{ peerId: string }>) {
      delete state.typingByPeer[action.payload.peerId]
    },
  dismissPopup(state, action: PayloadAction<{ peerId: string }>) {
    state.activePopups = state.activePopups.filter((id) => id !== action.payload.peerId)
  },
    clearPopups(state) {
      state.activePopups = []
    },
  },
})

export const {
  setContacts,
  updateContact,
  addMessage,
  openThread,
  closeThread,
  minimizeThread,
  focusThread,
  updateMessageStatus,
  markRead,
  setActivePeer,
  dismissPopup,
  clearPopups,
  setTyping,
  clearTyping,
} = chatSlice.actions

export default chatSlice.reducer
