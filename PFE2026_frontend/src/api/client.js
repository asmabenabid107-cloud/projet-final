import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;
const baseURL = API_URL || "/api";

export const api = axios.create({
  baseURL,
  timeout: 120000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const url = config.url || "";

  const adminToken = localStorage.getItem("admin_access_token");
  const shipperToken = localStorage.getItem("shipper_access_token");

  const isPublicAuth =
    url === "/auth/login" ||
    url === "/auth/shipper/login" ||
    url === "/auth/shipper/register" ||
    url === "/auth/courier/login" ||
    url === "/auth/courier/register" ||
    url === "/auth/forgot-password" ||
    url === "/auth/verify-otp" ||
    url === "/auth/reset-password";

  const isAdmin = url.startsWith("/admin/");
  const token = isPublicAuth ? null : (isAdmin ? adminToken : shipperToken);

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});