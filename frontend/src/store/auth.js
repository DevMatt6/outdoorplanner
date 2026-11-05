import { create } from "zustand";
import { api } from "../lib/api";

// Remove the old browser-wide session; each tab now owns its credentials.
localStorage.removeItem("op_token");
localStorage.removeItem("op_user");
function initialUser() {
  if (!sessionStorage.getItem("op_token")) return null;
  try { return JSON.parse(sessionStorage.getItem("op_user") || "null"); }
  catch { sessionStorage.removeItem("op_token"); sessionStorage.removeItem("op_user"); return null; }
}
export const useAuth = create((set) => ({
  user: initialUser(),
  setSession: (user, token) => {
    sessionStorage.setItem("op_token", token);
    sessionStorage.setItem("op_user", JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    sessionStorage.removeItem("op_token");
    sessionStorage.removeItem("op_user");
    set({ user: null });
  },
  refresh: async () => {
    const token = sessionStorage.getItem("op_token");
    if (!token) return;
    try {
      const { data } = await api.get("/auth/me");
      if (sessionStorage.getItem("op_token") !== token) return;
      sessionStorage.setItem("op_user", JSON.stringify(data));
      set({ user: data });
    } catch {
      if (sessionStorage.getItem("op_token") !== token) return;
      sessionStorage.removeItem("op_token");
      sessionStorage.removeItem("op_user");
      set({ user: null });
    }
  },
}));

export function homeFor(user) {
  if (!user) return "/login";
  if (user.ruolo === "superadmin") return "/admin";
  if (user.ruolo === "comune") return "/comune";
  return "/home";
}
