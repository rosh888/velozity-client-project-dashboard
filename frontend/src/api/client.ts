import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

// kept in memory only, never localStorage. a page refresh loses it, which
// is fine since we just re-mint one from the httpOnly refresh cookie
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

type RefreshHandler = () => Promise<string | null>;
let onUnauthorized: RefreshHandler | null = null;
let onRefreshFailed: (() => void) | null = null;

export function registerAuthHandlers(refresh: RefreshHandler, onFail: () => void) {
  onUnauthorized = refresh;
  onRefreshFailed = onFail;
}

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isRefreshCall = original?.url?.includes("/auth/refresh");
    if (error.response?.status === 401 && !isRefreshCall && !original._retry && onUnauthorized) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = onUnauthorized().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        // fall through to failure handling below
      }
      onRefreshFailed?.();
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message ?? err.message;
  }
  return "Something went wrong";
}
