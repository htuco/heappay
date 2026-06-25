import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { userRolesService } from '@/services/userRolesService'
import { userStatusesService } from '@/services/userStatusesService'
import { cardStatusesService } from '@/services/cardStatusesService'
import { cardTypesService } from '@/services/cardTypesService'
import { transactionCategoriesService } from '@/services/transactionCategoriesService'
import { getApiErrorMessage } from '@/utils/api'

const DEFAULT_STATUS = Object.freeze({
  userRoles: 'idle',
  userStatuses: 'idle',
  cardStatuses: 'idle',
  cardTypes: 'idle',
  transactionCategories: 'idle',
})

const DEFAULT_ERRORS = Object.freeze({
  userRoles: null,
  userStatuses: null,
  cardStatuses: null,
  cardTypes: null,
  transactionCategories: null,
})

const isLoadedOrLoading = (value) => value === 'loading' || value === 'succeeded'

export const fetchUserRoles = createAsyncThunk(
  'referenceData/fetchUserRoles',
  async (_, { rejectWithValue }) => {
    try {
      return await userRolesService.list()
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Failed to load user roles.'))
    }
  },
)

export const fetchUserStatuses = createAsyncThunk(
  'referenceData/fetchUserStatuses',
  async (_, { rejectWithValue }) => {
    try {
      return await userStatusesService.list()
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Failed to load user statuses.'))
    }
  },
)

export const fetchCardStatuses = createAsyncThunk(
  'referenceData/fetchCardStatuses',
  async (_, { rejectWithValue }) => {
    try {
      return await cardStatusesService.list()
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Failed to load card statuses.'))
    }
  },
)

export const fetchCardTypes = createAsyncThunk(
  'referenceData/fetchCardTypes',
  async (_, { rejectWithValue }) => {
    try {
      return await cardTypesService.list()
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Failed to load card types.'))
    }
  },
)

export const fetchTransactionCategories = createAsyncThunk(
  'referenceData/fetchTransactionCategories',
  async (_, { rejectWithValue }) => {
    try {
      return await transactionCategoriesService.list()
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, 'Failed to load transaction categories.'),
      )
    }
  },
)

export const fetchReferenceDataOnce = createAsyncThunk(
  'referenceData/fetchReferenceDataOnce',
  async (_, { dispatch, getState }) => {
    const state = getState()
    const statusByDataset = state.referenceData.statusByDataset
    const tasks = []

    // User statuses gate route redirects — fetch first.
    if (!isLoadedOrLoading(statusByDataset.userStatuses)) tasks.push(dispatch(fetchUserStatuses()))
    if (!isLoadedOrLoading(statusByDataset.userRoles)) tasks.push(dispatch(fetchUserRoles()))
    if (!isLoadedOrLoading(statusByDataset.cardStatuses)) tasks.push(dispatch(fetchCardStatuses()))
    if (!isLoadedOrLoading(statusByDataset.cardTypes)) tasks.push(dispatch(fetchCardTypes()))
    if (!isLoadedOrLoading(statusByDataset.transactionCategories))
      tasks.push(dispatch(fetchTransactionCategories()))

    await Promise.all(tasks)
  },
)

const referenceDataSlice = createSlice({
  name: 'referenceData',
  initialState: {
    userRoles: [],
    userStatuses: [],
    cardStatuses: [],
    cardTypes: [],
    transactionCategories: [],
    statusByDataset: { ...DEFAULT_STATUS },
    errorByDataset: { ...DEFAULT_ERRORS },
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserRoles.pending, (state) => {
        state.statusByDataset.userRoles = 'loading'
        state.errorByDataset.userRoles = null
      })
      .addCase(fetchUserRoles.fulfilled, (state, action) => {
        state.userRoles = action.payload
        state.statusByDataset.userRoles = 'succeeded'
      })
      .addCase(fetchUserRoles.rejected, (state, action) => {
        state.statusByDataset.userRoles = 'failed'
        state.errorByDataset.userRoles = action.payload ?? 'Failed to load user roles.'
      })
      .addCase(fetchUserStatuses.pending, (state) => {
        state.statusByDataset.userStatuses = 'loading'
        state.errorByDataset.userStatuses = null
      })
      .addCase(fetchUserStatuses.fulfilled, (state, action) => {
        state.userStatuses = action.payload
        state.statusByDataset.userStatuses = 'succeeded'
      })
      .addCase(fetchUserStatuses.rejected, (state, action) => {
        state.statusByDataset.userStatuses = 'failed'
        state.errorByDataset.userStatuses = action.payload ?? 'Failed to load user statuses.'
      })
      .addCase(fetchCardStatuses.pending, (state) => {
        state.statusByDataset.cardStatuses = 'loading'
        state.errorByDataset.cardStatuses = null
      })
      .addCase(fetchCardStatuses.fulfilled, (state, action) => {
        state.cardStatuses = action.payload
        state.statusByDataset.cardStatuses = 'succeeded'
      })
      .addCase(fetchCardStatuses.rejected, (state, action) => {
        state.statusByDataset.cardStatuses = 'failed'
        state.errorByDataset.cardStatuses = action.payload ?? 'Failed to load card statuses.'
      })
      .addCase(fetchCardTypes.pending, (state) => {
        state.statusByDataset.cardTypes = 'loading'
        state.errorByDataset.cardTypes = null
      })
      .addCase(fetchCardTypes.fulfilled, (state, action) => {
        state.cardTypes = action.payload
        state.statusByDataset.cardTypes = 'succeeded'
      })
      .addCase(fetchCardTypes.rejected, (state, action) => {
        state.statusByDataset.cardTypes = 'failed'
        state.errorByDataset.cardTypes = action.payload ?? 'Failed to load card types.'
      })
      .addCase(fetchTransactionCategories.pending, (state) => {
        state.statusByDataset.transactionCategories = 'loading'
        state.errorByDataset.transactionCategories = null
      })
      .addCase(fetchTransactionCategories.fulfilled, (state, action) => {
        state.transactionCategories = action.payload
        state.statusByDataset.transactionCategories = 'succeeded'
      })
      .addCase(fetchTransactionCategories.rejected, (state, action) => {
        state.statusByDataset.transactionCategories = 'failed'
        state.errorByDataset.transactionCategories =
          action.payload ?? 'Failed to load transaction categories.'
      })
  },
})

export const selectReferenceDataState = (state) => state.referenceData
export const selectUserRoles = (state) => state.referenceData.userRoles
export const selectUserStatuses = (state) => state.referenceData.userStatuses
export const selectCardStatuses = (state) => state.referenceData.cardStatuses
export const selectCardTypes = (state) => state.referenceData.cardTypes
export const selectTransactionCategories = (state) =>
  state.referenceData.transactionCategories
export const selectReferenceDatasetStatus = (state) => state.referenceData.statusByDataset
export const selectReferenceDatasetErrors = (state) => state.referenceData.errorByDataset

export default referenceDataSlice.reducer
