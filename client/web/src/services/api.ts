import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("coop_jwt_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const pathname = window.location.pathname;
      if (
        !pathname.includes("/login") &&
        !pathname.includes("/forgot-password") &&
        !pathname.includes("/reset-password")
      ) {
        localStorage.removeItem("coop_jwt_token");
        localStorage.removeItem("coop_user_profile");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
