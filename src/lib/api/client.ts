import axios from "axios";
import type { AxiosError, AxiosInstance } from "axios";

export const API_BASE_URL = "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const status = error.response?.status ?? 0;
    const message =
      error.response?.data?.error || error.message || "Request failed";
    return Promise.reject(new ApiError(message, status));
  },
);
