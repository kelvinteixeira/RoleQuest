import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AuthState, User } from "./authTypes";

const initialState: AuthState = {
  user: null,
};

const authSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setLogin: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
    setLogout: (state) => {
      state.user = null;
    },
  },
});

export const { setLogin, setLogout } = authSlice.actions;
export default authSlice.reducer;
