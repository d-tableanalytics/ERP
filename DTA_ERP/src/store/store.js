import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import delegationReducer from './slices/delegationSlice';
import checklistReducer from './slices/checklistSlice';
import masterReducer from './slices/masterSlice';
import todoReducer from './slices/todoSlice';
import helpTicketConfigReducer from './slices/helpTicketConfigSlice';
import imsReducer from './slices/imsSlice'; 
import o2dReducer from './slices/o2dSlice';
export const store = configureStore({
    reducer: {
        auth: authReducer,
        delegation: delegationReducer,
        checklist: checklistReducer,
        master: masterReducer,
        todo: todoReducer,
        helpTicketConfig:helpTicketConfigReducer,
        ims:imsReducer,
        o2d:o2dReducer,
    },
});
