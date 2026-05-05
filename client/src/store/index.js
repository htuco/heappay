import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import referenceDataReducer from './slices/referenceDataSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    referenceData: referenceDataReducer,
  },
})

/**
 * @typedef {ReturnType<typeof store.getState>} RootState
 * @typedef {typeof store.dispatch} AppDispatch
 */
