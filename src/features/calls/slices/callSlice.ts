import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { CallSession, CallStatus, CallType, CallPeer } from '@/types/call'

type CallState = {
  activeCall: CallSession | null
}

const initialState: CallState = {
  activeCall: null,
}

export const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    startOutgoingCall(state, action: PayloadAction<{ peer: CallPeer; callType: CallType; roomId?: string }>) {
      const { peer, callType, roomId } = action.payload
      state.activeCall = {
        peer,
        callType,
        status: 'outgoing',
        roomId,
        startedAt: Date.now(),
      }
    },
    setCallStatus(state, action: PayloadAction<{ status: CallStatus; error?: string }>) {
      if (!state.activeCall) return
      state.activeCall.status = action.payload.status
      if (action.payload.error) {
        state.activeCall.error = action.payload.error
      }
      if (action.payload.status === 'ended' || action.payload.status === 'failed') {
        state.activeCall.startedAt = state.activeCall.startedAt ?? Date.now()
      }
    },
    setCallSession(state, action: PayloadAction<{ callId?: string; roomId?: string; token?: string }>) {
      if (!state.activeCall) return
      state.activeCall.callId = action.payload.callId ?? state.activeCall.callId
      state.activeCall.roomId = action.payload.roomId ?? state.activeCall.roomId
      state.activeCall.token = action.payload.token ?? state.activeCall.token
    },
    receiveIncomingCall(state, action: PayloadAction<{ peer: CallPeer; callType: CallType; callId?: string; roomId?: string }>) {
      state.activeCall = {
        peer: action.payload.peer,
        callType: action.payload.callType,
        status: 'ringing',
        callId: action.payload.callId,
        roomId: action.payload.roomId,
        startedAt: Date.now(),
      }
    },
    clearCall(state) {
      state.activeCall = null
    },
  },
})

export const {
  startOutgoingCall,
  setCallStatus,
  setCallSession,
  receiveIncomingCall,
  clearCall,
} = callSlice.actions

export default callSlice.reducer
