// src/services/axiosInstance.ts
import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_ENDPOINT,
});

// Inject logout function from AuthContext at runtime
let logoutFn: (() => void) | null = null;

export const setAxiosLogout = (fn: () => void) => {
  logoutFn = fn;
};

// Response interceptor — kapag 401, automatic logout
//
// Hindi kasama ang /auth/* endpoints (login, forgot/reset/change password)
// dito — 401 doon ay nangangahulugang MALI ang credentials/OTP, hindi
// dahil expired ang session, kaya hindi dapat mag-trigger ng logout/
// "session expired" flow. Ang caller (Login.tsx) mismo ang bahalang
// magpakita ng tamang error message.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? "";
    if (error.response?.status === 401 && logoutFn && !url.includes("/auth/")) {
      sessionStorage.setItem("sessionExpired", "1");
      logoutFn();
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;