import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import delegationReducer from './slices/delegationSlice';
import checklistReducer from './slices/checklistSlice';
import masterReducer from './slices/masterSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        delegation: delegationReducer,
        checklist: checklistReducer,
        master: masterReducer,
    },
});
