import axios from "axios";

const TOKEN_KEY = "pwanigrid_token";
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t) => sessionStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

// The AuthContext registers a function here that logs the admin out
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 15000,
});

// Attach the admin token to every request (never logged anywhere)
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or invalid session (401) sends the admin back to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = String(error.config?.url || "").includes("/api/auth/login");
    if (error.response?.status === 401 && !isLogin && onUnauthorized) onUnauthorized();
    return Promise.reject(error);
  }
);

// Turns any Axios error into a readable sentence
export function errorMessage(error) {
  if (error.response) {
    const data = error.response.data;
    if (data && typeof data.error === "string") return data.error;
    return `Request failed (${error.response.status}).`;
  }
  if (error.code === "ECONNABORTED") return "The server took too long to respond.";
  return "Cannot reach the server. Is the backend running?";
}

export default api;
