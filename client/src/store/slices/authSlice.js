import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as authService from '@/services/authService'
import { getAuthRefreshToken, getAuthToken } from '@/utils/authStorage'
import { getApiErrorMessage } from '@/utils/api'

export const hydrateSession = createAsyncThunk(
  'auth/hydrateSession',
  async (_, { rejectWithValue }) => {
    const hasAccessToken = Boolean(getAuthToken())
    const hasRefreshToken = Boolean(getAuthRefreshToken())

    if (!hasAccessToken && !hasRefreshToken) {
      return null
    }

    try {
      const user = await authService.getMe()
      return user
    } catch (error) {
      await authService.logout()
      return rejectWithValue(getApiErrorMessage(error, 'Failed to restore session.'))
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState()
      return state.auth.status === 'idle'
    },
  },
)

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password, remember }, { rejectWithValue }) => {
    try {
      const user = await authService.login({ email, password, remember })
      return user
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Login failed.'))
    }
  },
)

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async ({ firstName, lastName, email, password }, { rejectWithValue }) => {
    try {
      const user = await authService.register({ firstName, lastName, email, password })
      return user
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Registration failed.'))
    }
  },
)

export const updateProfileUser = createAsyncThunk(
  'auth/updateProfileUser',
  async ({ firstName, lastName, email }, { rejectWithValue }) => {
    try {
      const user = await authService.updateProfile({ firstName, lastName, email })
      return user
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Profile update failed.'))
    }
  },
)

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  await authService.logout()
})

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    /**
     * Clears in-memory auth immediately (e.g. after deactivate clears storage).
     * Dispatch before navigation so protected UI and admin controls unmount synchronously.
     */
    clearAuthState: (state) => {
      state.user = null
      state.status = 'unauthenticated'
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateSession.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(hydrateSession.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = action.payload ? 'authenticated' : 'unauthenticated'
        state.error = null
      })
      .addCase(hydrateSession.rejected, (state, action) => {
        state.user = null
        state.status = 'unauthenticated'
        state.error = action.payload ?? 'Failed to restore session.'
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
        state.error = null
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.user = null
        state.status = 'unauthenticated'
        state.error = action.payload ?? 'Login failed.'
      })
      .addCase(registerUser.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
        state.error = null
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.user = null
        state.status = 'unauthenticated'
        state.error = action.payload ?? 'Registration failed.'
      })
      .addCase(updateProfileUser.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
        state.error = null
      })
      .addCase(updateProfileUser.rejected, (state, action) => {
        state.error = action.payload ?? 'Profile update failed.'
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.status = 'unauthenticated'
        state.error = null
      })
      .addCase(logoutUser.rejected, (state) => {
        // Fail-safe: auth service already clears local session.
        state.user = null
        state.status = 'unauthenticated'
      })
  },
})

export const { clearAuthState } = authSlice.actions

export const selectAuthState = (state) => state.auth
export const selectAuthUser = (state) => state.auth.user
export const selectAuthStatus = (state) => state.auth.status
export const selectAuthError = (state) => state.auth.error

export default authSlice.reducer
