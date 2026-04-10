export type CallType = 'audio' | 'video'

export type CallStatus = 'idle' | 'outgoing' | 'ringing' | 'in_call' | 'ended' | 'failed'

export type CallPeer = {
  id: string
  name: string
  officerId: string
  role?: string
}

export type CallSession = {
  callId?: string
  roomId?: string
  token?: string
  callType: CallType
  status: CallStatus
  peer: CallPeer
  startedAt?: number
  error?: string
}
