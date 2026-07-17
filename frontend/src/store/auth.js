import { create } from "zustand";
import { api } from "../lib/api";

export const useAuth = create((set) => ({
  user: JSON.parse(localStorage.getItem("op_user") || "null"),
  setSession: (user, token) => {
    localStorage.setItem("op_token", token);
    localStorage.setItem("op_user", JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    localStorage.removeItem("op_token");
    localStorage.removeItem("op_user");
    set({ user: null });
  },
  refresh: async () => {
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("op_user", JSON.stringify(data));
      set({ user: data });
    } catch {
      localStorage.removeItem("op_token");
      localStorage.removeItem("op_user");
      set({ user: null });
    }
  },
}));

export function homeFor(user) {
  if (!user) return "/login";
  if (user.ruolo === "superadmin") return "/admin";
  if (user.ruolo === "comune") return "/comune";
  return "/dashboard";
}
