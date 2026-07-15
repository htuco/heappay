import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as authService from '@/services/authService'
import { getAuthRefreshToken, getAuthToken } from '@/utils/authStorage'
import { getApiErrorMessage, getApiErrorPayload } from '@/utils/api'

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

/** Re-fetch /auth/me (e.g. on window focus) so status_id changes apply without full reload. */
export const refreshSession = createAsyncThunk(
  'auth/refreshSession',
  async (_, { rejectWithValue }) => {
    const hasAccessToken = Boolean(getAuthToken())
    const hasRefreshToken = Boolean(getAuthRefreshToken())

    if (!hasAccessToken && !hasRefreshToken) {
      return null
    }

    try {
      return await authService.getMe()
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Failed to refresh session.'))
    }
  },
)

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password, remember, hcaptchaToken }, { rejectWithValue }) => {
    try {
      return await authService.login({ email, password, remember, hcaptchaToken })
    } catch (error) {
      return rejectWithValue(getApiErrorPayload(error, 'Could not log in. Please try again.'))
    }
  },
)

export const verifyTotpLogin = createAsyncThunk(
  'auth/verifyTotpLogin',
  async ({ partialToken, code, remember }, { rejectWithValue }) => {
    try {
      return await authService.verifyTotp({ partialToken, code, remember })
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Invalid authentication code.'))
    }
  },
)

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async ({ firstName, lastName, email, password, hcaptchaToken }, { rejectWithValue }) => {
    try {
      const user = await authService.register({ firstName, lastName, email, password, hcaptchaToken })
      return user
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Could not create your account. Please try again.'))
    }
  },
)

export const updateProfileUser = createAsyncThunk(
  'auth/updateProfileUser',
  async ({ firstName, lastName, email, avatarUrl, isDiscoverable }, { rejectWithValue }) => {
    try {
      const user = await authService.updateProfile({
        firstName,
        lastName,
        email,
        avatarUrl,
        isDiscoverable,
      })
      return user
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Profile update failed.'))
    }
  },
)

export const uploadProfileAvatarUser = createAsyncThunk(
  'auth/uploadProfileAvatarUser',
  async (file, { rejectWithValue }) => {
    try {
      return await authService.uploadProfileAvatar(file)
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Could not upload profile photo.'))
    }
  },
)

export const updateNotificationPreferences = createAsyncThunk(
  'auth/updateNotificationPreferences',
  async (
    {
      billingRemindersEnabled,
      emailPaymentSentEnabled,
      emailPaymentReceivedEnabled,
      emailTopupEnabled,
      emailRefundStatusEnabled,
      notifyOnUserRequests,
    },
    { rejectWithValue },
  ) => {
    try {
      return await authService.updateNotificationPreferences({
        billingRemindersEnabled,
        emailPaymentSentEnabled,
        emailPaymentReceivedEnabled,
        emailTopupEnabled,
        emailRefundStatusEnabled,
        notifyOnUserRequests,
      })
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, 'Could not save notification preferences.'),
      )
    }
  },
)

export const updatePaymentSecurityPreferences = createAsyncThunk(
  'auth/updatePaymentSecurityPreferences',
  async ({ paymentConfirmEnabled, paymentConfirmAboveAmount }, { rejectWithValue }) => {
    try {
      return await authService.updatePaymentSecurityPreferences({
        paymentConfirmEnabled,
        paymentConfirmAboveAmount,
      })
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, 'Could not save payment security preferences.'),
      )
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
    totpPartialToken: null,
    totpRemember: true,
  },
  reducers: {
    clearAuthState: (state) => {
      state.user = null
      state.status = 'unauthenticated'
      state.error = null
      state.totpPartialToken = null
      state.totpRemember = true
    },
    clearTotpPending: (state) => {
      state.status = 'unauthenticated'
      state.error = null
      state.totpPartialToken = null
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
      .addCase(refreshSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload
          state.status = 'authenticated'
        }
        state.error = null
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        if (action.payload?.requiresTotp) {
          state.status = 'totp_pending'
          state.totpPartialToken = action.payload.partialToken
          state.totpRemember = action.payload.remember ?? true
          state.error = null
        } else {
          state.user = action.payload
          state.status = 'authenticated'
          state.error = null
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.user = null
        state.status = 'unauthenticated'
        state.error = typeof action.payload === 'string'
          ? action.payload
          : action.payload?.message ?? 'Could not log in. Please try again.'
      })
      .addCase(verifyTotpLogin.pending, (state) => {
        state.status = 'totp_pending'
        state.error = null
      })
      .addCase(verifyTotpLogin.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
        state.error = null
        state.totpPartialToken = null
      })
      .addCase(verifyTotpLogin.rejected, (state, action) => {
        state.status = 'totp_pending'
        state.error = action.payload ?? 'Invalid authentication code.'
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
        state.error = action.payload ?? 'Could not create your account. Please try again.'
      })
      .addCase(updateProfileUser.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
        state.error = null
      })
      .addCase(uploadProfileAvatarUser.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'authenticated'
        state.error = null
      })
      .addCase(updateProfileUser.rejected, (state, action) => {
        state.error = action.payload ?? 'Profile update failed.'
      })
      .addCase(updateNotificationPreferences.fulfilled, (state, action) => {
        state.user = action.payload
        state.error = null
      })
      .addCase(updatePaymentSecurityPreferences.fulfilled, (state, action) => {
        state.user = action.payload
        state.error = null
      })
      .addCase(uploadProfileAvatarUser.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not upload profile photo.'
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

export const { clearAuthState, clearTotpPending } = authSlice.actions

export const selectAuthState = (state) => state.auth
export const selectAuthUser = (state) => state.auth.user
export const selectAuthStatus = (state) => state.auth.status
export const selectAuthError = (state) => state.auth.error
export const selectTotpPartialToken = (state) => state.auth.totpPartialToken
export const selectTotpRemember = (state) => state.auth.totpRemember

export default authSlice.reducer
