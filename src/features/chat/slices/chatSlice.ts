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
  muteByPeer: Record<string, number>
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
  muteByPeer: {},
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

      // Check if sender is muted
      const isSenderMuted = state.muteByPeer[message.senderId] && state.muteByPeer[message.senderId] > Date.now()

      if (incoming && (forcePopup || state.activePeerId !== peerId)) {
        // Only increment unread count and add to popups if not muted
        if (!isSenderMuted) {
          state.unreadByPeer[peerId] = (state.unreadByPeer[peerId] || 0) + 1
          if (!state.activePopups.includes(peerId)) {
            state.activePopups = [peerId, ...state.activePopups].slice(0, 3)
          }
        }
      }
    },
    // Merge a batch of fetched history into a peer's thread: dedupe by id, keep the
    // existing (live) copy of any overlapping message so its status isn't downgraded,
    // and keep the thread sorted oldest-first. Safe to call repeatedly (pagination).
    mergeMessages(state, action: PayloadAction<{ peerId: string; messages: ChatMessage[] }>) {
      const { peerId, messages } = action.payload
      if (!messages.length) return
      const existing = state.messagesByPeer[peerId] || []
      const byId = new Map<string, ChatMessage>()
      existing.forEach((m) => byId.set(m.id, m))
      messages.forEach((m) => {
        const prev = byId.get(m.id)
        // prev (live) fields win over history for overlapping keys (no status downgrade),
        // history fills in anything missing; brand-new history messages are added as-is.
        byId.set(m.id, prev ? { ...m, ...prev } : m)
      })
      state.messagesByPeer[peerId] = Array.from(byId.values()).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
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
          
          // When marking as seen, also mark all previous unseen messages from the same sender as seen
          if (status === 'seen') {
            const senderId = messages[index].senderId
            for (let i = index - 1; i >= 0; i -= 1) {
              const prev = messages[i]
              if (prev.senderId !== senderId) break // Stop at different sender
              if (prev.status === 'failed') continue
              if (prev.status === 'seen') continue
              prev.status = 'seen'
            }
          }
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
    setMute(state, action: PayloadAction<{ peerId: string; until: number }>) {
      state.muteByPeer[action.payload.peerId] = action.payload.until
      // Persist to localStorage
      try {
        const existingMutes = JSON.parse(localStorage.getItem('chatMutes') || '{}')
        existingMutes[action.payload.peerId] = action.payload.until
        localStorage.setItem('chatMutes', JSON.stringify(existingMutes))
      } catch (error) {
        console.warn('Failed to persist mute settings:', error)
      }
    },
    clearMute(state, action: PayloadAction<{ peerId: string }>) {
      delete state.muteByPeer[action.payload.peerId]
      // Remove from localStorage
      try {
        const existingMutes = JSON.parse(localStorage.getItem('chatMutes') || '{}')
        delete existingMutes[action.payload.peerId]
        localStorage.setItem('chatMutes', JSON.stringify(existingMutes))
      } catch (error) {
        console.warn('Failed to remove mute settings:', error)
      }
    },
    loadPersistedMutes(state) {
      try {
        const persistedMutes = JSON.parse(localStorage.getItem('chatMutes') || '{}')
        const now = Date.now()
        // Only load mutes that haven't expired
        Object.entries(persistedMutes).forEach(([peerId, until]) => {
          if (typeof until === 'number' && until > now) {
            state.muteByPeer[peerId] = until
          }
        })
      } catch (error) {
        console.warn('Failed to load persisted mute settings:', error)
      }
    },
    cleanupExpiredMutes(state) {
      const now = Date.now()
      const expiredPeers: string[] = []

      Object.entries(state.muteByPeer).forEach(([peerId, until]) => {
        if (until <= now) {
          expiredPeers.push(peerId)
        }
      })

      expiredPeers.forEach(peerId => {
        delete state.muteByPeer[peerId]
      })

      // Update localStorage
      if (expiredPeers.length > 0) {
        try {
          const existingMutes = JSON.parse(localStorage.getItem('chatMutes') || '{}')
          expiredPeers.forEach(peerId => delete existingMutes[peerId])
          localStorage.setItem('chatMutes', JSON.stringify(existingMutes))
        } catch (error) {
          console.warn('Failed to cleanup expired mutes:', error)
        }
      }
    },
    toggleReaction(
      state,
      action: PayloadAction<{ peerId: string; messageId: string; emoji: string; userId: string }>
    ) {
      const { peerId, messageId, emoji, userId } = action.payload
      const messages = state.messagesByPeer[peerId]
      if (!messages) return
      const idx = messages.findIndex((m) => m.id === messageId)
      if (idx < 0) return
      const current = messages[idx]
      const reactions = { ...(current.reactions || {}) }
      // Only one reaction per user per message: remove user from all emojis first.
      Object.keys(reactions).forEach((key) => {
        reactions[key] = reactions[key].filter((id) => id !== userId)
        if (reactions[key].length === 0) {
          delete reactions[key]
        }
      })
      // Toggle off if the same emoji is selected again.
      const existing = (current.reactions?.[emoji] || []).includes(userId)
      if (!existing) {
        reactions[emoji] = [...(reactions[emoji] || []), userId]
      }
      messages[idx] = { ...current, reactions }
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
  mergeMessages,
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
  setMute,
  clearMute,
  loadPersistedMutes,
  cleanupExpiredMutes,
  toggleReaction,
} = chatSlice.actions

export default chatSlice.reducer
