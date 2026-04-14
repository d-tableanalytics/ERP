import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import masterReducer from "./slices/masterSlice";
import todoReducer from "./slices/todoSlice";
import helpTicketConfigReducer from "./slices/helpTicketConfigSlice";
import imsReducer from "./slices/imsSlice";
import o2dReducer from "./slices/o2dSlice";
import scoreReducer from "./slices/scoreSlice";
import dashboardReducer from "./slices/dashboardSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    master: masterReducer,
    todo: todoReducer,
    helpTicketConfig: helpTicketConfigReducer,
    ims: imsReducer,
    o2d: o2dReducer,
    score: scoreReducer,
    dashboard: dashboardReducer,
  },
});
