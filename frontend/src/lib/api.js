import axios from "axios";

export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
export const API = `${BACKEND_URL}/api`;

export const imgSrc = (url) => (url?.startsWith("/api/") ? `${BACKEND_URL}${url}` : url);

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
