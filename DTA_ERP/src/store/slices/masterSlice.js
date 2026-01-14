import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/master';

export const fetchEmployees = createAsyncThunk(
    'master/fetchEmployees',
    async (_, { getState, rejectWithValue }) => {
        const { token } = getState().auth;
        try {
            const response = await axios.get(`${API_URL}/employees`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch employees');
        }
    }
);

export const fetchDepartments = createAsyncThunk(
    'master/fetchDepartments',
    async (_, { getState, rejectWithValue }) => {
        const { token } = getState().auth;
        try {
            const response = await axios.get(`${API_URL}/departments`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch departments');
        }
    }
);

const masterSlice = createSlice({
    name: 'master',
    initialState: {
        employees: [],
        departments: [],
        isLoading: false,
        error: null,
        lastFetchedDetails: {
            employees: 0,
            departments: 0
        }
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Employees
            .addCase(fetchEmployees.pending, (state) => {
                // Only set loading if we don't have data, to prevent flicker
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
            });
    },
});

export default masterSlice.reducer;
