import { DEFAULT_WS_URL } from "./client";

/**
 * WebSocket singleton dengan URL dinamis.
 * - Pesan GPS  : { type: "gps_update", json: {...}, gprmc, gpgll, gpvtg, gpzda }
 * - Pesan lain : { type: "gyro_update" | ..., data: {...} }
 * Backend hanya broadcast saat simulasi `is_running=true`.
 */

let socket = null;
let reconnectTimer = null;
let attempts = 0;
let refCount = 0;
let currentWsUrl = DEFAULT_WS_URL;

const listeners = new Map();
const statusListeners = new Set();
let status = "idle";

function setStatus(next) {
  status = next;
  statusListeners.forEach((fn) => { try { fn(next); } catch { /* ignore */ } });
}

export function getRealtimeStatus() { return status; }

export function subscribeRealtimeStatus(handler) {
  statusListeners.add(handler);
  handler(status);
  return () => statusListeners.delete(handler);
}

function ensureListeners(type) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  return listeners.get(type);
}

function connect(url) {
  if (typeof WebSocket === "undefined") return;
  const wsUrl = url || currentWsUrl;
  if (!wsUrl) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  setStatus("connecting");
  try { socket = new WebSocket(wsUrl); } catch { scheduleReconnect(); return; }

  socket.onopen = () => { attempts = 0; setStatus("open"); };
  socket.onmessage = (event) => {
    let message; try { message = JSON.parse(event.data); } catch { return; }
    const handlers = listeners.get(message?.type);
    if (!handlers) return;
    handlers.forEach((fn) => { try { fn(message); } catch (error) { console.error("[WS] handler error", error); } });
  };
  socket.onerror = () => { try { socket?.close(); } catch { /* ignore */ } };
  socket.onclose = () => { socket = null; setStatus("closed"); scheduleReconnect(); };
}

function scheduleReconnect() {
  if (refCount <= 0) return;
  const delay = Math.min(30000, 2000 * 2 ** Math.min(attempts, 4));
  attempts += 1;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => connect(currentWsUrl), delay);
}

/**
 * Set WS URL baru dan reconnect jika sedang connected/connecting.
 */
export function setWsUrl(newUrl) {
  currentWsUrl = newUrl || DEFAULT_WS_URL;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    socket.close();
  }
}

export function subscribeRealtime(type, handler) {
  const handlers = ensureListeners(type);
  handlers.add(handler);
  refCount += 1;
  connect();
  return () => {
    handlers.delete(handler);
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      clearTimeout(reconnectTimer);
      try { socket?.close(); } catch { /* ignore */ }
      socket = null;
      setStatus("idle");
    }
  };
}