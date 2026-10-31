import { http } from "./client";

/**
 * Semua response backend (kecuali auth) berbentuk { message, data }.
 * Helper unwrap() mengembalikan `data` saja.
 */
const unwrap = (response) => response?.data?.data;
const messageOnly = (response) => response?.data ?? {};

const get = (url, config) => http.get(url, config).then(unwrap);
const post = (url, body) => http.post(url, body).then(unwrap);
const patch = (url, body) => http.patch(url, body).then(unwrap);
const remove = (url) => http.delete(url).then(messageOnly);

/* ============================================================================
 * AUTH & HEALTH
 * ========================================================================== */
export const authApi = {
  login: (username, password) =>
    http.post("/api/auth/login", { username, password }).then((r) => r.data),
};

export const healthApi = {
  get: () => http.get("/health", { timeout: 95000 }).then((r) => r.data),
};

/* ============================================================================
 * GPS
 * PENTING: GET /api/gps default = NMEA text/plain.
 * Selalu gunakan ?format=json untuk data JSON.
 * ========================================================================== */
export const gpsApi = {
  get: () => get("/api/gps", { params: { format: "json" } }),
  getNmea: () =>
    http
      .get("/api/gps", {
        responseType: "text",
        transformResponse: [(data) => data],
        headers: { Accept: "text/plain" },
      })
      .then((r) => r.data),
  create: (payload) => post("/api/gps", payload),
  update: (payload) => patch("/api/gps", payload),
  remove: () => remove("/api/gps"),
  getConfig: () => get("/api/gps/config"),
  updateConfig: (payload) => patch("/api/gps/config", payload),
  removeConfig: () => remove("/api/gps/config"),
};

/* ============================================================================
 * GYRO
 * ========================================================================== */
export const gyroApi = {
  get: () => get("/api/gyro"),
  create: (payload) => post("/api/gyro", payload),
  update: (payload) => patch("/api/gyro", payload),
  remove: () => remove("/api/gyro"),
  getConfig: () => get("/api/gyro/config"),
  updateConfig: (payload) => patch("/api/gyro/config", payload),
  removeConfig: () => remove("/api/gyro/config"),
};

/* ============================================================================
 * WEATHER
 * ========================================================================== */
export const weatherApi = {
  get: () => get("/api/weather"),
  create: (payload) => post("/api/weather", payload),
  update: (payload) => patch("/api/weather", payload),
  remove: () => remove("/api/weather"),
  getConfig: () => get("/api/weather/config"),
  updateConfig: (payload) => patch("/api/weather/config", payload),
  removeConfig: () => remove("/api/weather/config"),
};

/* ============================================================================
 * COMPASS
 * Catatan: GET /api/compass/config mengembalikan data:null jika belum dibuat.
 * ========================================================================== */
export const compassApi = {
  get: () => get("/api/compass"),
  create: (payload) => post("/api/compass", payload),
  update: (payload) => patch("/api/compass", payload),
  remove: () => remove("/api/compass"),
  getConfig: () => get("/api/compass/config"),
  updateConfig: (payload) => patch("/api/compass/config", payload),
  removeConfig: () => remove("/api/compass/config"),
};

/* ============================================================================
 * SPEED & DEPTH (config bersama: /api/navigation/config)
 * ========================================================================== */
export const speedApi = {
  get: () => get("/api/speed"),
  create: (payload) => post("/api/speed", payload),
  update: (payload) => patch("/api/speed", payload),
  remove: () => remove("/api/speed"),
};

export const depthApi = {
  get: () => get("/api/depth"),
  create: (payload) => post("/api/depth", payload),
  update: (payload) => patch("/api/depth", payload),
  remove: () => remove("/api/depth"),
};

export const navigationApi = {
  getConfig: () => get("/api/navigation/config"),
  updateConfig: (payload) => patch("/api/navigation/config", payload),
  removeConfig: () => remove("/api/navigation/config"),
};

/* ============================================================================
 * MQTT (global)
 * ========================================================================== */
export const mqttApi = {
  getConfig: () => get("/api/mqtt/config"),
  updateConfig: (payload) => patch("/api/mqtt/config", payload),
};

/* ============================================================================
 * CONFIG MAPPING — bentuk FE (topic/updateRate) <-> bentuk BE (topics/update_rate)
 * ========================================================================== */
export function fromConfig(data) {
  const cfg = data || {};
  return {
    ip: cfg.ip || "",
    port: cfg.port != null ? String(cfg.port) : "",
    username: cfg.username || "",
    password: cfg.password || "",
    topic: Array.isArray(cfg.topics) ? cfg.topics : [],
    updateRate: cfg.update_rate != null ? String(cfg.update_rate) : "",
  };
}

export function toConfigPayload(config, { includeTcp = false } = {}) {
  const topics = Array.isArray(config.topic)
    ? config.topic
    : config.topic
    ? [config.topic]
    : [];

  const payload = {
    ip: config.ip || undefined,
    port: config.port ? parseInt(config.port, 10) : undefined,
    username: config.username || undefined,
    password: config.password ?? "",
    topics,
    update_rate: config.updateRate ? parseInt(config.updateRate, 10) : undefined,
  };

  if (includeTcp) {
    payload.tcp_enabled = false; // JANGAN diaktifkan (bisa spam MQTT/TCP)
  }

  return payload;
}

export function isConfigComplete(config, { requirePassword = false } = {}) {
  if (!config) return false;
  const base = Boolean(
    config.ip && config.port && config.username && config.updateRate
  );
  return requirePassword ? base && Boolean(config.password) : base;
}
