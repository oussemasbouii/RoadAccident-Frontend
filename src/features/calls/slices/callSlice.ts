import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { CallSession, CallStatus, CallType, CallPeer } from '@/types/call'

type CallState = {
  activeCall: CallSession | null
  callHistory: CallSession[]
}

const initialState: CallState = {
  activeCall: null,
  callHistory: [],
}

export const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    startOutgoingCall(state, action: PayloadAction<{ peer: CallPeer; callType: CallType; roomId?: string; callId?: string }>) {
      const { peer, callType, roomId, callId } = action.payload
      if (state.activeCall && !['ended', 'failed', 'missed'].includes(state.activeCall.status)) {
        console.log('[Redux] startOutgoingCall ignored - active call already exists', state.activeCall.callId)
        return
      }
      state.activeCall = {
        peer,
        callType,
        status: 'outgoing',
        direction: 'outgoing' as const,
        callId,
        roomId,
        startedAt: Date.now(),
      }
      console.log('[Redux] startOutgoingCall', state.activeCall)
    },
    setCallStatus(state, action: PayloadAction<{ status: CallStatus; error?: string; callId?: string }>) {
      if (!state.activeCall) return
      if (action.payload.callId && state.activeCall.callId && action.payload.callId !== state.activeCall.callId) {
        console.log('[Redux] setCallStatus ignored - callId mismatch', {
          activeCallId: state.activeCall.callId,
          payloadCallId: action.payload.callId,
          status: action.payload.status,
        })
        return
      }
      state.activeCall.status = action.payload.status
      if (action.payload.error) {
        state.activeCall.error = action.payload.error
      }
      if (action.payload.status === 'in_call') {
        state.activeCall.startedAt = Date.now()
      }
      if (action.payload.status === 'ended' || action.payload.status === 'failed' || action.payload.status === 'missed') {
        state.activeCall.endedAt = Date.now()
      }
    },
    setCallSession(state, action: PayloadAction<{ callId?: string; roomId?: string; token?: string }>) {
      if (!state.activeCall) {
        console.log('[Redux] setCallSession - no activeCall')
        return
      }
      const canAdoptBackendCallId =
        state.activeCall.direction === 'outgoing' &&
        action.payload.callId &&
        action.payload.roomId &&
        state.activeCall.roomId === action.payload.roomId

      if (
        action.payload.callId &&
        state.activeCall.callId &&
        action.payload.callId !== state.activeCall.callId &&
        !canAdoptBackendCallId
      ) {
        console.log('[Redux] setCallSession ignored - callId mismatch', {
          activeCallId: state.activeCall.callId,
          payloadCallId: action.payload.callId,
        })
        return
      }
      console.log('[Redux] setCallSession before', { callId: state.activeCall.callId, roomId: state.activeCall.roomId })
      state.activeCall.callId = action.payload.callId ?? state.activeCall.callId
      state.activeCall.roomId = action.payload.roomId ?? state.activeCall.roomId
      state.activeCall.token = action.payload.token ?? state.activeCall.token
      console.log('[Redux] setCallSession after', { callId: state.activeCall.callId, roomId: state.activeCall.roomId })
    },
    receiveIncomingCall(state, action: PayloadAction<{ peer: CallPeer; callType: CallType; callId?: string; roomId?: string; token?: string }>) {
      console.log('[Redux] receiveIncomingCall', action.payload)
      if (state.activeCall && !['ended', 'failed', 'missed'].includes(state.activeCall.status)) {
        console.log('[Redux] receiveIncomingCall ignored - active call already exists', state.activeCall.callId)
        return
      }
      state.activeCall = {
        peer: action.payload.peer,
        callType: action.payload.callType,
        status: 'ringing',
        direction: 'incoming' as const,
        callId: action.payload.callId,
        roomId: action.payload.roomId,
        token: action.payload.token,
        startedAt: Date.now(),
      }
      console.log('[Redux] activeCall set to', state.activeCall)
    },
    markCallMissed(state) {
      if (!state.activeCall) return
      const missedCall = {
        ...state.activeCall,
        status: 'missed' as CallStatus,
        endedAt: Date.now(),
      }
      state.callHistory.unshift(missedCall)
      if (state.callHistory.length > 50) {
        state.callHistory = state.callHistory.slice(0, 50)
      }
      state.activeCall = null
    },
    clearCall(state) {
      if (state.activeCall) {
        // Add completed call to history
        const completedCall = {
          ...state.activeCall,
          endedAt: Date.now(),
        }
        state.callHistory.unshift(completedCall) // Add to beginning of array
        // Keep only last 50 calls
        if (state.callHistory.length > 50) {
          state.callHistory = state.callHistory.slice(0, 50)
        }
      }
      state.activeCall = null
    },
  },
})

export const {
  startOutgoingCall,
  setCallStatus,
  setCallSession,
  receiveIncomingCall,
  markCallMissed,
  clearCall,
} = callSlice.actions

export default callSlice.reducer
