import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import delegationReducer from './slices/delegationSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        delegation: delegationReducer,
    },
});
