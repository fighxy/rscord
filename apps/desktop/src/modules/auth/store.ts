import { create } from "zustand";

type AuthState = {
  token: string | null;
  setToken: (t: string | null) => void;
};

export const useAuth = create<AuthState>((set) => ({
  token: null,
  setToken: (t) => set({ token: t }),
}));


