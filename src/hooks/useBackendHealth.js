import { useCallback, useEffect, useRef, useState } from "react";
import { healthApi } from "../api/endpoints";

/**
 * Cache global agar perpindahan halaman tidak memunculkan banner
 * "Menghubungkan…" lagi jika backend baru saja dicek.
 */
let healthCache = { status: "checking", checkedAt: 0 };
const CACHE_TTL_MS = 30000;

/**
 * Memantau kesehatan backend.
 * status: "checking" | "online" | "offline"
 *
 * Request pertama bisa sampai 60 detik (Render free cold start),
 * karena itu timeout axios 90 detik dan banner menampilkan status "checking".
 */
export function useBackendHealth({ pollMs = 60000 } = {}) {
  const isFresh = Date.now() - healthCache.checkedAt < CACHE_TTL_MS;
  const [status, setStatus] = useState(
    isFresh ? healthCache.status : "checking"
  );
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const setAndCache = useCallback((next) => {
    healthCache = { status: next, checkedAt: Date.now() };
    setStatus(next);
  }, []);

  const check = useCallback(async () => {
    try {
      await healthApi.get();
      if (!mountedRef.current) return;
      setError("");
      setAndCache("online");
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err?.message || "Server tidak dapat dihubungi");
      setAndCache("offline");
    }
  }, [setAndCache]);

  useEffect(() => {
    mountedRef.current = true;

    // Jangan tampilkan "checking" jika cache masih segar.
    check();

    const timer = setInterval(check, pollMs);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [check, pollMs]);

  return {
    status,
    error,
    retry: () => {
      setStatus("checking");
      check();
    },
  };
}
