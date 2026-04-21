import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const BASE = `${API_BASE_URL}/api/delegations`;

const authHeader = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchMyTasks = createAsyncThunk(
  'tasks/fetchMyTasks',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const res = await axios.get(`${BASE}/my-tasks`, authHeader(token));
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch my tasks');
    }
  }
);

export const fetchDelegatedTasks = createAsyncThunk(
  'tasks/fetchDelegatedTasks',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const res = await axios.get(`${BASE}/delegated-tasks`, authHeader(token));
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch delegated tasks');
    }
  }
);

export const fetchSubscribedTasks = createAsyncThunk(
  'tasks/fetchSubscribedTasks',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const res = await axios.get(`${BASE}/subscribed-tasks`, authHeader(token));
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch subscribed tasks');
    }
  }
);

export const fetchAllTasks = createAsyncThunk(
  'tasks/fetchAllTasks',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const res = await axios.get(`${BASE}/all-tasks`, authHeader(token));
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch all tasks');
    }
  }
);

export const fetchDeletedTasks = createAsyncThunk(
  'tasks/fetchDeletedTasks',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const res = await axios.get(`${BASE}/deleted-tasks`, authHeader(token));
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch deleted tasks');
    }
  }
);

export const softDeleteTask = createAsyncThunk(
  'tasks/softDelete',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const res = await axios.patch(`${BASE}/${id}/trash`, {}, authHeader(token));
      return { id, delegation: res.data.delegation };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete task');
    }
  }
);

export const restoreTask = createAsyncThunk(
  'tasks/restore',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const res = await axios.patch(`${BASE}/${id}/restore`, {}, authHeader(token));
      return { id, delegation: res.data.delegation };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to restore task');
    }
  }
);

export const subscribeToTask = createAsyncThunk(
  'tasks/subscribe',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const res = await axios.patch(`${BASE}/${id}/subscribe`, {}, authHeader(token));
      return res.data.delegation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to subscribe');
    }
  }
);

export const createDelegation = createAsyncThunk(
  'tasks/createDelegation',
  async (formData, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const res = await axios.post(BASE, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create delegation');
    }
  }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const pending = (key) => (state) => {
  state[key].isLoading = true;
  state[key].error = null;
};
const rejected = (key) => (state, action) => {
  state[key].isLoading = false;
  state[key].error = action.payload;
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const taskSlice = createSlice({
  name: 'tasks',
  initialState: {
    myTasks:         { data: [], isLoading: false, error: null },
    delegatedTasks:  { data: [], isLoading: false, error: null },
    subscribedTasks: { data: [], isLoading: false, error: null },
    allTasks:        { data: [], isLoading: false, error: null },
    deletedTasks:    { data: [], isLoading: false, error: null },
  },
  reducers: {},
  extraReducers: (builder) => {
    // fetchMyTasks
    builder
      .addCase(fetchMyTasks.pending,   pending('myTasks'))
      .addCase(fetchMyTasks.fulfilled, (state, { payload }) => {
        state.myTasks.isLoading = false;
        state.myTasks.data = payload;
      })
      .addCase(fetchMyTasks.rejected,  rejected('myTasks'));

    // fetchDelegatedTasks
    builder
      .addCase(fetchDelegatedTasks.pending,   pending('delegatedTasks'))
      .addCase(fetchDelegatedTasks.fulfilled, (state, { payload }) => {
        state.delegatedTasks.isLoading = false;
        state.delegatedTasks.data = payload;
      })
      .addCase(fetchDelegatedTasks.rejected,  rejected('delegatedTasks'));

    // fetchSubscribedTasks
    builder
      .addCase(fetchSubscribedTasks.pending,   pending('subscribedTasks'))
      .addCase(fetchSubscribedTasks.fulfilled, (state, { payload }) => {
        state.subscribedTasks.isLoading = false;
        state.subscribedTasks.data = payload;
      })
      .addCase(fetchSubscribedTasks.rejected,  rejected('subscribedTasks'));

    // fetchAllTasks
    builder
      .addCase(fetchAllTasks.pending,   pending('allTasks'))
      .addCase(fetchAllTasks.fulfilled, (state, { payload }) => {
        state.allTasks.isLoading = false;
        state.allTasks.data = payload;
      })
      .addCase(fetchAllTasks.rejected,  rejected('allTasks'));

    // fetchDeletedTasks
    builder
      .addCase(fetchDeletedTasks.pending,   pending('deletedTasks'))
      .addCase(fetchDeletedTasks.fulfilled, (state, { payload }) => {
        state.deletedTasks.isLoading = false;
        state.deletedTasks.data = payload;
      })
      .addCase(fetchDeletedTasks.rejected,  rejected('deletedTasks'));

    // softDeleteTask → remove from all non-deleted slices, add to deletedTasks
    builder
      .addCase(softDeleteTask.fulfilled, (state, { payload: { id } }) => {
        ['myTasks', 'delegatedTasks', 'subscribedTasks', 'allTasks'].forEach((key) => {
          state[key].data = state[key].data.filter((d) => d.id !== id);
        });
      });

    // restoreTask → remove from deletedTasks
    builder
      .addCase(restoreTask.fulfilled, (state, { payload: { id } }) => {
        state.deletedTasks.data = state.deletedTasks.data.filter((d) => d.id !== id);
      });

    // subscribeToTask → update item in allTasks if present
    builder
      .addCase(subscribeToTask.fulfilled, (state, { payload }) => {
        const idx = state.allTasks.data.findIndex((d) => d.id === payload?.id);
        if (idx !== -1) state.allTasks.data[idx] = payload;
        // Add to subscribedTasks if not already present
        if (payload && !state.subscribedTasks.data.find((d) => d.id === payload.id)) {
          state.subscribedTasks.data.unshift(payload);
        }
      });

    // createDelegation → add to delegatedTasks and allTasks
    builder
      .addCase(createDelegation.fulfilled, (state, { payload }) => {
        state.delegatedTasks.data.unshift(payload);
        state.allTasks.data.unshift(payload);
      });
  },
});

export default taskSlice.reducer;
