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
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && logoutFn) {
      logoutFn();
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;