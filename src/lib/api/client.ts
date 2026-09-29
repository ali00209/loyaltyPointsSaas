import axios from "axios";
import type { AxiosError, AxiosInstance } from "axios";

export const API_BASE_URL = "/api";

export type ApiErrorDetail = { field: string; message: string };

export class ApiError extends Error {
  status: number;
  /** Per-field messages from a `parseBody` 400. Absent for non-validation errors. */
  details?: ApiErrorDetail[];

  constructor(message: string, status: number, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; details?: ApiErrorDetail[] }>) => {
    const status = error.response?.status ?? 0;
    const message =
      error.response?.data?.error || error.message || "Request failed";
    return Promise.reject(
      new ApiError(message, status, error.response?.data?.details),
    );
  },
);
