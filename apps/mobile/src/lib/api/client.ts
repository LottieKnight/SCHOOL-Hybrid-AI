import axios from "axios";
import { clearAuthToken, getAuthToken } from "../auth/tokenStore";

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://school-api-production-2ff7.up.railway.app";

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await clearAuthToken();
    }
    return Promise.reject(error);
  }
);
