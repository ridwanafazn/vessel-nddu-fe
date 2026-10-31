import axios from "axios";

/**
 * Base URL backend (Rust/Actix-web) — default dari env build-time.
 * Bisa di-override runtime via SettingsContext (localStorage).
 */
export const DEFAULT_API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://vessel-nddu.onrender.com"
).replace(/\/+$/, "");

/**
 * WebSocket backend default — path /ws diproxy nginx container ke port internal 8081.
 */
export const DEFAULT_WS_URL =
  import.meta.env.VITE_WS_URL || "wss://vessel-nddu.onrender.com/ws";

/**
 * Error terstruktur supaya UI bisa membedakan:
 * offline / timeout (cold start) / 404 (belum dibuat) / 409 (config/instance) / 401.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, kind = "unknown", data = null, retryable = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.data = data;
    this.retryable = retryable;
  }
}

const RETRY_DELAYS_MS = [4000, 10000];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function classify(error) {
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    return { kind: "timeout", retryable: true, message: "Server lambat merespons (cold start Render). Mencoba lagi…" };
  }
  if (!error?.response) {
    return { kind: "offline", retryable: true, message: "Tidak dapat terhubung ke server. Periksa koneksi internet." };
  }
  const { status, data } = error.response;
  const message = data?.message || data?.error || `Permintaan gagal (HTTP ${status})`;
  if (status === 401) return { kind: "auth", retryable: false, message };
  if (status === 404) return { kind: "not_found", retryable: false, message };
  if (status === 409) return { kind: "conflict", retryable: false, message };
  if (status === 400) return { kind: "bad_request", retryable: false, message };
  if (status >= 500) return { kind: "server", retryable: true, message };
  return { kind: "http", retryable: false, message };
}

/**
 * Membuat instance axios dengan baseURL dinamis.
 * Dipanggil saat butuh request dengan URL terbaru.
 */
export function createHttpClient(baseURL) {
  const instance = axios.create({
    baseURL: (baseURL || DEFAULT_API_BASE_URL).replace(/\/+$/, ""),
    timeout: 90000,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error.config || {};
      const info = classify(error);
      const method = String(config.method || "get").toLowerCase();
      if (method === "get" && info.retryable) {
        const attempt = config.__retryCount || 0;
        if (attempt < RETRY_DELAYS_MS.length) {
          config.__retryCount = attempt + 1;
          await sleep(RETRY_DELAYS_MS[attempt]);
          return instance(config);
        }
      }
      return Promise.reject(
        new ApiError(info.message, {
          status: error?.response?.status || 0,
          kind: info.kind,
          data: error?.response?.data ?? null,
          retryable: info.retryable,
        })
      );
    }
  );

  return instance;
}

/**
 * Default client pakai env build-time.
 * Untuk pakai custom URL, panggil createHttpClient(customUrl).
 */
export const http = createHttpClient(DEFAULT_API_BASE_URL);

// Re-export untuk backward compatibility
export { DEFAULT_API_BASE_URL as API_BASE_URL, DEFAULT_WS_URL as WS_URL };
