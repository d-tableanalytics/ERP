import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../../config";

// Use relative path to let Vite proxy handle the base URL
const API_URL = `${API_BASE_URL}/api/master`;

const sortByName = (items) =>
  [...items].sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));

export const fetchEmployees = createAsyncThunk(
  "master/fetchEmployees",
  async (_, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    try {
      const response = await axios.get(`${API_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch employees",
      );
    }
  },
);

export const fetchDepartments = createAsyncThunk(
  "master/fetchDepartments",
  async (_, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    try {
      const response = await axios.get(`${API_URL}/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch departments",
      );
    }
  },
);

export const createDepartment = createAsyncThunk(
  "master/createDepartment",
  async (payload, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    try {
      const response = await axios.post(`${API_URL}/departments`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create department",
      );
    }
  },
);

export const updateDepartment = createAsyncThunk(
  "master/updateDepartment",
  async ({ id, ...payload }, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    try {
      const response = await axios.put(`${API_URL}/departments/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update department",
      );
    }
  },
);
export const deleteDepartment = createAsyncThunk(
  "master/deleteDepartment",
  async (id, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    try {
      await axios.delete(`${API_URL}/departments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete department",
      );
    }
  },
);

export const deleteEmployee = createAsyncThunk(
  "master/deleteEmployee",
  async (id, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    try {
      await axios.delete(`${API_URL}/employees/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete employee",
      );
    }
  },
);

// New Thunks for Help Ticket
export const fetchLocations = createAsyncThunk(
  "master/fetchLocations",
  async (_, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    try {
      const response = await axios.get(`${API_URL}/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch locations",
      );
    }
  },
);

export const fetchPCAccountables = createAsyncThunk(
  "master/fetchPCAccountables",
  async (_, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    try {
      const response = await axios.get(`${API_URL}/pc-accountables`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch PC accountables",
      );
    }
  },
);

export const fetchProblemSolvers = createAsyncThunk(
  "master/fetchProblemSolvers",
  async (_, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    try {
      const response = await axios.get(`${API_URL}/problem-solvers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch problem solvers",
      );
    }
  },
);


export const getHelpTicketHistoryById = createAsyncThunk(
  "master/getHelpTicketHistoryById",
  async (id, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;

      const response = await axios.get(
        `${API_BASE_URL}/api/help-tickets/history/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch help ticket history"
      );
    }
  }
);


const masterSlice = createSlice({
  name: "master",
  initialState: {
    employees: [],
    departments: [],
    helpTicketHistory: null,
    locations: [],
    pcAccountables: [],
    problemSolvers: [],
    isLoading: false,
    isSavingDepartment: false,
    error: null,
    lastFetchedDetails: {
      employees: 0,
      departments: 0,
      locations: 0,
      pcAccountables: 0,
      problemSolvers: 0,
    },
  },
  reducers: {},
  extraReducers: (builder) => {
  builder
    // Employees
    .addCase(fetchEmployees.pending, (state) => {
      if (state.employees.length === 0) state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchEmployees.fulfilled, (state, action) => {
      state.isLoading = false;
      state.employees = action.payload;
      state.lastFetchedDetails.employees = Date.now();
    })
    .addCase(fetchEmployees.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    })
    .addCase(deleteEmployee.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(deleteEmployee.fulfilled, (state, action) => {
      state.isLoading = false;
      state.employees = (state.employees || []).filter((emp) => emp.id !== action.payload);
    })
    .addCase(deleteEmployee.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    })

    // Departments
    .addCase(fetchDepartments.pending, (state) => {
      if (state.departments.length === 0) state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchDepartments.fulfilled, (state, action) => {
      state.isLoading = false;
      state.departments = action.payload;
      state.lastFetchedDetails.departments = Date.now();
    })
    .addCase(fetchDepartments.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    })
    .addCase(createDepartment.pending, (state) => {
      state.isSavingDepartment = true;
      state.error = null;
    })
    .addCase(createDepartment.fulfilled, (state, action) => {
      state.isSavingDepartment = false;
      state.departments = sortByName([...state.departments, action.payload]);
    })
    .addCase(createDepartment.rejected, (state, action) => {
      state.isSavingDepartment = false;
      state.error = action.payload;
    })
    .addCase(updateDepartment.pending, (state) => {
      state.isSavingDepartment = true;
      state.error = null;
    })
    .addCase(updateDepartment.fulfilled, (state, action) => {
      state.isSavingDepartment = false;
      state.departments = sortByName(
        state.departments.map((department) =>
          department.id === action.payload.id ? action.payload : department,
        ),
      );
    })
    .addCase(updateDepartment.rejected, (state, action) => {
      state.isSavingDepartment = false;
      state.error = action.payload;
    })
    .addCase(deleteDepartment.pending, (state) => {
      state.isSavingDepartment = true;
      state.error = null;
    })
    .addCase(deleteDepartment.fulfilled, (state, action) => {
      state.isSavingDepartment = false;
      state.departments = state.departments.filter(
        (department) => department.id !== action.payload,
      );
    })
    .addCase(deleteDepartment.rejected, (state, action) => {
      state.isSavingDepartment = false;
      state.error = action.payload;
    })

    // Locations
    .addCase(fetchLocations.pending, (state) => {
      if (state.locations.length === 0) state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchLocations.fulfilled, (state, action) => {
      state.isLoading = false;
      state.locations = action.payload;
      state.lastFetchedDetails.locations = Date.now();
    })
    .addCase(fetchLocations.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    })

    // PC Accountables
    .addCase(fetchPCAccountables.pending, (state) => {
      if (state.pcAccountables.length === 0) state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchPCAccountables.fulfilled, (state, action) => {
      state.isLoading = false;
      state.pcAccountables = action.payload;
      state.lastFetchedDetails.pcAccountables = Date.now();
    })
    .addCase(fetchPCAccountables.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    })

    // Problem Solvers
    .addCase(fetchProblemSolvers.pending, (state) => {
      if (state.problemSolvers.length === 0) state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchProblemSolvers.fulfilled, (state, action) => {
      state.isLoading = false;
      state.problemSolvers = action.payload;
      state.lastFetchedDetails.problemSolvers = Date.now();
    })
    .addCase(fetchProblemSolvers.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    })

    // ✅ Help Ticket History
    .addCase(getHelpTicketHistoryById.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(getHelpTicketHistoryById.fulfilled, (state, action) => {
      state.isLoading = false;
      state.helpTicketHistory = action.payload;
    })
    .addCase(getHelpTicketHistoryById.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });
},

});

export default masterSlice.reducer;
