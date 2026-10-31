import axios from "axios";

/**
 * Base URL backend (Rust/Actix-web).
 * - Dev  : http://localhost:8080  (lihat .env.local)
 * - Live : https://vessel-nddu.onrender.com (lihat .env / dashboard Cloudflare)
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://vessel-nddu.onrender.com"
).replace(/\/+$/, "");

/**
 * WebSocket backend. Path /ws diproxy nginx container ke port internal 8081.
 */
export const WS_URL =
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
    return {
      kind: "timeout",
      retryable: true,
      message: "Server lambat merespons (cold start Render). Mencoba lagi…",
    };
  }

  if (!error?.response) {
    return {
      kind: "offline",
      retryable: true,
      message: "Tidak dapat terhubung ke server. Periksa koneksi internet.",
    };
  }

  const { status, data } = error.response;
  const message =
    data?.message || data?.error || `Permintaan gagal (HTTP ${status})`;

  if (status === 401) return { kind: "auth", retryable: false, message };
  if (status === 404) return { kind: "not_found", retryable: false, message };
  if (status === 409) return { kind: "conflict", retryable: false, message };
  if (status === 400) return { kind: "bad_request", retryable: false, message };
  if (status >= 500) return { kind: "server", retryable: true, message };

  return { kind: "http", retryable: false, message };
}

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000, // cold start Render ±60 detik + margin
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const info = classify(error);
    const method = String(config.method || "get").toLowerCase();

    // Retry hanya untuk request idempotent (GET) yang gagal karena jaringan/5xx.
    if (method === "get" && info.retryable) {
      const attempt = config.__retryCount || 0;
      if (attempt < RETRY_DELAYS_MS.length) {
        config.__retryCount = attempt + 1;
        await sleep(RETRY_DELAYS_MS[attempt]);
        return http(config);
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

export default http;
