import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../../config";

const API_URL = `${API_BASE_URL}/api/ims`;

/* ===================================== */
/* ✅ FETCH ALL TRANSACTIONS */
/* GET: /transactions */
/* ===================================== */
export const fetchTransactions = createAsyncThunk(
  "ims/fetchTransactions",
  async (_, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;

    try {
      const res = await axios.get(`${API_URL}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return {
        transactions: res.data,
        userRole: user?.role,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch transactions"
      );
    }
  }
);

/* ===================================== */
/* ✅ CREATE TRANSACTION */
/* POST: /transaction */
/* ===================================== */
export const createTransaction = createAsyncThunk(
  "ims/createTransaction",
  async (transactionData, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.post(
        `${API_URL}/transaction`,
        transactionData,   // This is FormData now
        {
          headers: {
            Authorization: `Bearer ${token}`,
            // ❌ DO NOT set Content-Type manually
          },
        }
      );

      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to create transaction"
      );
    }
  }
);

/* ===================================== */
/* ✅ EDIT TRANSACTION */
/* PUT: /transaction/:id */
/* ===================================== */
export const editTransaction = createAsyncThunk(
  "ims/editTransaction",
  async ({ id, updatedData }, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.put(
        `${API_URL}/transaction/${id}`,
        updatedData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to edit transaction"
      );
    }
  }
);

/* ===================================== */
/* ✅ DELETE TRANSACTION */
/* DELETE: /transaction/:id */
/* ===================================== */
export const deleteTransaction = createAsyncThunk(
  "ims/deleteTransaction",
  async (id, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      await axios.delete(`${API_URL}/transaction/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete transaction"
      );
    }
  }
);

/* ===================================== */
/* ✅ FETCH MASTERS */
/* GET: /masters */
/* ===================================== */
export const fetchMasters = createAsyncThunk(
  "ims/fetchMasters",
  async (_, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    try {
      const res = await axios.get(`${API_URL}/masters`,
        {
        headers: { Authorization: `Bearer ${token}` },
      }
      );
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch masters"
      );
    }
  }
);

/* ===================================== */
/* ✅ SLICE */
/* ===================================== */
const imsSlice = createSlice({
  name: "ims",
  initialState: {
    transactions: [],
    masters: null,
    userRole: null,
    isLoading: false,
    isSubmitting: false,
    error: null,
  },
  reducers: {},

  extraReducers: (builder) => {
    builder

      /* ===================== */
      /* FETCH TRANSACTIONS */
      /* ===================== */
      .addCase(fetchTransactions.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.transactions = action.payload.transactions;
        state.userRole = action.payload.userRole;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      /* ===================== */
      /* CREATE */
      /* ===================== */
      .addCase(createTransaction.pending, (state) => {
        state.isSubmitting = true;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.transactions.unshift(action.payload);
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })

      /* ===================== */
      /* EDIT */
      /* ===================== */
      .addCase(editTransaction.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.transactions.findIndex(
          (t) => t.id === updated.id
        );

        if (index !== -1) {
          state.transactions[index] = updated;
        }
      })

      /* ===================== */
      /* DELETE */
      /* ===================== */
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.transactions = state.transactions.filter(
          (t) => t.id !== action.payload
        );
      })

      /* ===================== */
      /* FETCH MASTERS */
      /* ===================== */
      .addCase(fetchMasters.fulfilled, (state, action) => {
        state.masters = action.payload;
      });
  },
});

export default imsSlice.reducer;