import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("op_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiError(e) {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || "Errore imprevisto";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((x) => (x && typeof x.msg === "string" ? x.msg : JSON.stringify(x))).join(" ");
  if (typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
