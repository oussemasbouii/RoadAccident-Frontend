import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface NotificationsState {
  pendingAccountsCount: number
}

const initialState: NotificationsState = {
  pendingAccountsCount: 0,
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setPendingAccountsCount(state, action: PayloadAction<number>) {
      state.pendingAccountsCount = action.payload
    },
  },
})

export const { setPendingAccountsCount } = notificationsSlice.actions
export default notificationsSlice.reducer
