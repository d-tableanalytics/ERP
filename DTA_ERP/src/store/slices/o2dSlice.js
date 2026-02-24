import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../../config";

/* =========================================
   HELPER
========================================= */
const getAuthHeaders = (getState) => {
  const token = getState().auth.token;
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

/* =========================================
   ASYNC THUNKS
========================================= */

/* ================= CREATE ORDER ================= */
export const createO2DOrder = createAsyncThunk(
  "o2d/createO2DOrder",
  async (payload, { getState, rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/o2d`,
        payload,
        getAuthHeaders(getState)
      );
      return res.data?.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to create O2D order"
      );
    }
  }
);

/* ================= FETCH ORDERS ================= */
export const fetchO2DOrders = createAsyncThunk(
  "o2d/fetchO2DOrders",
  async (_, { getState, rejectWithValue }) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/o2d`,
        getAuthHeaders(getState)
      );
      return res.data?.data || [];
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch O2D orders"
      );
    }
  }
);

/* ================= ASSIGN STEP ================= */
export const assignO2DStep = createAsyncThunk(
  "o2d/assignO2DStep",
  async (
    { orderId, stepId, assigned_to },
    { getState, rejectWithValue }
  ) => {
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/o2d/orders/${orderId}/steps/${stepId}/assign`,
        { assigned_to },
        getAuthHeaders(getState)
      );

      return { orderId, stepId, data: res.data?.data };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to assign step"
      );
    }
  }
);

/* ================= COMPLETE STEP ================= */
export const completeO2DStep = createAsyncThunk(
  "o2d/completeO2DStep",
  async (
    { orderId, stepId, remarks },
    { getState, rejectWithValue }
  ) => {
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/o2d/orders/${orderId}/steps/${stepId}/complete`,
        { remarks },
        getAuthHeaders(getState)
      );

      return { orderId, stepId, data: res.data?.data };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to complete step"
      );
    }
  }
);

/* =========================================
   SLICE
========================================= */

const o2dSlice = createSlice({
  name: "o2d",
  initialState: {
    orders: [],
    isLoading: false,
    error: null,
  },
  reducers: {
    clearO2DError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder

      /* ================= FETCH ================= */
      .addCase(fetchO2DOrders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchO2DOrders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders = action.payload;
      })
      .addCase(fetchO2DOrders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      /* ================= CREATE ================= */
      .addCase(createO2DOrder.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createO2DOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders.unshift(action.payload);
      })
      .addCase(createO2DOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      /* ================= ASSIGN STEP ================= */
      .addCase(assignO2DStep.fulfilled, (state, action) => {
        const { orderId, stepId, data } = action.payload;

        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return;

        const step = order.steps.find((s) => s.id === stepId);
        if (!step) return;

        Object.assign(step, data);
      })

      /* ================= COMPLETE STEP ================= */
      .addCase(completeO2DStep.fulfilled, (state, action) => {
        const { orderId, stepId, data } = action.payload;

        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return;

        const step = order.steps.find((s) => s.id === stepId);
        if (!step) return;

        Object.assign(step, data);
      });
  },
});

export const { clearO2DError } = o2dSlice.actions;
export default o2dSlice.reducer;